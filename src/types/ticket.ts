import { z } from 'zod';

export const ticket_schema = z.object({
	id: z.string(),
	title: z.string().nullish(),
	system: z.string().nullish(),
	studentId: z.string().nullish(),
	deviceModel: z.string().nullish(),
	version: z.string().nullish(),
	description: z.string().nullish(),
	file: z.string().nullish(),
	status: z.enum(['open', 'in_progress', 'closed']).nullish(),
	createdBy: z.string().nullish(),
	category: z.enum(['bug', 'infra', 'auth', 'feature', 'other']),
	severity: z.enum(['critical', 'high', 'medium', 'low']),
	area: z.enum(['backend', 'frontend', 'fullstack']).nullish(),
	summary: z.string(),
	analysis: z.string(),
	tags: z.array(z.string()),
	source: z.string().nullish(),
	created_at: z.string(),
});

export const jira_issue_schema = z.object({
	id: z.string(),
	key: z.string(),
	url: z.string(),
});

export const monday_item_schema = z.object({
	id: z.string(),
	url: z.string(),
});

export type Ticket = z.infer<typeof ticket_schema>;
