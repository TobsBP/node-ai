import { randomUUID } from 'node:crypto';
import {
	create_jira_issue,
	type JiraCreatedIssue,
	transition_jira_issue,
} from '@/lib/jira.js';
import { generate_embedding, send_message } from '@/lib/model.js';
import { tickets_collection } from '@/lib/mongo.js';
import { ensure_collection, qdrant, TICKETS_COLLECTION } from '@/lib/qdrant.js';
import { notification_service } from '@/services/notification.js';
import { resolution_service } from '@/services/resolution.js';
import type { Ticket } from '@/types/ticket.js';
import { CLASSIFY_PROMPT } from '@/utils/consts/classify_prompt.js';
import { CLASSIFY_PROMPT_LITE } from '@/utils/consts/classify_prompt_lite.js';

type TicketInput = Pick<
	Ticket,
	| 'title'
	| 'system'
	| 'studentId'
	| 'deviceModel'
	| 'version'
	| 'description'
	| 'file'
	| 'createdBy'
>;

export type TicketListFilters = {
	createdBy?: string;
	studentId?: string;
	system?: string;
	createdFrom?: string;
	createdTo?: string;
};

function build_list_filter(
	filters: TicketListFilters,
): Record<string, unknown> {
	const filter: Record<string, unknown> = {};
	if (filters.createdBy) filter.createdBy = filters.createdBy;
	if (filters.studentId) filter.studentId = filters.studentId;
	if (filters.system) filter.system = filters.system;
	if (filters.createdFrom || filters.createdTo) {
		const range: Record<string, string> = {};
		if (filters.createdFrom) range.$gte = filters.createdFrom;
		if (filters.createdTo) range.$lte = filters.createdTo;
		filter.created_at = range;
	}
	return filter;
}

const ADMIN_USER_ID = 'admin';

async function notify_admin(
	ticketId: string,
	type: Parameters<typeof notification_service.create>[0]['type'],
	message: string,
	actorId?: string,
): Promise<void> {
	await notification_service.create({
		userId: ADMIN_USER_ID,
		ticketId,
		type,
		message,
		actorId,
	});
}

function build_message(input: TicketInput): string {
	const parts = [
		`Title: ${input.title}`,
		`System: ${input.system}`,
		input.description ? `Description: ${input.description}` : null,
		input.deviceModel ? `Device: ${input.deviceModel}` : null,
		input.version ? `Version: ${input.version}` : null,
	];
	return parts.filter(Boolean).join('\n');
}

