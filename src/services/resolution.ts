import { randomUUID } from 'node:crypto';
import { resolutions_collection } from '@/lib/mongo.js';
import type { Resolution } from '@/types/resolution.js';
import type { Ticket } from '@/types/ticket.js';

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
