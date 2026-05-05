import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { webhook_controller } from '@/controllers/webhook.js';

export const webhook_route = async (app: FastifyInstance) => {
	app.post(
		'/webhooks/jira',
		{
			schema: {
				querystring: z.object({ token: z.string().optional() }),
				response: {
					200: z.object({
						updated: z.boolean().optional(),
						ignored: z.boolean().optional(),
						ticket_id: z.string().optional(),
						reason: z.string().optional(),
					}),
					400: z.object({ error: z.string() }),
					401: z.object({ error: z.string() }),
					404: z.object({ error: z.string() }),
					500: z.object({ error: z.string() }),
				},
				tags: ['Webhooks'],
				summary: 'Receive Jira issue_updated events and sync ticket status',
			},
		},
		webhook_controller.jira,
	);
};
