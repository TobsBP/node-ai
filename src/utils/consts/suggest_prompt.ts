type SuggestionContext = {
	problem: string;
	resolution_text: string;
	category?: string;
	severity?: string;
	tags?: string[];
};

export const SUGGEST_PROMPT = (
	problem: string,
	context: SuggestionContext[],
) => {
	const context_block =
		context.length > 0
			? context
					.map(
						(c, i) =>
							`[Caso ${i + 1}]\nProblema: ${c.problem}\nSolução aplicada: ${c.resolution_text}${
								c.category ? `\nCategoria: ${c.category}` : ''
							}${c.severity ? `\nSeveridade: ${c.severity}` : ''}${
								c.tags?.length ? `\nTags: ${c.tags.join(', ')}` : ''
							}`,
					)
					.join('\n\n')
			: 'Nenhum caso semelhante encontrado.';

	return `
Você é um assistente técnico. Sugira soluções para o problema com base nos casos passados.

Problema:
"${problem}"

Casos semelhantes:
${context_block}

Regras de resposta:
- Responda em português.
- Máximo 5 bullets curtos, cada um com uma ação prática.
- Sem introdução, sem conclusão, sem explicações longas.
- Comece direto pelas soluções.
- Se nenhum caso for relevante, responda apenas: "Sem casos semelhantes." e liste 2-3 passos de investigação.
- Não invente soluções sem respaldo nos casos.
`;
};
