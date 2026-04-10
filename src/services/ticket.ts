import { randomUUID } from 'node:crypto';
import { create_jira_issue, type JiraCreatedIssue } from '../lib/jira.js';
import { generate_embedding, send_message } from '../lib/model.js';
import {
	ensure_collection,
	qdrant,
	TICKETS_COLLECTION,
} from '../lib/qdrant.js';
import type { Ticket } from '../types/ticket.js';
import { CLASSIFY_PROMPT } from '../utils/consts/classify_prompt.js';

export const ticket_service = {
	async classify_and_save(
		message: string,
		source?: string,
	): Promise<{ data: Ticket | null; error: unknown }> {
		try {
			const [classify_res, embedding] = await Promise.all([
				send_message(CLASSIFY_PROMPT(message)),
				generate_embedding(message, 'RETRIEVAL_DOCUMENT'),
			]);

			if (classify_res.error || !classify_res.data) {
				return {
					data: null,
					error: classify_res.error ?? 'Classification failed',
				};
			}

			const raw = classify_res.data.trim().replace(/^```json\n?|```$/g, '');
			const classification = JSON.parse(raw) as Pick<
				Ticket,
				'category' | 'severity' | 'summary' | 'analysis' | 'tags'
			>;

			const ticket: Ticket = {
				id: randomUUID(),
				message,
				source,
				created_at: new Date().toISOString(),
				...classification,
			};

			await ensure_collection();
			await qdrant.upsert(TICKETS_COLLECTION, {
				points: [{ id: ticket.id, vector: embedding, payload: ticket }],
			});

			return { data: ticket, error: null };
		} catch (error) {
			console.error('Error classifying ticket:', error);
			return { data: null, error };
		}
	},

	async classify_save_and_create_jira(
		message: string,
		source?: string,
	): Promise<{
		data: { ticket: Ticket; jira: JiraCreatedIssue | null } | null;
		error: unknown;
	}> {
		const { data: ticket, error } = await this.classify_and_save(
			message,
			source,
		);
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

			const tickets = results.points.map((p) => p.payload as Ticket);
			return { data: tickets, error: null };
		} catch (error) {
			console.error('Error searching tickets:', error);
			return { data: null, error };
		}
	},
};
