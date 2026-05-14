import { randomUUID } from 'node:crypto';
import { generate_embedding, send_message } from '@/lib/model.js';
import { SUGGEST_PROMPT } from '@/utils/consts/suggest_prompt.js';
import { resolutions_collection } from '@/lib/mongo.js';
import {
	ensure_resolutions_collection,
	qdrant,
	RESOLUTIONS_COLLECTION,
} from '@/lib/qdrant.js';
import type { Resolution } from '@/types/resolution.js';
import type { Ticket } from '@/types/ticket.js';

function build_problem_text(ticket: Ticket): string {
	const parts = [
		`Title: ${ticket.title ?? ''}`,
		`System: ${ticket.system ?? ''}`,
		ticket.description ? `Description: ${ticket.description}` : null,
		ticket.deviceModel ? `Device: ${ticket.deviceModel}` : null,
		ticket.version ? `Version: ${ticket.version}` : null,
	];
	return parts.filter(Boolean).join('\n');
}

type ApprovalFilter = 'pending' | 'approved' | 'rejected';

function approval_to_mongo(filter: ApprovalFilter) {
	if (filter === 'pending') return { approved_for_training: null };
	if (filter === 'approved') return { approved_for_training: true };
	return { approved_for_training: false };
}

export const resolution_service = {
	async create_from_ticket(
		ticket: Ticket,
		resolution_text: string,
		resolved_by: string,
	): Promise<{ data: Resolution | null; error: unknown }> {
		try {
			const resolution: Resolution = {
				id: randomUUID(),
				ticket_id: ticket.id,
				ticket_snapshot: ticket,
				replies_snapshot: ticket.replies ?? [],
				resolution_text,
				resolved_by,
				resolved_at: new Date().toISOString(),
				approved_for_training: null,
				reviewed_by: null,
				reviewed_at: null,
			};

			await resolutions_collection.insertOne(resolution);
			return { data: resolution, error: null };
		} catch (error) {
			console.error('Error creating resolution:', error);
			return { data: null, error };
		}
	},

	async list(
		status: ApprovalFilter = 'pending',
		limit = 20,
		offset = 0,
	): Promise<{ data: Resolution[] | null; error: unknown }> {
		try {
			const data = await resolutions_collection
				.find(approval_to_mongo(status), { projection: { _id: 0 } })
				.sort({ resolved_at: -1 })
				.skip(offset)
				.limit(limit)
				.toArray();
			return { data: data as unknown as Resolution[], error: null };
		} catch (error) {
			console.error('Error listing resolutions:', error);
			return { data: null, error };
		}
	},

	async get_by_id(
		id: string,
	): Promise<{ data: Resolution | null; error: unknown }> {
		try {
			const resolution = await resolutions_collection.findOne(
				{ id },
				{ projection: { _id: 0 } },
			);
			return { data: resolution as unknown as Resolution, error: null };
		} catch (error) {
			console.error('Error fetching resolution by id:', error);
			return { data: null, error };
		}
	},

	async suggest(
		problem: string,
		limit = 5,
	): Promise<{
		data: Array<{
			resolution_id: string;
			ticket_id: string;
			problem: string;
			resolution_text: string;
			category?: string;
			severity?: string;
			area?: string;
			tags?: string[];
			score: number;
		}> | null;
		error: unknown;
	}> {
		try {
			await ensure_resolutions_collection();

			const embedding = await generate_embedding(problem, 'RETRIEVAL_QUERY');

			const results = await qdrant.query(RESOLUTIONS_COLLECTION, {
				query: embedding,
				limit,
				with_payload: true,
			});

			const suggestions = results.points.map((p) => ({
				...(p.payload as {
					resolution_id: string;
					ticket_id: string;
					problem: string;
					resolution_text: string;
					category?: string;
					severity?: string;
					area?: string;
					tags?: string[];
				}),
				score: p.score ?? 0,
			}));

			return { data: suggestions, error: null };
		} catch (error) {
			console.error('Error suggesting resolutions:', error);
			return { data: null, error };
		}
	},

	async suggest_with_ai(
		problem: string,
		limit = 5,
	): Promise<{
		data: {
			answer: string;
			sources: Array<{
				resolution_id: string;
				ticket_id: string;
				resolution_text: string;
				score: number;
			}>;
		} | null;
		error: unknown;
	}> {
		try {
			const { data: matches, error: search_error } = await this.suggest(
				problem,
				limit,
			);
			if (search_error || !matches) {
				return { data: null, error: search_error ?? 'Search failed' };
			}

			const ai_res = await send_message(SUGGEST_PROMPT(problem, matches));
			if (ai_res.error || !ai_res.data) {
				return { data: null, error: ai_res.error ?? 'AI suggestion failed' };
			}

			return {
				data: {
					answer: ai_res.data,
					sources: matches.map((m) => ({
						resolution_id: m.resolution_id,
						ticket_id: m.ticket_id,
						resolution_text: m.resolution_text,
						score: m.score,
					})),
				},
				error: null,
			};
		} catch (error) {
			console.error('Error in suggest_with_ai:', error);
			return { data: null, error };
		}
	},

	async trigger_training(force = false): Promise<{
		data: { indexed: number; skipped: number; failed: number } | null;
		error: unknown;
	}> {
		try {
			await ensure_resolutions_collection();

			const filter: Record<string, unknown> = { approved_for_training: true };
			if (!force) filter.indexed_at = null;

			const resolutions = (await resolutions_collection
				.find(filter, { projection: { _id: 0 } })
				.toArray()) as unknown as Resolution[];

			let indexed = 0;
			let failed = 0;

			for (const res of resolutions) {
				try {
					const problem = build_problem_text(res.ticket_snapshot);
					const embedding = await generate_embedding(
						problem,
						'RETRIEVAL_DOCUMENT',
					);

					await qdrant.upsert(RESOLUTIONS_COLLECTION, {
						points: [
							{
								id: res.id,
								vector: embedding,
								payload: {
									resolution_id: res.id,
									ticket_id: res.ticket_id,
									problem,
									resolution_text: res.resolution_text,
									category: res.ticket_snapshot.category,
									severity: res.ticket_snapshot.severity,
									area: res.ticket_snapshot.area,
									tags: res.ticket_snapshot.tags,
								},
							},
						],
					});

					await resolutions_collection.updateOne(
						{ id: res.id },
						{ $set: { indexed_at: new Date().toISOString() } },
					);
					indexed++;
				} catch (err) {
					console.error(`Failed to index resolution ${res.id}:`, err);
					failed++;
				}
			}

			return {
				data: {
					indexed,
					skipped: resolutions.length - indexed - failed,
					failed,
				},
				error: null,
			};
		} catch (error) {
			console.error('Error triggering training:', error);
			return { data: null, error };
		}
	},

	async set_approval(
		id: string,
		approved: boolean,
		reviewed_by: string,
	): Promise<{ data: Resolution | null; error: unknown }> {
		try {
			const result = await resolutions_collection.findOneAndUpdate(
				{ id },
				{
					$set: {
						approved_for_training: approved,
						reviewed_by,
						reviewed_at: new Date().toISOString(),
					},
				},
				{ returnDocument: 'after', projection: { _id: 0 } },
			);

			if (!result) return { data: null, error: 'Resolution not found' };
			return { data: result as unknown as Resolution, error: null };
		} catch (error) {
			console.error('Error setting approval:', error);
			return { data: null, error };
		}
	},
};
