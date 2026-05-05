import type { MondayCreatedItem } from '@/types/monday.js';
import type { Ticket } from '@/types/ticket.js';
import {
	AREA_TO_MONDAY_ASSIGNEE,
	SEVERITY_TO_STATUS,
} from '@/utils/consts/monday.js';

export type { MondayCreatedItem };

const MONDAY_API_TOKEN = process.env.MONDAY_API_TOKEN as string;
const MONDAY_BOARD_ID = process.env.MONDAY_BOARD_ID as string;

if (!MONDAY_API_TOKEN || !MONDAY_BOARD_ID) {
	throw new Error('MONDAY_API_TOKEN and MONDAY_BOARD_ID must be set');
}

async function monday_query(query: string, variables: Record<string, unknown>) {
	const response = await fetch('https://api.monday.com/v2', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${MONDAY_API_TOKEN}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ query, variables }),
	});

	if (!response.ok) {
		const body = await response.text();
		throw new Error(`Monday API error ${response.status}: ${body}`);
	}

	return response.json() as Promise<{
		data: Record<string, unknown>;
		errors?: unknown[];
	}>;
}

export async function create_monday_item(
	ticket: Ticket,
): Promise<{ data: MondayCreatedItem | null; error: unknown }> {
	try {
		const assignee_id = ticket.area
			? AREA_TO_MONDAY_ASSIGNEE[ticket.area]
			: undefined;

		const column_values: Record<string, unknown> = {
			project_status: { label: SEVERITY_TO_STATUS[ticket.severity] },
			text_mm2ncz1x: ticket.description ?? ticket.summary,
			text9: ticket.analysis,
		};

		if (assignee_id) {
			column_values.project_owner = {
				personsAndTeams: [{ id: assignee_id, kind: 'person' }],
			};
		}

		const json = await monday_query(
			`mutation ($board_id: ID!, $item_name: String!, $column_values: JSON!) {
				create_item(board_id: $board_id, item_name: $item_name, column_values: $column_values) {
					id
				}
			}`,
			{
				board_id: MONDAY_BOARD_ID,
				item_name: ticket.title,
				column_values: JSON.stringify(column_values),
			},
		);

		if (json.errors?.length) {
			return { data: null, error: json.errors };
		}

		const item = (json.data as { create_item: { id: string } }).create_item;

		return {
			data: {
				id: item.id,
				url: `https://tobias37060.monday.com/boards/${MONDAY_BOARD_ID}/pulses/${item.id}`,
			},
			error: null,
		};
	} catch (error) {
		console.error('Error creating Monday item:', error);
		return { data: null, error };
	}
}
