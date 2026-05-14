import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { resolution_controller } from '@/controllers/resolution.js';
import { resolution_schema } from '@/types/resolution.js';

export const resolution_route = async (app: FastifyInstance) => {
	app.get(
		'/resolutions',
		{
			schema: {
				querystring: z.object({
					status: z.enum(['pending', 'approved', 'rejected']).optional(),
					limit: z.coerce.number().int().min(1).max(100).optional(),
					offset: z.coerce.number().int().min(0).optional(),
				}),
				response: {
					200: z.array(resolution_schema),
					500: z.object({ error: z.string() }),
				},
				tags: ['Resolutions'],
				summary: 'List ticket resolutions filtered by training-approval status',
			},
		},
		resolution_controller.list,
	);

	app.get(
		'/resolution/:id',
		{
			schema: {
				params: z.object({ id: z.string().uuid() }),
				response: {
					200: resolution_schema,
					404: z.object({ error: z.string() }),
					500: z.object({ error: z.string() }),
				},
				tags: ['Resolutions'],
				summary: 'Get a single resolution by ID',
			},
		},
		resolution_controller.get_by_id,
	);

	app.patch(
		'/resolution/:id/approval',
		{
			schema: {
				params: z.object({ id: z.string().uuid() }),
				body: z.object({
					approved: z.boolean(),
					reviewedBy: z.string().min(1),
				}),
				response: {
					200: resolution_schema,
					404: z.object({ error: z.string() }),
					500: z.object({ error: z.string() }),
				},
				tags: ['Resolutions'],
				summary: 'Mark a resolution as approved/rejected for model training',
			},
		},
		resolution_controller.set_approval,
	);
};
