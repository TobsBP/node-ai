import { z } from 'zod';

export const reply_schema = z.object({
	id: z.string(),
	content: z.string(),
	file: z.string().nullish(),
	createdBy: z.string(),
	created_at: z.string(),
});

export const audit_entry_schema = z.object({
	id: z.string(),
	field: z.string(),
	old_value: z.any().nullish(),
	new_value: z.any().nullish(),
	changedBy: z.string(),
	changed_at: z.string(),
});

export const ticket_schema = z.object({
	id: z.string(),
	title: z.string().nullish(),
	system: z.string().nullish(),
	studentId: z.string().nullish(),
	deviceModel: z.string().nullish(),
	version: z.string().nullish(),
	description: z.string().nullish(),
	file: z
		.union([z.array(z.string()), z.string().transform((s) => [s])])
		.nullish(),
	status: z
		.enum([
			'open',
			'in_progress',
			'closed',
			'testing_validation',
			'frozen',
			'rejected',
		])
		.nullish(),
	createdBy: z.string().nullish(),
	category: z.enum(['bug', 'infra', 'auth', 'feature', 'other']).nullish(),
	severity: z.enum(['critical', 'high', 'medium', 'low']).nullish(),
	area: z.enum(['backend', 'frontend', 'fullstack']).nullish(),
	summary: z.string().nullish(),
	analysis: z.string().nullish(),
	tags: z.array(z.string()).default([]),
	ai_status: z.enum(['pending', 'ready', 'failed']).default('ready'),
	ai_error: z.string().nullish(),
	responsible_dev: z.string().nullish(),
	source: z.string().nullish(),
	jira_key: z.string().nullish(),
	replies: z.array(reply_schema).default([]),
	audit: z.array(audit_entry_schema).default([]),
	created_at: z.string(),
});

export const jira_issue_schema = z.object({
	id: z.string(),
	key: z.string(),
	url: z.string(),
});

export type Reply = z.infer<typeof reply_schema>;
export type AuditEntry = z.infer<typeof audit_entry_schema>;
export type Ticket = z.infer<typeof ticket_schema>;
