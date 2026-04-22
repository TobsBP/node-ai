import type { FastifyReply, FastifyRequest } from 'fastify';
import { verify_firebase_token } from '@/lib/firebase.js';
import { ticket_service } from '@/services/ticket.js';

export const ticket_controller = {
	async list(
		request: FastifyRequest<{
			Querystring: { limit?: number; offset?: number };
		}>,
		reply: FastifyReply,
	) {
		const { limit = 20, offset = 0 } = request.query;
		const { data, error } = await ticket_service.list(limit, offset);
		if (error) return reply.status(500).send({ error });
		return reply.status(200).send(data);
	},

	async classify(request: FastifyRequest, reply: FastifyReply) {
		const authHeader = request.headers.authorization;
		if (!authHeader?.startsWith('Bearer ')) {
			return reply
				.status(401)
				.send({ error: 'Missing or invalid authorization header' });
		}

		let createdBy: string;
		try {
			createdBy = await verify_firebase_token(authHeader.slice(7));
		} catch {
			return reply.status(401).send({ error: 'Invalid or expired token' });
		}

		const fields: Record<string, string> = {};
		let fileName: string | undefined;

		for await (const part of request.parts()) {
			if (part.type === 'file') {
				await part.toBuffer();
				fileName = part.filename;
			} else {
				fields[part.fieldname] = part.value as string;
			}
		}

		const { title, system, studentId, deviceModel, version, description } =
			fields;

		if (!title || !system || !studentId) {
			return reply
				.status(400)
				.send({ error: 'title, system and studentId are required' });
		}

		const { data, error } = await ticket_service.classify_save_and_create_jira({
			title,
			system,
			studentId,
			deviceModel,
			version,
			description,
			file: fileName,
			createdBy,
		});

		if (error) {
			const e = error as Record<string, unknown>;
			if (e?.status === 429)
				return reply.status(429).send({ error: 'Limite de uso atingido' });
			return reply.status(500).send({ error });
		}
		if (!data)
			return reply.status(400).send({ error: 'Classification failed' });
		return reply.status(201).send(data);
	},

	async search(
		request: FastifyRequest<{
			Body: { message: string };
			Querystring: { limit?: number };
		}>,
		reply: FastifyReply,
	) {
		const { message } = request.body;
		const limit = request.query.limit ?? 5;
		const { data, error } = await ticket_service.search_similar(message, limit);
		if (error) return reply.status(500).send({ error });
		return reply.status(200).send(data);
	},
};
