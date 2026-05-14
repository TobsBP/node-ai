import type { FastifyReply, FastifyRequest } from 'fastify';
import { resolution_service } from '@/services/resolution.js';

export const resolution_controller = {
	async list(
		request: FastifyRequest<{
			Querystring: {
				status?: 'pending' | 'approved' | 'rejected';
				limit?: number;
				offset?: number;
			};
		}>,
		reply: FastifyReply,
	) {
		const { status = 'pending', limit = 20, offset = 0 } = request.query;
		const { data, error } = await resolution_service.list(
			status,
			limit,
			offset,
		);

		if (error)
			return reply.status(500).send({
				error: error instanceof Error ? error.message : String(error),
			});
		return reply.status(200).send(data);
	},

	async get_by_id(
		request: FastifyRequest<{ Params: { id: string } }>,
		reply: FastifyReply,
	) {
		const { id } = request.params;
		const { data, error } = await resolution_service.get_by_id(id);

		if (error)
			return reply.status(500).send({
				error: error instanceof Error ? error.message : String(error),
			});

		if (!data) return reply.status(404).send({ error: 'Resolution not found' });
		return reply.status(200).send(data);
	},

	async suggest(
		request: FastifyRequest<{
			Body: { problem: string };
			Querystring: { limit?: number };
		}>,
		reply: FastifyReply,
	) {
		const { problem } = request.body;
		const limit = request.query.limit ?? 5;

		const { data, error } = await resolution_service.suggest(problem, limit);

		if (error)
			return reply.status(500).send({
				error: error instanceof Error ? error.message : String(error),
			});

		return reply.status(200).send(data);
	},

	async trigger_training(
		request: FastifyRequest<{ Body?: { force?: boolean } }>,
		reply: FastifyReply,
	) {
		const force = request.body?.force ?? false;
		const { data, error } = await resolution_service.trigger_training(force);

		if (error)
			return reply.status(500).send({
				error: error instanceof Error ? error.message : String(error),
			});

		return reply.status(200).send(data);
	},

	async set_approval(
		request: FastifyRequest<{
			Params: { id: string };
			Body: { approved: boolean; reviewedBy: string };
		}>,
		reply: FastifyReply,
	) {
		const { id } = request.params;
		const { approved, reviewedBy } = request.body;

		const { data, error } = await resolution_service.set_approval(
			id,
			approved,
			reviewedBy,
		);

		if (error) {
			if (error === 'Resolution not found')
				return reply.status(404).send({ error });
			return reply.status(500).send({
				error: error instanceof Error ? error.message : String(error),
			});
		}

		return reply.status(200).send(data);
	},
};
