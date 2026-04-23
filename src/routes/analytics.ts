import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { analytics_controller } from '@/controllers/analytics.js';
import { analytics_response_schema } from '@/types/analytics.js';

export const analytics_route = async (app: FastifyInstance) => {
	app.get(
		'/analytics',
		{
			schema: {
				response: {
					200: analytics_response_schema,
					500: z.object({ error: z.string() }),
				},
				tags: ['Analytics'],
				summary: 'Get ticket analytics (categories, devices, systems)',
			},
		},
		analytics_controller.get_stats,
	);
};
