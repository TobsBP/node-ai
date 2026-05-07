import type { FastifyReply, FastifyRequest } from 'fastify';
import { get_jira_dev, list_jira_devs } from '@/lib/jira.js';

export const jira_controller = {
	async list_devs(_request: FastifyRequest, reply: FastifyReply) {
		const { data, error } = await list_jira_devs();
		if (error)
			return reply.status(500).send({
				error: error instanceof Error ? error.message : String(error),
			});
		return reply.status(200).send(data);
	},

	async get_dev(
		request: FastifyRequest<{ Params: { accountId: string } }>,
		reply: FastifyReply,
	) {
		const { accountId } = request.params;
		const { data, error } = await get_jira_dev(accountId);
		if (error) {
			if (error === 'Dev not found')
				return reply.status(404).send({ error });
			return reply.status(500).send({
				error: error instanceof Error ? error.message : String(error),
			});
		}
		return reply.status(200).send(data);
	},
};
