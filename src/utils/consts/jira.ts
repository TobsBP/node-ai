import type { Ticket } from '@/types/ticket.js';

export const SEVERITY_TO_PRIORITY: Record<Ticket['severity'], string> = {
	critical: 'Highest',
	high: 'High',
	medium: 'Medium',
	low: 'Low',
};

export const CATEGORY_TO_ISSUE_TYPE: Record<Ticket['category'], string> = {
	bug: 'Tarefa',
	infra: 'Tarefa',
	auth: 'Tarefa',
	feature: 'Tarefa',
	other: 'Tarefa',
};

export const JIRA_STATUS_MAP: Record<string, Ticket['status']> = {
	'to do': 'open',
	backlog: 'open',
	open: 'open',
	'in progress': 'in_progress',
	'in development': 'in_progress',
	'in review': 'testing_validation',
	'code review': 'testing_validation',
	review: 'testing_validation',
	testing: 'testing_validation',
	'testing and validation': 'testing_validation',
	'teste e validação': 'testing_validation',
	'teste e validacao': 'testing_validation',
	done: 'closed',
	closed: 'closed',
	resolved: 'closed',
	blocked: 'frozen',
	'on hold': 'frozen',
	frozen: 'frozen',
	rejected: 'rejected',
	rejeitado: 'rejected',
};

const JIRA_CATEGORY_MAP: Record<string, Ticket['status']> = {
	new: 'open',
	indeterminate: 'in_progress',
	done: 'closed',
};

function normalize(s: string): string {
	return s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
}

const NORMALIZED_STATUS_MAP: Record<string, Ticket['status']> =
	Object.fromEntries(
		Object.entries(JIRA_STATUS_MAP).map(([k, v]) => [normalize(k), v]),
	);

export function map_jira_status(
	jira_status: string,
	category_key?: string,
): Ticket['status'] | null {
	return (
		NORMALIZED_STATUS_MAP[normalize(jira_status)] ??
		(category_key ? (JIRA_CATEGORY_MAP[category_key] ?? null) : null)
	);
}
