import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { notification_controller } from '@/controllers/notification.js';
import { notification_schema } from '@/types/notification.js';

export const notification_route = async (app: FastifyInstance) => {
	app.get(
		'/notifications',
		{
			schema: {
				querystring: z.object({ userId: z.string() }),
				response: {
					200: z.object({
						unread_count: z.number(),
						notifications: z.array(notification_schema),
					}),
					500: z.object({ error: z.string() }),
				},
				tags: ['Notifications'],
				summary: 'List notifications for a user with unread count',
			},
		},
		notification_controller.list,
	);

	app.put(
		'/notifications/:id/read',
		{
			schema: {
				params: z.object({ id: z.string() }),
				response: {
					200: z.object({ success: z.boolean() }),
					404: z.object({ error: z.string() }),
					500: z.object({ error: z.string() }),
				},
				tags: ['Notifications'],
				summary: 'Mark a single notification as read',
			},
		},
		notification_controller.mark_read,
	);

	app.put(
		'/notifications/read-all',
		{
			schema: {
				querystring: z.object({ userId: z.string() }),
				response: {
					200: z.object({ success: z.boolean() }),
					500: z.object({ error: z.string() }),
				},
				tags: ['Notifications'],
				summary: 'Mark all notifications as read for a user',
			},
		},
		notification_controller.mark_all_read,
	);
};
