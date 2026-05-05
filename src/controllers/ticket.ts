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

		if (error)
			return reply.status(500).send({
				error: error instanceof Error ? error.message : String(error),
			});
		return reply.status(200).send(data);
	},

	async get_by_id(
		request: FastifyRequest<{
			Params: { id: string };
		}>,
		reply: FastifyReply,
	) {
		const { id } = request.params;
		const { data, error } = await ticket_service.get_by_id(id);

		if (error) {
			return reply.status(500).send({
				error: error instanceof Error ? error.message : String(error),
			});
		}

		if (!data) {
			return reply.status(404).send({ error: 'Ticket not found' });
		}

		return reply.status(200).send(data);
	},

	async delete(
		request: FastifyRequest<{
			Params: { id: string };
		}>,
		reply: FastifyReply,
	) {
		const { id } = request.params;
		const { success, error } = await ticket_service.delete(id);

		if (error) {
			return reply.status(500).send({
				error: error instanceof Error ? error.message : String(error),
			});
		}

		if (!success) {
			return reply.status(404).send({ error: 'Ticket not found' });
		}

		return reply.status(204).send();
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

		for await (const part of request.parts()) {
			if (part.type === 'field') {
				fields[part.fieldname] = part.value as string;
			}
		}

		const {
			title,
			system,
			studentId,
			deviceModel,
			version,
			description,
			file,
			_responsible_dev,
		} = fields;

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
			file,
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

	async classify_jira_only(request: FastifyRequest, reply: FastifyReply) {
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

		for await (const part of request.parts()) {
			if (part.type === 'field') {
				fields[part.fieldname] = part.value as string;
			}
		}

		const {
			title,
			system,
			studentId,
			deviceModel,
			version,
			description,
			file,
		} = fields;

		if (!title || !system || !studentId) {
			return reply
				.status(400)
				.send({ error: 'title, system and studentId are required' });
		}

		const { data, error } =
			await ticket_service.classify_save_and_create_jira_only({
				title,
				system,
				studentId,
				deviceModel,
				version,
				description,
				file,
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

	async reply(
		request: FastifyRequest<{
			Params: { id: string };
		}>,
		reply: FastifyReply,
	) {
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

		const { id } = request.params;
		const fields: Record<string, string> = {};

		for await (const part of request.parts()) {
			if (part.type === 'field') {
				fields[part.fieldname] = part.value as string;
			}
		}

		const { content, file } = fields;

		if (!content) {
			return reply.status(400).send({ error: 'Content is required' });
		}

		const { data, error } = await ticket_service.add_reply(
			id,
			content,
			createdBy,
			file,
		);

		if (error) {
			return reply.status(error === 'Ticket not found' ? 404 : 500).send({
				error: error instanceof Error ? error.message : String(error),
			});
		}

		return reply.status(201).send(data);
	},

	async update_status(
		request: FastifyRequest<{
			Params: { id: string };
			Body: { status: 'open' | 'in_progress' | 'closed' | 'review' | 'frozen' };
		}>,
		reply: FastifyReply,
	) {
		const authHeader = request.headers.authorization;
		if (!authHeader?.startsWith('Bearer ')) {
			return reply
				.status(401)
				.send({ error: 'Missing or invalid authorization header' });
		}

		let changedBy: string;
		try {
			changedBy = await verify_firebase_token(authHeader.slice(7));
		} catch {
			return reply.status(401).send({ error: 'Invalid or expired token' });
		}

		const { id } = request.params;
		const { status } = request.body;

		const { data, error } = await ticket_service.update_status(
			id,
			status,
			changedBy,
		);

		if (error) {
			return reply.status(error === 'Ticket not found' ? 404 : 500).send({
				error: error instanceof Error ? error.message : String(error),
			});
		}

		return reply.status(200).send(data);
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
		if (error)
			return reply.status(500).send({
				error: error instanceof Error ? error.message : String(error),
			});
		return reply.status(200).send(data);
	},
};
