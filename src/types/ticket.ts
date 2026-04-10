import { z } from 'zod';

export const ticket_schema = z.object({
	id: z.string(),
	message: z.string(),
	category: z.enum(['bug', 'infra', 'auth', 'feature', 'other']),
	severity: z.enum(['critical', 'high', 'medium', 'low']),
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

export type Ticket = z.infer<typeof ticket_schema>;
