import type { Ticket } from '@/types/ticket.js';

export type JiraCreatedIssue = {
	id: string;
	key: string;
	url: string;
};

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

// Account IDs set via JIRA_ASSIGNEE_BACKEND and JIRA_ASSIGNEE_FRONTEND env vars
export const AREA_TO_ASSIGNEE: Record<
	NonNullable<Ticket['area']>,
	string | undefined
> = {
	backend: process.env.JIRA_ASSIGNEE_BACKEND,
	frontend: process.env.JIRA_ASSIGNEE_FRONTEND,
	fullstack: process.env.JIRA_ASSIGNEE_BACKEND, // default to backend for fullstack
};
