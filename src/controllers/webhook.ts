import type { FastifyReply, FastifyRequest } from 'fastify';
import { ticket_service } from '@/services/ticket.js';
import type { JiraWebhookPayload } from '@/types/jira.js';
import { map_jira_status } from '@/utils/consts/jira.js';

const JIRA_WEBHOOK_SECRET = process.env.JIRA_WEBHOOK_SECRET;

export const webhook_controller = {
	async jira(
		request: FastifyRequest<{ Querystring: { token?: string } }>,
		reply: FastifyReply,
	) {
		if (JIRA_WEBHOOK_SECRET && request.query.token !== JIRA_WEBHOOK_SECRET) {
			return reply.status(401).send({ error: 'Unauthorized' });
		}

		const payload = request.body as JiraWebhookPayload;

    
		
		if (payload.webhookEvent !== 'jira:issue_updated') {
			return reply.status(200).send({ ignored: true });
		}

		const jira_key = payload.issue?.key;
		if (!jira_key) {
			return reply.status(400).send({ error: 'Missing issue key' });
    }

    
		const status_change = payload.changelog?.items.find(
			(item) => item.field === 'status',
		);
		const assignee_change = payload.changelog?.items.find(
			(item) => item.field === 'assignee',
		);

		if (!status_change && !assignee_change) {
			return reply.status(200).send({ ignored: true });
		}

		if (status_change) {
			const category_key = payload.issue?.fields?.status?.statusCategory?.key;
			const status = map_jira_status(status_change.toString, category_key);
			if (!status) {
				return reply.status(200).send({
					ignored: true,
					reason: `Unknown status: ${status_change.toString}`,
				});
			}

			const { data, error } = await ticket_service.update_status_by_jira_key(
				jira_key,
				status,
      );


			if (error === 'Ticket not found') {
				return reply
					.status(404)
					.send({ error: 'Ticket not found for this Jira key' });
			}

			if (error) {
				return reply.status(500).send({
					error: error instanceof Error ? error.message : String(error),
				});
			}

			if (!assignee_change) {
				return reply.status(200).send({ updated: true, ticket_id: data?.id });
			}
		}

		if (assignee_change) {
			const responsible_dev = assignee_change.toString;

			const { data, error } =
				await ticket_service.update_responsible_dev_by_jira_key(
					jira_key,
					responsible_dev,
				);

			if (error === 'Ticket not found') {
				return reply
					.status(404)
					.send({ error: 'Ticket not found for this Jira key' });
			}

			if (error) {
				return reply.status(500).send({
					error: error instanceof Error ? error.message : String(error),
				});
			}

			return reply.status(200).send({ updated: true, ticket_id: data?.id });
		}
	},
};
