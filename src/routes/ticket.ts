import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ticket_controller } from '@/controllers/ticket.js';
import { jira_issue_schema, ticket_schema } from '@/types/ticket.js';

export const ticket_route = async (app: FastifyInstance) => {
	app.get(
		'/tickets',
		{
			schema: {
				querystring: z.object({
					limit: z.coerce.number().int().min(1).max(100).optional(),
					offset: z.coerce.number().int().min(0).optional(),
				}),
				response: {
					200: z.array(ticket_schema),
					500: z.object({ error: z.unknown() }),
				},
				tags: ['Tickets'],
				summary: 'List all tickets saved in MongoDB',
			},
		},
		ticket_controller.list,
	);

	app.post(
		'/tickets',
		{
			schema: {
				body: z.object({
					message: z.string().min(1),
					source: z.string().optional(),
				}),
				response: {
					201: z.object({
						ticket: ticket_schema,
						jira: jira_issue_schema.nullable(),
					}),
					400: z.object({ error: z.string() }),
					429: z.object({ error: z.string() }),
					500: z.object({ error: z.unknown() }),
				},
				tags: ['Tickets'],
				summary: 'Classify a ticket, save to vector DB and create a Jira issue',
			},
		},
		ticket_controller.classify,
	);

	app.post(
		'/tickets/search',
		{
			schema: {
				body: z.object({ message: z.string().min(1) }),
				querystring: z.object({
					limit: z.coerce.number().int().min(1).max(20).optional(),
				}),
				response: {
					200: z.array(ticket_schema),
					500: z.object({ error: z.unknown() }),
				},
				tags: ['Tickets'],
				summary: 'Search similar tickets by semantic similarity',
			},
		},
		ticket_controller.search,
	);
};
