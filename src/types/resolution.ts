import { z } from 'zod';
import { reply_schema, ticket_schema } from '@/types/ticket.js';

export const resolution_schema = z.object({
	id: z.string(),
	ticket_id: z.string(),
	ticket_snapshot: ticket_schema,
	replies_snapshot: z.array(reply_schema).default([]),
	resolution_text: z.string().min(1),
	resolved_by: z.string(),
	resolved_at: z.string(),
	approved_for_training: z.boolean().nullable(),
	reviewed_by: z.string().nullable(),
	reviewed_at: z.string().nullable(),
});

export type Resolution = z.infer<typeof resolution_schema>;
