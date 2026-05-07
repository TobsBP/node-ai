import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { jira_controller } from '@/controllers/jira.js';

const jira_dev_schema = z.object({
	accountId: z.string(),
	displayName: z.string(),
	avatarUrl: z.string().optional(),
});

const jira_dev_detail_schema = jira_dev_schema.extend({
	emailAddress: z.string().optional(),
	active: z.boolean().optional(),
});

export const jira_route = async (app: FastifyInstance) => {
	app.get(
		'/jira/devs',
		{
			schema: {
				response: {
					200: z.array(jira_dev_schema),
					500: z.object({ error: z.string() }),
				},
				tags: ['Jira'],
				summary: 'List Jira users assignable to the configured project',
			},
		},
		jira_controller.list_devs,
	);

	app.get(
		'/jira/dev/:accountId',
		{
			schema: {
				params: z.object({ accountId: z.string().min(1) }),
				response: {
					200: jira_dev_detail_schema,
					404: z.object({ error: z.string() }),
					500: z.object({ error: z.string() }),
				},
				tags: ['Jira'],
				summary: 'Get a Jira user by accountId',
			},
		},
		jira_controller.get_dev,
	);
};
