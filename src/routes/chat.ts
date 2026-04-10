import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { chat_controller } from '../controllers/chat.js';
import { jira_issue_schema, ticket_schema } from '../types/ticket.js';

export const chat_route = async (app: FastifyInstance) => {
	app.post(
		'/chat',
		{
			schema: {
				body: z.object({
					message: z.string().min(1),
					source: z.string().optional(),
				}),
				response: {
					200: z.object({
						reply: z.string(),
						ticket: ticket_schema,
						jira: jira_issue_schema.nullable(),
					}),
					400: z.object({ error: z.string() }),
					500: z.object({ error: z.unknown() }),
				},
				tags: ['Chat'],
				summary: 'Send a message, classify it and create a Jira issue',
			},
		},
		chat_controller.send_message,
	);
};
