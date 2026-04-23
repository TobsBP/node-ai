import type { FastifyInstance } from 'fastify';
import { analytics_route } from './routes/analytics.js';
import { chat_route } from './routes/chat.js';
import { ticket_route } from './routes/ticket.js';

export const routes = async (app: FastifyInstance) => {
	app.register(ticket_route);
	app.register(chat_route);
	app.register(analytics_route);
};
