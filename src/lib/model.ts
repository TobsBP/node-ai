import { GoogleGenAI } from '@google/genai';

const gemini_key = process.env.GEMINI_API_KEY as string;
const gemini_model = process.env.GEMINI_MODEL as string;

if (!gemini_model || !gemini_key) {
	throw new Error('GEMINI_MODEL or GEMINI_KEY is not defined');
}

export const ai = new GoogleGenAI({ apiKey: gemini_key });

const MAX_ATTEMPTS = 4;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30_000;
const RETRYABLE_STATUS = new Set([429, 500, 503]);

function get_error_status(error: unknown): number | null {
	if (error && typeof error === 'object') {
		const e = error as Record<string, unknown>;
		const status = e.status ?? e.code;
		if (typeof status === 'number') return status;
		if (typeof status === 'string') {
			const parsed = Number.parseInt(status, 10);
			if (!Number.isNaN(parsed)) return parsed;
		}
	}
	return null;
}

function is_retryable(error: unknown): boolean {
	const status = get_error_status(error);
	if (status !== null && RETRYABLE_STATUS.has(status)) return true;

	const message = error instanceof Error ? error.message : String(error ?? '');
	return /RESOURCE_EXHAUSTED|UNAVAILABLE|overloaded/i.test(message);
}

// Extracts a retryDelay (e.g. "12s") from a Google RetryInfo payload, in ms.
function get_retry_after_ms(error: unknown): number | null {
	if (!(error && typeof error === 'object')) return null;
	const message = error instanceof Error ? error.message : String(error);
	const match = message.match(/"?retryDelay"?\s*:?\s*"?(\d+(?:\.\d+)?)s/i);
	if (match) {
		return Math.min(Math.round(Number(match[1]) * 1000), MAX_DELAY_MS);
	}
	return null;
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function with_retry<T>(fn: () => Promise<T>): Promise<T> {
	let last_error: unknown;

	for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
		try {
			return await fn();
		} catch (error) {
			last_error = error;

			if (attempt === MAX_ATTEMPTS || !is_retryable(error)) {
				throw error;
			}

			const exponential = Math.min(
				BASE_DELAY_MS * 2 ** (attempt - 1),
				MAX_DELAY_MS,
			);
			// full jitter: random delay between 0 and the computed backoff
			const jittered = Math.round(Math.random() * exponential);
			const delay = get_retry_after_ms(error) ?? jittered;

			console.warn(
				`Gemini request failed (attempt ${attempt}/${MAX_ATTEMPTS}), retrying in ${delay}ms`,
			);
			await sleep(delay);
		}
	}

	throw last_error;
}

export async function send_message(message: string) {
	try {
		const res = await with_retry(() =>
			ai.models.generateContent({
				model: gemini_model,
				contents: message,
			}),
		);

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
	const result = await with_retry(() =>
		ai.models.embedContent({
			model: 'gemini-embedding-001',
			contents: text,
			config: { taskType: task_type, outputDimensionality: 768 },
		}),
	);
	return result.embeddings?.[0]?.values ?? [];
}
