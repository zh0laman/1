import { authorizedFetch } from '../http/authorizedFetch';
import { HttpError } from '../http/HttpError';
import type { AuthSessionStore } from '../../domain/services/AuthSessionStore';
import type { SmartAgentChatRequest, SmartAgentChatResponse } from '../../presentation/pages/alemai/smart-agent/types';

export class HttpSmartAgentRepository {
  private readonly sessionStore: AuthSessionStore;

  constructor(sessionStore: AuthSessionStore) {
    this.sessionStore = sessionStore;
  }

  async chat(payload: SmartAgentChatRequest): Promise<SmartAgentChatResponse> {
    const url = '/api/tools/smart-agent/chat';
    
    const response = await authorizedFetch(this.sessionStore, url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: payload.message,
        session_id: payload.session_id,
        force_new_session: payload.force_new_session,
        conversation_history: payload.conversation_history || [],
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new HttpError(
        data?.error?.message || data?.error || `Smart Agent request failed with status ${response.status}`,
        response.status,
        data?.error?.code
      );
    }

    return (await response.json()) as SmartAgentChatResponse;
  }
}
