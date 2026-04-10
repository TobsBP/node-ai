import type { FastifyReply, FastifyRequest } from 'fastify';
import { ticket_service } from '../services/ticket.js';

export const ticket_controller = {
	async classify(
		request: FastifyRequest<{ Body: { message: string; source?: string } }>,
		reply: FastifyReply,
	) {
		const { message, source } = request.body;
		const { data, error } = await ticket_service.classify_save_and_create_jira(
			message,
			source,
		);
		if (error) {
			const e = error as Record<string, unknown>;
			if (e?.['status'] === 429) return reply.status(429).send({ error: 'Limite de uso atingido' });
			return reply.status(500).send({ error });
		}
		if (!data)
			return reply.status(400).send({ error: 'Classification failed' });
		return reply.status(201).send(data);
	},

	async search(
		request: FastifyRequest<{
			Body: { message: string };
			Querystring: { limit?: number };
		}>,
		reply: FastifyReply,
	) {
		const { message } = request.body;
		const limit = request.query.limit ?? 5;
		const { data, error } = await ticket_service.search_similar(message, limit);
		if (error) return reply.status(500).send({ error });
		return reply.status(200).send(data);
	},
};
