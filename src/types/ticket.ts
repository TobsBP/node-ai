import { z } from 'zod';

export const ticket_schema = z.object({
	id: z.string(),
	title: z.string().optional(),
	system: z.string().optional(),
	studentId: z.string().optional(),
	deviceModel: z.string().optional(),
	version: z.string().optional(),
	description: z.string().optional(),
	file: z.string().nullable().optional(),
	status: z.enum(['open', 'in_progress', 'closed']).optional(),
	createdBy: z.string().optional(),
	category: z.enum(['bug', 'infra', 'auth', 'feature', 'other']),
	severity: z.enum(['critical', 'high', 'medium', 'low']),
	area: z.enum(['backend', 'frontend', 'fullstack']).optional(),
	summary: z.string(),
	analysis: z.string(),
	tags: z.array(z.string()),
	source: z.string().optional(),
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
