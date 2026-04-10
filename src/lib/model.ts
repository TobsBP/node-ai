import { GoogleGenAI } from '@google/genai';

const gemini_key = process.env.GEMINI_API_KEY as string;
const gemini_model = process.env.GEMINI_MODEL as string;

if (!gemini_model || !gemini_key) {
	throw new Error('GEMINI_MODEL or GEMINI_KEY is not defined');
}

export const ai = new GoogleGenAI({ apiKey: gemini_key });

export async function send_message(message: string) {
	try {
		const res = await ai.models.generateContent({
			model: gemini_model,
			contents: message,
		});

		return { data: res.text, error: null };
	} catch (error) {
		console.error('An error happened:', error);
		return { data: null, error: error };
	}
}

export async function generate_embedding(
	text: string,
	task_type: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY' = 'RETRIEVAL_DOCUMENT',
): Promise<number[]> {
	const result = await ai.models.embedContent({
		model: 'gemini-embedding-001',
		contents: text,
		config: { taskType: task_type, outputDimensionality: 768 },
	});
	return result.embeddings?.[0]?.values ?? [];
}
