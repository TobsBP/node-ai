import { z } from 'zod';

export const conversation_schema = z.object({
	id: z.string(),
	message: z.string(),
	source: z.string().optional(),
	reply: z.string(),
	ticket_id: z.string(),
	created_at: z.string(),
});

export type Conversation = z.infer<typeof conversation_schema>;