export const ticket_service = {
	async list(
		limit = 20,
		offset = 0,
		filters: TicketListFilters = {},
	): Promise<{ data: Ticket[] | null; error: unknown }> {
		try {
			const filter = build_list_filter(filters);
			const data = await tickets_collection
				.find(filter, { projection: { _id: 0 } })
				.sort({ created_at: -1 })
				.skip(offset)
				.limit(limit)
				.toArray();
			return { data, error: null };
		} catch (error) {
			console.error('Error listing tickets:', error);
			return { data: null, error };
		}
	},

	async list_lite(
		limit = 20,
		offset = 0,
		filters: TicketListFilters = {},
	): Promise<{ data: Ticket[] | null; error: unknown }> {
		try {
			const filter: Record<string, unknown> = {
				...build_list_filter(filters),
				ai_status: 'pending',
			};

			const data = await tickets_collection
				.find(filter, { projection: { _id: 0 } })
				.sort({ created_at: -1 })
				.skip(offset)
				.limit(limit)
				.toArray();
			return { data, error: null };
		} catch (error) {
			console.error('Error listing lite tickets:', error);
			return { data: null, error };
		}
	},

	async get_by_id(
		id: string,
	): Promise<{ data: Ticket | null; error: unknown }> {
		try {
			const ticket = await tickets_collection.findOne(
				{ id },
				{ projection: { _id: 0 } },
			);
			return { data: ticket as unknown as Ticket, error: null };
		} catch (error) {
			console.error('Error fetching ticket by id:', error);
			return { data: null, error };
		}
	},

	async delete(id: string): Promise<{ success: boolean; error: unknown }> {
		try {
			await Promise.all([
				tickets_collection.deleteOne({ id }),
				qdrant.delete(TICKETS_COLLECTION, {
					points: [id],
				}),
			]);
			return { success: true, error: null };
		} catch (error) {
			console.error('Error deleting ticket:', error);
			return { success: false, error };
		}
	},

	async _classify_async(
		ticketId: string,
		input: TicketInput,
		mode: 'full' | 'lite',
	): Promise<void> {
		try {
			const message = build_message(input);

			const [query_embedding, doc_embedding] = await Promise.all([
				generate_embedding(message, 'RETRIEVAL_QUERY'),
				generate_embedding(message, 'RETRIEVAL_DOCUMENT'),
			]);

			const similar = await qdrant.query(TICKETS_COLLECTION, {
				query: query_embedding,
				limit: 3,
				with_payload: true,
			});

			const context = similar.points.map((p) => p.payload as Ticket);

			const prompt =
				mode === 'full'
					? CLASSIFY_PROMPT(message, context)
					: CLASSIFY_PROMPT_LITE(message, context);

			const classify_res = await send_message(prompt);

			if (classify_res.error || !classify_res.data) {
				throw classify_res.error ?? new Error('Classification failed');
			}

			const raw = classify_res.data.trim().replace(/^```json\n?|```$/g, '');
			const classification = JSON.parse(raw) as Partial<
				Pick<
					Ticket,
					'category' | 'severity' | 'area' | 'summary' | 'analysis' | 'tags'
				>
			>;

			const updated = await tickets_collection.findOneAndUpdate(
				{ id: ticketId },
				{
					$set: {
						...classification,
						ai_status: 'ready',
						ai_error: null,
					},
				},
				{ returnDocument: 'after', projection: { _id: 0 } },
			);

			if (updated) {
				await qdrant.upsert(TICKETS_COLLECTION, {
					points: [
						{
							id: ticketId,
							vector: doc_embedding,
							payload: updated as unknown as Ticket,
						},
					],
				});
			}
		} catch (error) {
			console.error('Background classification failed:', error);
			const msg = error instanceof Error ? error.message : String(error);
			await tickets_collection
				.updateOne(
					{ id: ticketId },
					{ $set: { ai_status: 'failed', ai_error: msg } },
				)
				.catch((e) => console.error('Failed to mark ticket as failed:', e));
		}
	},

	async _create_pending(
		input: TicketInput,
		mode: 'full' | 'lite',
	): Promise<{ data: Ticket | null; error: unknown }> {
		try {
			await ensure_collection();

			const ticket: Ticket = {
				id: randomUUID(),
				...input,
				status: 'open',
				source: input.system,
				replies: [],
				audit: [
					{
						id: randomUUID(),
						field: 'ticket',
						old_value: null,
						new_value: 'created',
						changedBy: input.createdBy ?? 'unknown',
						changed_at: new Date().toISOString(),
					},
				],
				created_at: new Date().toISOString(),
				tags: [],
				ai_status: 'pending',
			};

			await tickets_collection.insertOne(ticket);

			await notify_admin(
				ticket.id,
				'ticket_created',
				`Novo ticket criado: "${ticket.title}".`,
				input.createdBy ?? undefined,
			);

			void this._classify_async(ticket.id, input, mode);

			return { data: ticket, error: null };
		} catch (error) {
			console.error('Error creating pending ticket:', error);
			return { data: null, error };
		}
	},

	async classify_and_save(
		input: TicketInput,
	): Promise<{ data: Ticket | null; error: unknown }> {
		return this._create_pending(input, 'full');
	},

	async create_lite(
		input: TicketInput,
	): Promise<{ data: Ticket | null; error: unknown }> {
		return this._create_pending(input, 'lite');
	},

	async create_jira_for_ticket(
		ticketId: string,
		devId: string,
	): Promise<{
		data: { ticket: Ticket; jira: JiraCreatedIssue } | null;
		error: unknown;
	}> {
		try {
			const ticket = (await tickets_collection.findOne(
				{ id: ticketId },
				{ projection: { _id: 0 } },
			)) as Ticket | null;

			if (!ticket) return { data: null, error: 'Ticket not found' };
			if (ticket.jira_key)
				return { data: null, error: 'Ticket already has a Jira issue' };

			const { data: jira, error: jira_error } = await create_jira_issue(
				ticket,
				devId,
			);

			if (jira_error || !jira) {
				console.error('Jira issue creation failed:', jira_error);
				return { data: null, error: jira_error ?? 'Jira creation failed' };
			}

			const audit_entry = {
				id: randomUUID(),
				field: 'jira_key',
				old_value: null,
				new_value: jira.key,
				changedBy: devId,
				changed_at: new Date().toISOString(),
			};

			const result = await tickets_collection.findOneAndUpdate(
				{ id: ticketId },
				{
					$set: { jira_key: jira.key, responsible_dev: devId },
					$push: { audit: audit_entry },
				},
				{ returnDocument: 'after', projection: { _id: 0 } },
			);

			await notify_admin(
				ticketId,
				'jira_created',
				`Jira ${jira.key} criada para o ticket "${ticket.title}".`,
				devId,
			);

			return {
				data: { ticket: (result as unknown as Ticket) ?? ticket, jira },
				error: null,
			};
		} catch (error) {
			console.error('Error creating Jira for ticket:', error);
			return { data: null, error };
		}
	},

	async search_similar(
		message: string,
		limit = 5,
	): Promise<{ data: Ticket[] | null; error: unknown }> {
		try {
			const embedding = await generate_embedding(message, 'RETRIEVAL_QUERY');
			await ensure_collection();

			const results = await qdrant.query(TICKETS_COLLECTION, {
				query: embedding,
				limit,
				with_payload: true,
			});

			const ids = results.points.map((p) => p.id as string);
			if (ids.length === 0) return { data: [], error: null };

			// Busca no Mongo para garantir que o ticket ainda existe
			const mongoTickets = await tickets_collection
				.find({ id: { $in: ids } }, { projection: { _id: 0 } })
				.toArray();

			// Mapeia para manter a ordem de similaridade do Qdrant
			const tickets = ids
				.map((id) => mongoTickets.find((t) => t.id === id))
				.filter((t) => !!t) as unknown as Ticket[];

			return { data: tickets, error: null };
		} catch (error) {
			console.error('Error searching tickets:', error);
			return { data: null, error };
		}
	},

	async add_reply(
		ticketId: string,
		content: string,
		createdBy: string,
		file?: string,
		mentions: string[] = [],
	): Promise<{ data: Ticket | null; error: unknown }> {
		try {
			const mentioned = [...new Set(mentions)].filter(
				(id) => id && id !== createdBy,
			);

			const reply = {
				id: randomUUID(),
				content,
				file,
				createdBy,
				mentions: mentioned,
				created_at: new Date().toISOString(),
			};

			const result = await tickets_collection.findOneAndUpdate(
				{ id: ticketId },
				{ $push: { replies: reply } },
				{ returnDocument: 'after', projection: { _id: 0 } },
			);

			if (!result) return { data: null, error: 'Ticket not found' };

			const updated = result as Ticket;
			if (updated.createdBy && updated.createdBy !== createdBy) {
				await notification_service.create({
					userId: updated.createdBy,
					ticketId: updated.id,
					type: 'new_reply',
					message: 'Seu ticket recebeu uma nova resposta.',
				});
			}

			for (const userId of mentioned) {
				if (userId === updated.createdBy) continue;
				await notification_service.create({
					userId,
					ticketId: updated.id,
					type: 'mention',
					message: `Você foi mencionada em uma resposta no ticket "${updated.title}".`,
				});
			}

			await notify_admin(
				updated.id,
				'new_reply',
				`Nova resposta no ticket "${updated.title}".`,
				createdBy,
			);

			return { data: updated, error: null };
		} catch (error) {
			console.error('Error adding reply:', error);
			return { data: null, error };
		}
	},

	async update_status_by_jira_key(
		jira_key: string,
		status:
			| 'open'
			| 'in_progress'
			| 'closed'
			| 'frozen'
			| 'testing_validation'
			| 'rejected',
	): Promise<{ data: Ticket | null; error: unknown }> {
		try {
			const ticket = await tickets_collection.findOne({ jira_key });
			if (!ticket) return { data: null, error: 'Ticket not found' };

			const audit_entry = {
				id: randomUUID(),
				field: 'status',
				old_value: ticket.status,
				new_value: status,
				changedBy: 'jira-webhook',
				changed_at: new Date().toISOString(),
			};

			const result = await tickets_collection.findOneAndUpdate(
				{ jira_key },
				{
					$set: { status },
					$push: { audit: audit_entry },
				},
				{ returnDocument: 'after', projection: { _id: 0 } },
			);

			if (result && ticket.createdBy) {
				await notification_service.create({
					userId: ticket.createdBy,
					ticketId: ticket.id,
					type: 'status_change',
					message: `O status do seu ticket foi atualizado para "${status}".`,
				});
			}

			if (result) {
				await notify_admin(
					ticket.id,
					'status_change',
					`Status do ticket "${ticket.title}" alterado para "${status}".`,
				);
			}

			return { data: result as unknown as Ticket, error: null };
		} catch (error) {
			console.error('Error updating status by jira_key:', error);
			return { data: null, error };
		}
	},

	async update_responsible_dev_by_jira_key(
		jira_key: string,
		responsible_dev: string,
	): Promise<{ data: Ticket | null; error: unknown }> {
		try {
			const ticket = await tickets_collection.findOne({ jira_key });
			if (!ticket) return { data: null, error: 'Ticket not found' };

			const result = await tickets_collection.findOneAndUpdate(
				{ jira_key },
				{
					$set: { responsible_dev },
					$push: {
						audit: {
							id: randomUUID(),
							field: 'responsible_dev',
							old_value: ticket.responsible_dev ?? null,
							new_value: responsible_dev,
							changedBy: 'jira-webhook',
							changed_at: new Date().toISOString(),
						},
					},
				},
				{ returnDocument: 'after', projection: { _id: 0 } },
			);

			if (result && ticket.createdBy) {
				await notification_service.create({
					userId: ticket.createdBy,
					ticketId: ticket.id,
					type: 'assignee_change',
					message: `O responsável pelo seu ticket foi atualizado para "${responsible_dev}".`,
				});
			}

			if (result) {
				await notify_admin(
					ticket.id,
					'assignee_change',
					`Responsável do ticket "${ticket.title}" alterado para "${responsible_dev}".`,
				);
			}

			return { data: result as unknown as Ticket, error: null };
		} catch (error) {
			console.error('Error updating responsible_dev by jira_key:', error);
			return { data: null, error };
		}
	},

	async update_responsible_dev(
		ticketId: string,
		responsible_dev: string,
		changedBy: string,
	): Promise<{ data: Ticket | null; error: unknown }> {
		try {
			const ticket = await tickets_collection.findOne({ id: ticketId });
			if (!ticket) return { data: null, error: 'Ticket not found' };

			const next = responsible_dev.trim() === '' ? null : responsible_dev;
			const current = ticket.responsible_dev ?? null;

			if (current === next) {
				return { data: ticket as unknown as Ticket, error: null };
			}

			const result = await tickets_collection.findOneAndUpdate(
				{ id: ticketId },
				{
					$set: { responsible_dev: next },
					$push: {
						audit: {
							id: randomUUID(),
							field: 'responsible_dev',
							old_value: current,
							new_value: next,
							changedBy,
							changed_at: new Date().toISOString(),
						},
					},
				},
				{ returnDocument: 'after', projection: { _id: 0 } },
			);

			if (result && ticket.createdBy && ticket.createdBy !== changedBy) {
				await notification_service.create({
					userId: ticket.createdBy,
					ticketId,
					type: 'assignee_change',
					message: next
						? `O responsável pelo seu ticket foi atualizado.`
						: `O responsável pelo seu ticket foi removido.`,
				});
			}

			if (result) {
				await notify_admin(
					ticketId,
					'assignee_change',
					next
						? `Responsável do ticket "${ticket.title}" alterado para "${next}".`
						: `Responsável do ticket "${ticket.title}" removido.`,
					changedBy,
				);
			}

			return { data: result as unknown as Ticket, error: null };
		} catch (error) {
			console.error('Error updating responsible_dev:', error);
			return { data: null, error };
		}
	},

	async update_classification(
		ticketId: string,
		patch: {
			category?: NonNullable<Ticket['category']>;
			severity?: NonNullable<Ticket['severity']>;
		},
		changedBy: string,
	): Promise<{ data: Ticket | null; error: unknown }> {
		try {
			const ticket = await tickets_collection.findOne({ id: ticketId });
			if (!ticket) return { data: null, error: 'Ticket not found' };

			const changed_at = new Date().toISOString();
			const audit_entries: Ticket['audit'] = [];
			const set: Record<string, unknown> = {};

			if (patch.category && patch.category !== ticket.category) {
				set.category = patch.category;
				audit_entries.push({
					id: randomUUID(),
					field: 'category',
					old_value: ticket.category ?? null,
					new_value: patch.category,
					changedBy,
					changed_at,
				});
			}

			if (patch.severity && patch.severity !== ticket.severity) {
				set.severity = patch.severity;
				audit_entries.push({
					id: randomUUID(),
					field: 'severity',
					old_value: ticket.severity ?? null,
					new_value: patch.severity,
					changedBy,
					changed_at,
				});
			}

			if (audit_entries.length === 0) {
				return { data: ticket as unknown as Ticket, error: null };
			}

			const result = await tickets_collection.findOneAndUpdate(
				{ id: ticketId },
				{ $set: set, $push: { audit: { $each: audit_entries } } },
				{ returnDocument: 'after', projection: { _id: 0 } },
			);

			if (result) {
				const fields = audit_entries.map((e) => e.field).join(', ');
				await notify_admin(
					ticketId,
					'classification_change',
					`Classificação do ticket "${ticket.title}" atualizada (${fields}).`,
					changedBy,
				);
			}

			return { data: result as unknown as Ticket, error: null };
		} catch (error) {
			console.error('Error updating classification:', error);
			return { data: null, error };
		}
	},

	async update_status(
		ticketId: string,
		status:
			| 'open'
			| 'in_progress'
			| 'closed'
			| 'frozen'
			| 'testing_validation'
			| 'rejected',
		changedBy: string,
		resolution?: string,
	): Promise<{ data: Ticket | null; error: unknown }> {
		try {
			const ticket = await tickets_collection.findOne({ id: ticketId });
			if (!ticket) return { data: null, error: 'Ticket not found' };

			if (ticket.status === 'rejected' && status !== 'in_progress') {
				return {
					data: null,
					error: 'Rejected tickets can only transition to in_progress',
				};
			}

			const audit_entry = {
				id: randomUUID(),
				field: 'status',
				old_value: ticket.status,
				new_value: status,
				changedBy,
				changed_at: new Date().toISOString(),
			};

			const result = await tickets_collection.findOneAndUpdate(
				{ id: ticketId },
				{
					$set: { status },
					$push: { audit: audit_entry },
				},
				{ returnDocument: 'after', projection: { _id: 0 } },
			);

			if (ticket.jira_key) {
				const transition_map: Record<typeof status, string[]> = {
					open: ['aguardando atendimento', 'To Do', 'Aberto', 'Backlog'],
					in_progress: [
						'Em atendimento',
						'iniciar atendimento',
						'In Progress',
						'Em andamento',
					],
					testing_validation: [
						'teste e validação',
						'In Review',
						'Testing',
						'QA',
					],
					frozen: ['Blocked', 'On Hold', 'Congelado', 'Bloqueado'],
					closed: ['Concluído', 'Done', 'Closed', 'Resolvido'],
					rejected: ['rejeitado', 'Rejected'],
				};
				const { error: jira_error } = await transition_jira_issue(
					ticket.jira_key,
					transition_map[status],
				);
				if (jira_error)
					console.error('Failed to transition Jira issue:', jira_error);
			}

			if (status === 'closed' && resolution && result) {
				const { error: res_error } =
					await resolution_service.create_from_ticket(
						result as unknown as Ticket,
						resolution,
						changedBy,
					);
				if (res_error)
					console.error('Failed to create resolution entry:', res_error);
			}

			if (ticket.createdBy && ticket.createdBy !== changedBy) {
				await notification_service.create({
					userId: ticket.createdBy,
					ticketId,
					type: 'status_change',
					message: `O status do seu ticket foi atualizado para "${status}".`,
				});
			}

			await notify_admin(
				ticketId,
				'status_change',
				`Status do ticket "${ticket.title}" alterado para "${status}".`,
				changedBy,
			);

			return { data: result as unknown as Ticket, error: null };
		} catch (error) {
			console.error('Error updating status:', error);
			return { data: null, error };
		}
	},
};
