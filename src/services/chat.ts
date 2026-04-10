import { randomUUID } from 'node:crypto';
import { generate_embedding, send_message } from '../lib/model.js';
import { conversations_collection } from '../lib/mongo.js';
import {
	ensure_collection,
	qdrant,
	TICKETS_COLLECTION,
} from '../lib/qdrant.js';
import type { Ticket } from '../types/ticket.js';
import { build_rag_prompt } from '../utils/build_rag_prompt.js';
import { ticket_service } from './ticket.js';

export type ChatResponse = {
	reply: string;
};

export const chat_service = {
	async create_message(
		message: string,
		source?: string,
	): Promise<{ data: ChatResponse | null; error: unknown }> {
		const embedding = await generate_embedding(message, 'RETRIEVAL_QUERY');
		await ensure_collection();

		const [rag_results, classify_result] = await Promise.all([
			qdrant.query(TICKETS_COLLECTION, {
				query: embedding,
				limit: 5,
				with_payload: true,
			}),
			ticket_service.classify_for_rag(message, source),
		]);

		if (classify_result.error || !classify_result.data) {
			return {
				data: null,
				error: classify_result.error ?? 'Classification failed',
			};
		}

		const context = rag_results.points.map((p) => p.payload as Ticket);
		const prompt = build_rag_prompt(message, context);

		const [chat_result] = await Promise.all([send_message(prompt)]);

		if (chat_result.error || !chat_result.data) {
			return { data: null, error: chat_result.error ?? 'Chat failed' };
		}

		try {
			await conversations_collection.insertOne({
				id: randomUUID(),
				message,
				source,
				reply: chat_result.data,
				ticket_id: classify_result.data.id,
				created_at: new Date().toISOString(),
			});
		} catch (err) {
			console.error('Error saving conversation to MongoDB:', err);
		}

		return {
			data: {
				reply: chat_result.data,
			},
			error: null,
		};
	},
};
