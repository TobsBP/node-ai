import type { Ticket } from '@/types/ticket.js';
import {
	AREA_TO_ASSIGNEE,
	CATEGORY_TO_ISSUE_TYPE,
	type JiraCreatedIssue,
	SEVERITY_TO_PRIORITY,
} from '@/utils/consts/jira.js';

export type { JiraCreatedIssue };

const JIRA_BASE_URL = process.env.JIRA_BASE_URL as string;
const JIRA_EMAIL = process.env.JIRA_EMAIL as string;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN as string;
const JIRA_PROJECT_KEY = process.env.JIRA_PROJECT_KEY as string;

if (!JIRA_BASE_URL || !JIRA_EMAIL || !JIRA_API_TOKEN || !JIRA_PROJECT_KEY) {
	throw new Error(
		'JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN and JIRA_PROJECT_KEY must be set',
	);
}

const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64');

export async function create_jira_issue(
	ticket: Ticket,
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
					issuetype: { name: CATEGORY_TO_ISSUE_TYPE[ticket.category] },
					summary: ticket.title,
					description: {
						type: 'doc',
						version: 1,
						content: [
							{
								type: 'paragraph',
								content: [{ type: 'text', text: ticket.analysis }],
							},
							{
								type: 'paragraph',
								content: [
									{
										type: 'text',
										text: `Student ID: ${ticket.studentId} | System: ${ticket.system}${ticket.description ? ` | Description: ${ticket.description}` : ''}`,
										marks: [{ type: 'em' }],
									},
								],
							},
							...(ticket.file
								? [
										{
											type: 'paragraph',
											content: [
												{
													type: 'text',
													text: `Attached File: ${ticket.file}`,
													marks: [
														{
															type: 'link',
															attrs: { href: ticket.file },
														},
													],
												},
											],
										},
									]
								: []),
						],
					},
					priority: { name: SEVERITY_TO_PRIORITY[ticket.severity] },
					labels: ticket.tags,
					...(ticket.area &&
						AREA_TO_ASSIGNEE[ticket.area] && {
							assignee: { accountId: AREA_TO_ASSIGNEE[ticket.area] },
						}),
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
