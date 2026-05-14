import type { FastifyReply, FastifyRequest } from 'fastify';
import { notification_service } from '@/services/notification.js';

export const notification_controller = {
	async list(
		request: FastifyRequest<{ Querystring: { userId: string } }>,
		reply: FastifyReply,
	) {
		const { userId } = request.query;
		const { data, error } = await notification_service.list_by_user(userId);

		if (error)
			return reply.status(500).send({
				error: error instanceof Error ? error.message : String(error),
			});
		return reply.status(200).send(data);
	},

	async mark_read(
		request: FastifyRequest<{ Params: { id: string } }>,
		reply: FastifyReply,
	) {
		const { id } = request.params;
		const { success, error } = await notification_service.mark_read(id);

		if (error === 'Notification not found')
			return reply.status(404).send({ error: 'Notification not found' });
		if (error)
			return reply.status(500).send({
				error: error instanceof Error ? error.message : String(error),
			});
		if (!success)
			return reply.status(404).send({ error: 'Notification not found' });

		return reply.status(200).send({ success: true });
	},

	async mark_all_read(
		request: FastifyRequest<{ Querystring: { userId: string } }>,
		reply: FastifyReply,
	) {
		const { userId } = request.query;
		const { error } = await notification_service.mark_all_read(userId);

		if (error)
			return reply.status(500).send({
				error: error instanceof Error ? error.message : String(error),
			});
		return reply.status(200).send({ success: true });
	},
};
