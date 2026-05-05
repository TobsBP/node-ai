import type { Ticket } from '@/types/ticket.js';

export const SEVERITY_TO_PRIORITY: Record<Ticket['severity'], string> = {
	critical: 'Highest',
	high: 'High',
	medium: 'Medium',
	low: 'Low',
};

export const CATEGORY_TO_ISSUE_TYPE: Record<Ticket['category'], string> = {
	bug: 'Bug',
	infra: 'Bug',
	auth: 'Bug',
	feature: 'Story',
	other: 'Task',
};

export const AREA_TO_ASSIGNEE: Record<
	NonNullable<Ticket['area']>,
	string | undefined
> = {
	backend: process.env.JIRA_ASSIGNEE_BACKEND,
	frontend: process.env.JIRA_ASSIGNEE_FRONTEND,
	fullstack: process.env.JIRA_ASSIGNEE_BACKEND,
};

export const JIRA_STATUS_MAP: Record<string, Ticket['status']> = {
	'to do': 'open',
	backlog: 'open',
	open: 'open',
	'in progress': 'in_progress',
	'in development': 'in_progress',
	'in review': 'review',
	'code review': 'review',
	review: 'review',
	done: 'closed',
	closed: 'closed',
	resolved: 'closed',
	blocked: 'frozen',
	'on hold': 'frozen',
	frozen: 'frozen',
};

const JIRA_CATEGORY_MAP: Record<string, Ticket['status']> = {
	new: 'open',
	indeterminate: 'in_progress',
	done: 'closed',
};

export function map_jira_status(
	jira_status: string,
	category_key?: string,
): Ticket['status'] | null {
	return (
		JIRA_STATUS_MAP[jira_status.toLowerCase()] ??
		(category_key ? (JIRA_CATEGORY_MAP[category_key] ?? null) : null)
	);
}
