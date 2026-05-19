# Retry para chamadas ao Gemini

## Problema

Sob alta demanda, a API do Gemini retorna erros transientes (HTTP 429
RESOURCE_EXHAUSTED, 503 UNAVAILABLE/overloaded, 500). Hoje qualquer um desses
erros falha imediatamente, derrubando rotas como `POST /ticket/lite`,
`/tickets/lite`, `/chat`, classify e resolution.

## Objetivo

Adicionar retry com backoff exponencial às chamadas ao Gemini, de forma
centralizada, cobrindo todas as rotas que usam IA sem duplicar código.

## Escopo

- Arquivo único: `src/lib/model.ts`.
- Envolve `send_message` (generateContent) e `generate_embedding`
  (embedContent).
- Sem novas dependências (backoff implementado à mão).
- Não altera rotas, controllers nem serviços.

## Design

### Helper `with_retry`

Função genérica que recebe uma fábrica `() => Promise<T>` e tenta executá-la
com retry.

- **Erros retentáveis:** HTTP `429`, `503`, `500` e erros de rede. Demais
  erros (400, 401, 403, etc.) são relançados de imediato — não adianta
  retentar.
- **Detecção do status:** inspeciona `error.status` (numérico), `error.code`,
  e fallback por substring na mensagem (`RESOURCE_EXHAUSTED`, `UNAVAILABLE`,
  `overloaded`). O SDK `@google/genai` lança `ApiError` com `status`.
- **Backoff:** exponencial base 1s → 2s → 4s, com *full jitter* (delay
  aleatório uniforme entre 0 e o valor calculado). Teto de 30s por espera.
- **Tentativas:** máximo de 4 (1 inicial + 3 retries).
- **`RetryInfo`:** se o erro do Google trouxer `retryDelay` (ex.: `"12s"`),
  esse valor tem prioridade sobre o backoff calculado (respeitando o teto).
- **Logging:** `console.warn` por tentativa falha com número da tentativa e
  delay aplicado; o `console.error` final em `send_message` é mantido.

### Integração

- `send_message`: mantém o contrato `{ data, error }`. O `try/catch` atual
  envolve `with_retry`; só retorna `error` após esgotar as tentativas.
- `generate_embedding`: continua lançando exceção, mas só após esgotar os
  retries (chamada interna passa a usar `with_retry`).

## Fora de escopo

- Circuit breaker / rate limiting do lado do cliente.
- Fila de requisições.
- Configuração via env de número de tentativas (valores fixos no código por
  ora; YAGNI).

## Testes / verificação

- Lint: `npm run lint`.
- Build: `npm run build`.
- Verificação manual do comportamento de backoff via simulação de erro 429
  (mock do `ai.models`), confirmando número de tentativas e crescimento do
  delay.
