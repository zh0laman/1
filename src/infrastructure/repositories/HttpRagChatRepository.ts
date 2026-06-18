import { ragAuthApi } from '../auth/ragAuthApi';

export interface RagChatSource {
  filename: string;
  page_number: number | null;
  similarity: number;
}

export interface RagChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface RagChatResult {
  answer: string;
  context_used: number;
  sources: RagChatSource[];
}

export interface RagChatStreamHandlers {
  onSources?: (sources: RagChatSource[], contextUsed: number) => void;
  onDelta?: (delta: string) => void;
  onError?: (message: string) => void;
}

interface AskOptions {
  botId: string;
  message: string;
  history?: RagChatMessage[];
  topK?: number;
  signal?: AbortSignal;
}

/**
 * RAG-чат с собственным ботом тенанта через JWT-сессию админ-панели.
 * Эндпоинт: POST /rag-api/admin/bots/{botId}/chat
 */
export const ragChatApi = {
  /** Обычный (не стриминговый) запрос — возвращает полный ответ и источники. */
  async ask({ botId, message, history = [], topK = 5, signal }: AskOptions): Promise<RagChatResult> {
    const token = ragAuthApi.getToken();
    if (!token) {
      throw new Error('Сессия истекла. Войдите в систему заново.');
    }

    const response = await fetch(`/rag-api/admin/bots/${botId}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message, history, top_k: topK, stream: false }),
      signal,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || 'Не удалось получить ответ от бота');
    }

    return response.json();
  },

  /**
   * Стриминговый запрос (Server-Sent Events через fetch ReadableStream).
   * EventSource не используется, т.к. он не умеет отправлять заголовок Authorization.
   */
  async askStream(
    { botId, message, history = [], topK = 5, signal }: AskOptions,
    handlers: RagChatStreamHandlers,
  ): Promise<void> {
    const token = ragAuthApi.getToken();
    if (!token) {
      throw new Error('Сессия истекла. Войдите в систему заново.');
    }

    const response = await fetch(`/rag-api/admin/bots/${botId}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message, history, top_k: topK, stream: true }),
      signal,
    });

    if (!response.ok || !response.body) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || 'Не удалось получить ответ от бота');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    // SSE-кадры разделены двойным переводом строки.
    const flushEvents = () => {
      let separatorIndex = buffer.indexOf('\n\n');
      while (separatorIndex !== -1) {
        const rawEvent = buffer.slice(0, separatorIndex);
        buffer = buffer.slice(separatorIndex + 2);

        const dataLine = rawEvent
          .split('\n')
          .find((line) => line.startsWith('data: '));

        if (dataLine) {
          const payload = dataLine.slice(6).trim();
          if (payload === '[DONE]') {
            return true;
          }
          try {
            const parsed = JSON.parse(payload);
            if (parsed.type === 'sources') {
              handlers.onSources?.(parsed.sources ?? [], parsed.context_used ?? 0);
            } else if (parsed.type === 'delta' && parsed.delta) {
              handlers.onDelta?.(parsed.delta);
            } else if (parsed.type === 'error') {
              handlers.onError?.(parsed.error || 'Ошибка генерации ответа');
            }
          } catch {
            // пропускаем некорректный кадр
          }
        }
        separatorIndex = buffer.indexOf('\n\n');
      }
      return false;
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      if (flushEvents()) break;
    }
  },
};
