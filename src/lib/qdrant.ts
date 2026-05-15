import { QdrantClient } from '@qdrant/js-client-rest';

const url_qdrant = process.env.QDRANT_URL;
const key_qdrant = process.env.QDRANT_API_KEY;

if (!url_qdrant || !key_qdrant) {
	throw new Error('QDRANT_URL and QDRANT_API_KEY must be set');
}

export const qdrant = new QdrantClient({
	url: url_qdrant,
	apiKey: key_qdrant,
	port: 443,
});

export const TICKETS_COLLECTION = 'class-ticket';
export const RESOLUTIONS_COLLECTION = 'resolutions';
export const VECTOR_SIZE = 768;

export async function ensure_collection() {
	const { exists } = await qdrant.collectionExists(TICKETS_COLLECTION);
	if (!exists) {
		await qdrant.createCollection(TICKETS_COLLECTION, {
			vectors: { size: VECTOR_SIZE, distance: 'Cosine' },
		});
	}
}

export async function ensure_resolutions_collection() {
	const { exists } = await qdrant.collectionExists(RESOLUTIONS_COLLECTION);
	if (!exists) {
		await qdrant.createCollection(RESOLUTIONS_COLLECTION, {
			vectors: { size: VECTOR_SIZE, distance: 'Cosine' },
		});
	}
}
