import { type Collection, MongoClient } from 'mongodb';
import type { Conversation } from '../types/conversation.js';
import type { Ticket } from '../types/ticket.js';

const url = process.env.MONGODB_URL;
if (!url) throw new Error('MONGODB_URL is not set');

const client = new MongoClient(url);
const db = client.db('node-ai');

export const tickets_collection: Collection<Ticket> = db.collection('tickets');
export const conversations_collection: Collection<Conversation> =
	db.collection('conversations');

export async function connect_mongo(): Promise<void> {
	await client.connect();
	console.log('MongoDB connected');
}
