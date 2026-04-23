import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ticket_controller } from '@/controllers/ticket.js';
import {
	jira_issue_schema,
	monday_item_schema,
	ticket_schema,
} from '@/types/ticket.js';

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
					500: z.object({ error: z.string() }),
				},
				tags: ['Tickets'],
				summary: 'List all tickets saved in MongoDB',
			},
		},
		ticket_controller.list,
	);

	app.get(
		'/ticket/:id',
		{
			schema: {
				params: z.object({ id: z.string().uuid() }),
				response: {
					200: ticket_schema,
					404: z.object({ error: z.string() }),
					500: z.object({ error: z.string() }),
				},
				tags: ['Tickets'],
				summary: 'Get a single ticket by ID',
			},
		},
		ticket_controller.get_by_id,
	);

	app.delete(
		'/ticket/:id',
		{
			schema: {
				params: z.object({ id: z.string().uuid() }),
				response: {
					204: z.null(),
					404: z.object({ error: z.string() }),
					500: z.object({ error: z.string() }),
				},
				tags: ['Tickets'],
				summary: 'Delete a ticket from MongoDB and Qdrant',
			},
		},
		ticket_controller.delete,
	);

	app.post(
		'/ticket',
		{
			schema: {
				consumes: ['multipart/form-data'],
				response: {
					201: z.object({
						ticket: ticket_schema,
						jira: jira_issue_schema.nullable(),
						monday: monday_item_schema.nullable(),
					}),
					400: z.object({ error: z.string() }),
					429: z.object({ error: z.string() }),
					500: z.object({ error: z.unknown() }),
				},
				tags: ['Tickets'],
				summary:
					'Classify a ticket, save to vector DB and create Jira/Monday issues',
				description: [
					'**Required fields:**',
					'- `title` — ticket title (max 100 chars)',
					'- `system` — system name',
					'- `studentId` — student Firebase ID',
					'',
					'**Optional fields:**',
					'- `deviceModel` — device model (max 60 chars)',
					'- `version` — app/system version (max 20 chars)',
					'- `description` — issue description (max 2000 chars)',
					'- `file` — image or file (JPG, PNG, WEBP, PDF, TXT — max 10 MB)',
				].join('\n'),
			},
		},
		ticket_controller.classify,
	);

	app.post(
		'/ticket/jira',
		{
			schema: {
				consumes: ['multipart/form-data'],
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
				summary: 'Classify a ticket and save ONLY to Jira (no Monday)',
			},
		},
		ticket_controller.classify_jira_only,
	);

	app.post(
		'/tickets/:id/replies',
		{
			schema: {
				params: z.object({ id: z.uuid() }),
				body: z.object({ content: z.string().min(1) }),
				response: {
					201: ticket_schema,
					400: z.object({ error: z.string() }),
					404: z.object({ error: z.string() }),
					500: z.object({ error: z.string() }),
				},
				tags: ['Tickets'],
				summary: 'Add a reply to an existing ticket',
			},
		},
		ticket_controller.reply,
	);

	app.put(
		'/ticket/:id/status',
		{
			schema: {
				params: z.object({ id: z.uuid() }),
				body: z.object({
					status: z.enum(['open', 'in_progress', 'closed', 'review', 'frozen']),
				}),
				response: {
					200: ticket_schema,
					400: z.object({ error: z.string() }),
					404: z.object({ error: z.string() }),
					500: z.object({ error: z.string() }),
				},
				tags: ['Tickets'],
				summary: 'Update ticket status',
			},
		},
		ticket_controller.update_status,
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
					500: z.object({ error: z.string() }),
				},
				tags: ['Tickets'],
				summary: 'Search similar tickets by semantic similarity',
			},
		},
		ticket_controller.search,
	);
};
