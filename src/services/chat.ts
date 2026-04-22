import { randomUUID } from 'node:crypto';
import { generate_embedding, send_message } from '@/lib/model.js';
import { conversations_collection } from '@/lib/mongo.js';
import { ensure_collection, qdrant, TICKETS_COLLECTION } from '@/lib/qdrant.js';
import type { Conversation } from '@/types/conversation.js';
import type { Ticket } from '@/types/ticket.js';
import { build_rag_prompt } from '@/utils/build_rag_prompt.js';

export type ChatResponse = {
	reply: string;
};

export const chat_service = {
	async list(
		limit = 20,
		offset = 0,
	): Promise<{ data: Conversation[] | null; error: unknown }> {
		try {
			const data = await conversations_collection
				.find({}, { projection: { _id: 0 } })
				.sort({ created_at: -1 })
				.skip(offset)
				.limit(limit)
				.toArray();
			return { data, error: null };
		} catch (error) {
			console.error('Error listing conversations:', error);
			return { data: null, error };
		}
	},

	async create_message(
		message: string,
		source?: string,
	): Promise<{ data: ChatResponse | null; error: unknown }> {
		const embedding = await generate_embedding(message, 'RETRIEVAL_QUERY');
		await ensure_collection();

		const rag_results = await qdrant.query(TICKETS_COLLECTION, {
			query: embedding,
			limit: 5,
			with_payload: true,
		});

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
