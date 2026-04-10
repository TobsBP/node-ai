import type { FastifyInstance } from 'fastify';
import { chat_route } from './routes/chat.js';
import { ticket_route } from './routes/ticket.js';

export const routes = async (app: FastifyInstance) => {
	app.register(ticket_route);
	app.register(chat_route);
};
