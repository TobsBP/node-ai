import { z } from 'zod';

export const notification_schema = z.object({
	id: z.string(),
	userId: z.string(),
	ticketId: z.string(),
	type: z.enum(['status_change', 'new_reply', 'assignee_change']),
	message: z.string(),
	read: z.boolean().default(false),
	created_at: z.string(),
});

export type Notification = z.infer<typeof notification_schema>;
