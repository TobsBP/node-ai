import type { Ticket } from '@/types/ticket.js';

export type MondayCreatedItem = {
	id: string;
	url: string;
};

// Labels from project_status column: 0=Em andamento, 1=Feito, 2=Parado, 5=Não iniciado
export const SEVERITY_TO_STATUS: Record<Ticket['severity'], string> = {
	critical: 'Parado',
	high: 'Parado',
	medium: 'Em andamento',
	low: 'Não iniciado',
};

// User IDs set via MONDAY_ASSIGNEE_BACKEND and MONDAY_ASSIGNEE_FRONTEND env vars
export const AREA_TO_MONDAY_ASSIGNEE: Record<
	NonNullable<Ticket['area']>,
	number | undefined
> = {
	backend: process.env.MONDAY_ASSIGNEE_BACKEND
		? Number(process.env.MONDAY_ASSIGNEE_BACKEND)
		: undefined,
	frontend: process.env.MONDAY_ASSIGNEE_FRONTEND
		? Number(process.env.MONDAY_ASSIGNEE_FRONTEND)
		: undefined,
	fullstack: process.env.MONDAY_ASSIGNEE_BACKEND
		? Number(process.env.MONDAY_ASSIGNEE_BACKEND)
		: undefined,
};
