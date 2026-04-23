import { randomUUID } from 'node:crypto';
import { create_jira_issue, type JiraCreatedIssue } from '@/lib/jira.js';
import { generate_embedding, send_message } from '@/lib/model.js';
import { create_monday_item, type MondayCreatedItem } from '@/lib/monday.js';
import { tickets_collection } from '@/lib/mongo.js';
import { ensure_collection, qdrant, TICKETS_COLLECTION } from '@/lib/qdrant.js';
import type { Ticket } from '@/types/ticket.js';
import { CLASSIFY_PROMPT } from '@/utils/consts/classify_prompt.js';

type TicketInput = Pick<
	Ticket,
	| 'title'
	| 'system'
	| 'studentId'
	| 'deviceModel'
	| 'version'
	| 'description'
	| 'file'
	| 'createdBy'
>;

function build_message(input: TicketInput): string {
	const parts = [
		`Title: ${input.title}`,
		`System: ${input.system}`,
		input.description ? `Description: ${input.description}` : null,
		input.deviceModel ? `Device: ${input.deviceModel}` : null,
		input.version ? `Version: ${input.version}` : null,
	];
	return parts.filter(Boolean).join('\n');
}

export const ticket_service = {
	async list(
		limit = 20,
		offset = 0,
	): Promise<{ data: Ticket[] | null; error: unknown }> {
		try {
			const data = await tickets_collection
				.find({}, { projection: { _id: 0 } })
				.sort({ created_at: -1 })
				.skip(offset)
				.limit(limit)
				.toArray();
			return { data, error: null };
		} catch (error) {
			console.error('Error listing tickets:', error);
			return { data: null, error };
		}
	},

	async get_by_id(
		id: string,
	): Promise<{ data: Ticket | null; error: unknown }> {
		try {
			const ticket = await tickets_collection.findOne(
				{ id },
				{ projection: { _id: 0 } },
			);
			return { data: ticket as unknown as Ticket, error: null };
		} catch (error) {
			console.error('Error fetching ticket by id:', error);
			return { data: null, error };
		}
	},

	async delete(id: string): Promise<{ success: boolean; error: unknown }> {
		try {
			await Promise.all([
				tickets_collection.deleteOne({ id }),
				qdrant.delete(TICKETS_COLLECTION, {
					points: [id],
				}),
			]);
			return { success: true, error: null };
		} catch (error) {
			console.error('Error deleting ticket:', error);
			return { success: false, error };
		}
	},

	async classify_for_rag(
		input: TicketInput,
	): Promise<{ data: Ticket | null; error: unknown }> {
		try {
			await ensure_collection();

			const message = build_message(input);

			const [query_embedding, doc_embedding] = await Promise.all([
				generate_embedding(message, 'RETRIEVAL_QUERY'),
				generate_embedding(message, 'RETRIEVAL_DOCUMENT'),
			]);

			const similar = await qdrant.query(TICKETS_COLLECTION, {
				query: query_embedding,
				limit: 3,
				with_payload: true,
			});

			const context = similar.points.map((p) => p.payload as Ticket);

			const classify_res = await send_message(
				CLASSIFY_PROMPT(message, context),
			);

			if (classify_res.error || !classify_res.data) {
				return {
					data: null,
					error: classify_res.error ?? 'Classification failed',
				};
			}

			const raw = classify_res.data.trim().replace(/^```json\n?|```$/g, '');
			const classification = JSON.parse(raw) as Pick<
				Ticket,
				'category' | 'severity' | 'area' | 'summary' | 'analysis' | 'tags'
			>;

			const ticket: Ticket = {
				id: randomUUID(),
				...input,
				status: 'open',
				source: input.system,
				replies: [],
				created_at: new Date().toISOString(),
				...classification,
			};

			await qdrant.upsert(TICKETS_COLLECTION, {
				points: [{ id: ticket.id, vector: doc_embedding, payload: ticket }],
			});

			return { data: ticket, error: null };
		} catch (error) {
			console.error('Error classifying for RAG:', error);
			return { data: null, error };
		}
	},

	async classify_and_save(
		input: TicketInput,
	): Promise<{ data: Ticket | null; error: unknown }> {
		const { data: ticket, error } = await this.classify_for_rag(input);
		if (error || !ticket) return { data: null, error };

		try {
			await tickets_collection.insertOne(ticket);
		} catch (err) {
			console.error('Error saving ticket to MongoDB:', err);
		}

		return { data: ticket, error: null };
	},

	async classify_save_and_create_jira(input: TicketInput): Promise<{
		data: {
			ticket: Ticket;
			jira: JiraCreatedIssue | null;
			monday: MondayCreatedItem | null;
		} | null;
		error: unknown;
	}> {
		const { data: ticket, error } = await this.classify_and_save(input);
		if (error || !ticket)
			return { data: null, error: error ?? 'Classification failed' };

		const [
			{ data: jira, error: jira_error },
			{ data: monday, error: monday_error },
		] = await Promise.all([
			create_jira_issue(ticket),
			create_monday_item(ticket),
		]);

		if (jira_error) console.error('Jira issue creation failed:', jira_error);
		if (monday_error)
			console.error('Monday item creation failed:', monday_error);

		return { data: { ticket, jira, monday }, error: null };
	},

	async classify_save_and_create_jira_only(input: TicketInput): Promise<{
		data: {
			ticket: Ticket;
			jira: JiraCreatedIssue | null;
		} | null;
		error: unknown;
	}> {
		const { data: ticket, error } = await this.classify_and_save(input);
		if (error || !ticket)
			return { data: null, error: error ?? 'Classification failed' };

		const { data: jira, error: jira_error } = await create_jira_issue(ticket);

		if (jira_error) console.error('Jira issue creation failed:', jira_error);

		return { data: { ticket, jira }, error: null };
	},

	async search_similar(
		message: string,
		limit = 5,
	): Promise<{ data: Ticket[] | null; error: unknown }> {
		try {
			const embedding = await generate_embedding(message, 'RETRIEVAL_QUERY');
			await ensure_collection();

			const results = await qdrant.query(TICKETS_COLLECTION, {
				query: embedding,
				limit,
				with_payload: true,
			});

			const ids = results.points.map((p) => p.id as string);
			if (ids.length === 0) return { data: [], error: null };

			// Busca no Mongo para garantir que o ticket ainda existe
			const mongoTickets = await tickets_collection
				.find({ id: { $in: ids } }, { projection: { _id: 0 } })
				.toArray();

			// Mapeia para manter a ordem de similaridade do Qdrant
			const tickets = ids
				.map((id) => mongoTickets.find((t) => t.id === id))
				.filter((t) => !!t) as unknown as Ticket[];

			return { data: tickets, error: null };
		} catch (error) {
			console.error('Error searching tickets:', error);
			return { data: null, error };
		}
	},

	async add_reply(
		ticketId: string,
		content: string,
		createdBy: string,
	): Promise<{ data: Ticket | null; error: unknown }> {
		try {
			const reply = {
				id: randomUUID(),
				content,
				createdBy,
				created_at: new Date().toISOString(),
			};

			const result = await tickets_collection.findOneAndUpdate(
				{ id: ticketId },
				{ $push: { replies: reply } },
				{ returnDocument: 'after', projection: { _id: 0 } },
			);

			if (!result) return { data: null, error: 'Ticket not found' };

			return { data: result as Ticket, error: null };
		} catch (error) {
			console.error('Error adding reply:', error);
			return { data: null, error };
		}
	},

	async update_status(
		ticketId: string,
		status: 'open' | 'in_progress' | 'closed',
	): Promise<{ data: Ticket | null; error: unknown }> {
		try {
			const result = await tickets_collection.findOneAndUpdate(
				{ id: ticketId },
				{ $set: { status } },
				{ returnDocument: 'after', projection: { _id: 0 } },
			);

			if (!result) return { data: null, error: 'Ticket not found' };

			return { data: result as Ticket, error: null };
		} catch (error) {
			console.error('Error updating status:', error);
			return { data: null, error };
		}
	},
};
