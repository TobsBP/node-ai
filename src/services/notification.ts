import { randomUUID } from 'node:crypto';
import { notifications_collection } from '@/lib/mongo.js';
import type { Notification } from '@/types/notification.js';

type CreateInput = Pick<
	Notification,
	'userId' | 'ticketId' | 'type' | 'message'
>;

export const notification_service = {
	async create(input: CreateInput): Promise<void> {
		try {
			const notification: Notification = {
				id: randomUUID(),
				...input,
				read: false,
				created_at: new Date().toISOString(),
			};
			await notifications_collection.insertOne(notification);
		} catch (error) {
			console.error('Error creating notification:', error);
		}
	},

	async list_by_user(userId: string): Promise<{
		data: { unread_count: number; notifications: Notification[] } | null;
		error: unknown;
	}> {
		try {
			const notifications = await notifications_collection
				.find({ userId }, { projection: { _id: 0 } })
				.sort({ created_at: -1 })
				.toArray();

			const unread_count = notifications.filter((n) => !n.read).length;

			return {
				data: { unread_count, notifications: notifications as Notification[] },
				error: null,
			};
		} catch (error) {
			console.error('Error listing notifications:', error);
			return { data: null, error };
		}
	},

	async mark_read(id: string): Promise<{ success: boolean; error: unknown }> {
		try {
			const result = await notifications_collection.updateOne(
				{ id },
				{ $set: { read: true } },
			);
			if (result.matchedCount === 0)
				return { success: false, error: 'Notification not found' };
			return { success: true, error: null };
		} catch (error) {
			console.error('Error marking notification as read:', error);
			return { success: false, error };
		}
	},

	async mark_all_read(
		userId: string,
	): Promise<{ success: boolean; error: unknown }> {
		try {
			await notifications_collection.updateMany(
				{ userId, read: false },
				{ $set: { read: true } },
			);
			return { success: true, error: null };
		} catch (error) {
			console.error('Error marking all notifications as read:', error);
			return { success: false, error };
		}
	},
};
