import type { FastifyReply, FastifyRequest } from 'fastify';
import { verify_firebase_token } from '@/lib/firebase.js';
import { ticket_service } from '@/services/ticket.js';

export const ticket_controller = {
	async list(
		request: FastifyRequest<{
			Querystring: {
				limit?: number;
				offset?: number;
				createdBy?: string;
				studentId?: string;
				system?: string;
				createdFrom?: string;
				createdTo?: string;
			};
		}>,
		reply: FastifyReply,
	) {
		const {
			limit = 20,
			offset = 0,
			createdBy,
			studentId,
			system,
			createdFrom,
			createdTo,
		} = request.query;
		const { data, error } = await ticket_service.list(limit, offset, {
			createdBy,
			studentId,
			system,
			createdFrom,
			createdTo,
		});

		if (error)
			return reply.status(500).send({
				error: error instanceof Error ? error.message : String(error),
			});
		return reply.status(200).send(data);
	},

	async list_lite(
		request: FastifyRequest<{
			Querystring: {
				limit?: number;
				offset?: number;
				createdBy?: string;
				studentId?: string;
				system?: string;
				createdFrom?: string;
				createdTo?: string;
			};
		}>,
		reply: FastifyReply,
	) {
		const {
			limit = 20,
			offset = 0,
			createdBy,
			studentId,
			system,
			createdFrom,
			createdTo,
		} = request.query;
		const { data, error } = await ticket_service.list_lite(limit, offset, {
			createdBy,
			studentId,
			system,
			createdFrom,
			createdTo,
		});

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
		const files: string[] = [];

		for await (const part of request.parts()) {
			if (part.type === 'field') {
				if (part.fieldname === 'file') {
					files.push(part.value as string);
				} else {
					fields[part.fieldname] = part.value as string;
				}
			}
		}

		const { title, system, studentId, deviceModel, version, description } =
			fields;

		if (!title || !system || !studentId) {
			return reply
				.status(400)
				.send({ error: 'title, system and studentId are required' });
		}

		const { data, error } = await ticket_service.classify_and_save({
			title,
			system,
			studentId,
			deviceModel,
			version,
			description,
			file: files.length > 0 ? files : undefined,
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

	async create_lite(request: FastifyRequest, reply: FastifyReply) {
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
		const files: string[] = [];

		for await (const part of request.parts()) {
			if (part.type === 'field') {
				if (part.fieldname === 'file') {
					files.push(part.value as string);
				} else {
					fields[part.fieldname] = part.value as string;
				}
			}
		}

		const { title, system, studentId, deviceModel, version, description } =
			fields;

		if (!title || !system || !studentId) {
			return reply
				.status(400)
				.send({ error: 'title, system and studentId are required' });
		}

		const { data, error } = await ticket_service.create_lite({
			title,
			system,
			studentId,
			deviceModel,
			version,
			description,
			file: files.length > 0 ? files : undefined,
			createdBy,
		});

		if (error) {
			const e = error as Record<string, unknown>;
			if (e?.status === 429)
				return reply.status(429).send({ error: 'Limite de uso atingido' });
			return reply.status(500).send({ error });
		}
		if (!data)
			return reply.status(400).send({ error: 'Ticket creation failed' });
		return reply.status(201).send(data);
	},

	async create_jira(
		request: FastifyRequest<{ Params: { id: string; devId: string } }>,
		reply: FastifyReply,
	) {
		const authHeader = request.headers.authorization;
		if (!authHeader?.startsWith('Bearer ')) {
			return reply
				.status(401)
				.send({ error: 'Missing or invalid authorization header' });
		}

		try {
			await verify_firebase_token(authHeader.slice(7));
		} catch {
			return reply.status(401).send({ error: 'Invalid or expired token' });
		}

		const { id, devId } = request.params;
		const { data, error } = await ticket_service.create_jira_for_ticket(
			id,
			devId,
		);

		if (error) {
			if (error === 'Ticket not found')
				return reply.status(404).send({ error });
			if (error === 'Ticket already has a Jira issue')
				return reply.status(409).send({ error });
			return reply.status(500).send({
				error: error instanceof Error ? error.message : String(error),
			});
		}

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
			Body: {
				status:
					| 'open'
					| 'in_progress'
					| 'closed'
					| 'testing_validation'
					| 'frozen'
					| 'rejected';
				resolution?: string;
			};
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
		const { status, resolution } = request.body;

		const { data, error } = await ticket_service.update_status(
			id,
			status,
			changedBy,
			resolution,
		);

		if (error) {
			if (error === 'Ticket not found')
				return reply.status(404).send({ error });
			if (error === 'Rejected tickets can only transition to in_progress')
				return reply.status(409).send({ error });
			return reply.status(500).send({
				error: error instanceof Error ? error.message : String(error),
			});
		}

		return reply.status(200).send(data);
	},

	async update_classification(
		request: FastifyRequest<{
			Params: { id: string };
			Body: {
				category?: 'bug' | 'infra' | 'auth' | 'feature' | 'other';
				severity?: 'critical' | 'high' | 'medium' | 'low';
			};
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
		const { category, severity } = request.body;

		if (!category && !severity) {
			return reply
				.status(400)
				.send({ error: 'category or severity is required' });
		}

		const { data, error } = await ticket_service.update_classification(
			id,
			{ category, severity },
			changedBy,
		);

		if (error) {
			if (error === 'Ticket not found')
				return reply.status(404).send({ error });
			return reply.status(500).send({
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
