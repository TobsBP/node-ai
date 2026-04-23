import type { FastifyReply, FastifyRequest } from 'fastify';
import { analytics_service } from '@/services/analytics.js';

export const analytics_controller = {
	async get_stats(_request: FastifyRequest, reply: FastifyReply) {
		const { data, error } = await analytics_service.get_stats();

		if (error) {
			return reply.status(500).send({
				error: error instanceof Error ? error.message : String(error),
			});
		}

		return reply.status(200).send(data);
	},
};
