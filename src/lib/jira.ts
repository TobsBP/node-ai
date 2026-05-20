import type { JiraCreatedIssue, JiraDev } from '@/types/jira.js';
import type { Ticket } from '@/types/ticket.js';
import {
	CATEGORY_TO_ISSUE_TYPE,
	SEVERITY_TO_PRIORITY,
} from '@/utils/consts/jira.js';

export type { JiraCreatedIssue };

const JIRA_BASE_URL = process.env.JIRA_BASE_URL as string;
const JIRA_EMAIL = process.env.JIRA_EMAIL as string;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN as string;
const JIRA_PROJECT_KEY = process.env.JIRA_PROJECT_KEY as string;
const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL as string;

if (!JIRA_BASE_URL || !JIRA_EMAIL || !JIRA_API_TOKEN || !JIRA_PROJECT_KEY) {
	throw new Error(
		'JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN and JIRA_PROJECT_KEY must be set',
	);
}

const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64');

export async function create_jira_issue(
	ticket: Ticket,
	assigneeAccountId: string,
): Promise<{ data: JiraCreatedIssue | null; error: unknown }> {
	try {
		const response = await fetch(`${JIRA_BASE_URL}/rest/api/3/issue`, {
			method: 'POST',
			headers: {
				Authorization: `Basic ${auth}`,
				'Content-Type': 'application/json',
				Accept: 'application/json',
			},
			body: JSON.stringify({
				fields: {
					project: { key: JIRA_PROJECT_KEY },
					issuetype: {
						name: ticket.category
							? CATEGORY_TO_ISSUE_TYPE[ticket.category]
							: 'Tarefa',
					},
					summary: ticket.title,
					description: {
						type: 'doc',
						version: 1,
						content: [
							{
								type: 'heading',
								attrs: { level: 2 },
								content: [{ type: 'text', text: 'Descrição do problema' }],
							},
							{
								type: 'panel',
								attrs: { panelType: 'info' },
								content: [
									{
										type: 'paragraph',
										content: [
											{
												type: 'text',
												text:
													ticket.description?.trim() ||
													'Sem descrição informada.',
												marks: ticket.description?.trim()
													? [{ type: 'strong' }]
													: [{ type: 'em' }],
											},
										],
									},
								],
							},
							...(ticket.analysis?.trim()
								? [
										{
											type: 'heading',
											attrs: { level: 3 },
											content: [{ type: 'text', text: 'Análise técnica' }],
										},
										{
											type: 'paragraph',
											content: [{ type: 'text', text: ticket.analysis }],
										},
									]
								: []),
							{
								type: 'heading',
								attrs: { level: 3 },
								content: [{ type: 'text', text: 'Metadados' }],
							},
							{
								type: 'bulletList',
								content: [
									{
										type: 'listItem',
										content: [
											{
												type: 'paragraph',
												content: [
													{
														type: 'text',
														text: 'Student ID: ',
														marks: [{ type: 'strong' }],
													},
													{
														type: 'text',
														text: String(ticket.studentId ?? '-'),
													},
												],
											},
										],
									},
									{
										type: 'listItem',
										content: [
											{
												type: 'paragraph',
												content: [
													{
														type: 'text',
														text: 'Sistema: ',
														marks: [{ type: 'strong' }],
													},
													{ type: 'text', text: String(ticket.system ?? '-') },
												],
											},
										],
									},
									...(ticket.deviceModel
										? [
												{
													type: 'listItem',
													content: [
														{
															type: 'paragraph',
															content: [
																{
																	type: 'text',
																	text: 'Dispositivo: ',
																	marks: [{ type: 'strong' }],
																},
																{ type: 'text', text: ticket.deviceModel },
															],
														},
													],
												},
											]
										: []),
									...(ticket.version
										? [
												{
													type: 'listItem',
													content: [
														{
															type: 'paragraph',
															content: [
																{
																	type: 'text',
																	text: 'Versão: ',
																	marks: [{ type: 'strong' }],
																},
																{ type: 'text', text: ticket.version },
															],
														},
													],
												},
											]
										: []),
								],
							},
							...(ticket.file && ticket.file.length > 0
								? ticket.file.map((url, i) => ({
										type: 'paragraph',
										content: [
											{
												type: 'text',
												text: `Attached File ${i + 1}: ${url}`,
												marks: [
													{
														type: 'link',
														attrs: { href: url },
													},
												],
											},
										],
									}))
								: []),
							...(FRONTEND_BASE_URL
								? [
										{
											type: 'paragraph',
											content: [
												{
													type: 'text',
													text: 'Ver ticket no backoffice',
													marks: [
														{
															type: 'link',
															attrs: {
																href: `${FRONTEND_BASE_URL}/tickets?ticket=${ticket.id}`,
															},
														},
													],
												},
											],
										},
									]
								: []),
							...(FRONTEND_BASE_URL && ticket.studentId
								? [
										{
											type: 'paragraph',
											content: [
												{
													type: 'text',
													text: 'Ver perfil da aluna',
													marks: [
														{
															type: 'link',
															attrs: {
																href: `${FRONTEND_BASE_URL}/alunas/${ticket.studentId}`,
															},
														},
													],
												},
											],
										},
									]
								: []),
						],
					},
					priority: {
						name: ticket.severity
							? SEVERITY_TO_PRIORITY[ticket.severity]
							: 'Medium',
					},
					labels: ticket.tags,
					assignee: { accountId: assigneeAccountId },
				},
			}),
		});

		if (!response.ok) {
			const body = await response.text();
			return {
				data: null,
				error: `Jira API error ${response.status}: ${body}`,
			};
		}

		const json = (await response.json()) as {
			id: string;
			key: string;
			self: string;
		};

		return {
			data: {
				id: json.id,
				key: json.key,
				url: `${JIRA_BASE_URL}/browse/${json.key}`,
			},
			error: null,
		};
	} catch (error) {
		console.error('Error creating Jira issue:', error);
		return { data: null, error };
	}
}

