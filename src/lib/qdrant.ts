import { QdrantClient } from '@qdrant/js-client-rest';

const url_qdrant = process.env.QDRANT_URL;
const key_qdrant = process.env.QDRANT_API_KEY;

export const qdrant = new QdrantClient({ url: url_qdrant, apiKey: key_qdrant });

export const TICKETS_COLLECTION = 'tickets';
export const VECTOR_SIZE = 768;

export async function ensure_collection() {
	const { exists } = await qdrant.collectionExists(TICKETS_COLLECTION);
	if (!exists) {
		await qdrant.createCollection(TICKETS_COLLECTION, {
			vectors: { size: VECTOR_SIZE, distance: 'Cosine' },
		});
	}
}
