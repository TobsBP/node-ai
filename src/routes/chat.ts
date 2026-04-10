import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { chat_controller } from '@/controllers/chat.js';
import { conversation_schema } from '@/types/conversation.js';

export const chat_route = async (app: FastifyInstance) => {
	app.get(
		'/chats',
		{
			schema: {
				querystring: z.object({
					limit: z.coerce.number().int().min(1).max(100).optional(),
					offset: z.coerce.number().int().min(0).optional(),
				}),
				response: {
					200: z.array(conversation_schema),
					500: z.object({ error: z.unknown() }),
				},
				tags: ['Chat'],
				summary: 'List all conversations',
			},
		},
		chat_controller.list,
	);

	app.post(
		'/chat',
		{
			schema: {
				body: z.object({
					message: z.string().min(1),
					source: z.string().optional(),
				}),
				response: {
					200: z.object({ reply: z.string() }),
					400: z.object({ error: z.string() }),
					429: z.object({ error: z.string() }),
					500: z.object({ error: z.unknown() }),
				},
				tags: ['Chat'],
				summary: 'Send a message and get an AI response',
			},
		},
		chat_controller.send_message,
	);
};