export async function transition_jira_issue(
	jira_key: string,
	target_status_names: string[],
): Promise<{
	data: { transition_id: string; to: string } | null;
	error: unknown;
}> {
	try {
		const list_url = `${JIRA_BASE_URL}/rest/api/3/issue/${encodeURIComponent(jira_key)}/transitions`;
		const list_res = await fetch(list_url, {
			headers: {
				Authorization: `Basic ${auth}`,
				Accept: 'application/json',
			},
		});

		if (!list_res.ok) {
			const body = await list_res.text();
			return {
				data: null,
				error: `Jira API error ${list_res.status}: ${body}`,
			};
		}

		const json = (await list_res.json()) as {
			transitions: Array<{ id: string; name: string; to: { name: string } }>;
		};

		const wanted = target_status_names.map((s) => s.toLowerCase());
		const match = json.transitions.find(
			(t) =>
				wanted.includes(t.to.name.toLowerCase()) ||
				wanted.includes(t.name.toLowerCase()),
		);

		if (!match) {
			return {
				data: null,
				error: `No Jira transition matching ${target_status_names.join(', ')} (available: ${json.transitions.map((t) => t.to.name).join(', ')})`,
			};
		}

		const apply_res = await fetch(list_url, {
			method: 'POST',
			headers: {
				Authorization: `Basic ${auth}`,
				'Content-Type': 'application/json',
				Accept: 'application/json',
			},
			body: JSON.stringify({ transition: { id: match.id } }),
		});

		if (!apply_res.ok) {
			const body = await apply_res.text();
			return {
				data: null,
				error: `Jira API error ${apply_res.status}: ${body}`,
			};
		}

		return {
			data: { transition_id: match.id, to: match.to.name },
			error: null,
		};
	} catch (error) {
		console.error('Error transitioning Jira issue:', error);
		return { data: null, error };
	}
}

export async function get_jira_dev(accountId: string): Promise<{
	data: (JiraDev & { emailAddress?: string; active?: boolean }) | null;
	error: unknown;
}> {
	try {
		const url = `${JIRA_BASE_URL}/rest/api/3/user?accountId=${encodeURIComponent(accountId)}`;
		const response = await fetch(url, {
			headers: {
				Authorization: `Basic ${auth}`,
				Accept: 'application/json',
			},
		});

		if (response.status === 404) {
			return { data: null, error: 'Dev not found' };
		}

		if (!response.ok) {
			const body = await response.text();
			return {
				data: null,
				error: `Jira API error ${response.status}: ${body}`,
			};
		}

		const json = (await response.json()) as {
			accountId: string;
			displayName: string;
			emailAddress?: string;
			active?: boolean;
			avatarUrls?: Record<string, string>;
		};

		return {
			data: {
				accountId: json.accountId,
				displayName: json.displayName,
				emailAddress: json.emailAddress,
				active: json.active,
				avatarUrl: json.avatarUrls?.['48x48'],
			},
			error: null,
		};
	} catch (error) {
		console.error('Error fetching Jira dev:', error);
		return { data: null, error };
	}
}

export async function list_jira_devs(): Promise<{
	data: JiraDev[] | null;
	error: unknown;
}> {
	try {
		const url = `${JIRA_BASE_URL}/rest/api/3/user/assignable/search?project=${encodeURIComponent(JIRA_PROJECT_KEY)}&maxResults=200`;
		const response = await fetch(url, {
			headers: {
				Authorization: `Basic ${auth}`,
				Accept: 'application/json',
			},
		});

		if (!response.ok) {
			const body = await response.text();
			return {
				data: null,
				error: `Jira API error ${response.status}: ${body}`,
			};
		}

		const json = (await response.json()) as Array<{
			accountId: string;
			displayName: string;
			accountType?: string;
			active?: boolean;
			avatarUrls?: Record<string, string>;
		}>;

		const devs = json
			.filter((u) => u.active !== false && u.accountType === 'atlassian')
			.map((u) => ({
				accountId: u.accountId,
				displayName: u.displayName,
				avatarUrl: u.avatarUrls?.['48x48'],
			}));

		return { data: devs, error: null };
	} catch (error) {
		console.error('Error listing Jira devs:', error);
		return { data: null, error };
	}
}
