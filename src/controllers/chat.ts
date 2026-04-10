import type { FastifyReply, FastifyRequest } from 'fastify';
import { chat_service } from '../services/chat.js';

export const chat_controller = {
	async send_message(
		request: FastifyRequest<{ Body: { message: string; source?: string } }>,
		reply: FastifyReply,
	) {
		const { message, source } = request.body;
		const { data, error } = await chat_service.create_message(message, source);
		if (error) {
			const e = error as Record<string, unknown>;
			if (e?.['status'] === 429) return reply.status(429).send({ error: 'Limite de uso atingido' });
			return reply.status(500).send({ error });
		}
		if (!data)
			return reply.status(400).send({ error: 'Error sending message' });
		return reply.status(200).send(data);
	},
};
