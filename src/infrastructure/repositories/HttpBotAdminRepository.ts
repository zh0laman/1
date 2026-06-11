import type { Bot, BotCreateInput, BotUpdateInput } from '../../domain/entities/bot';
// Импортируем интерфейс репозитория как тип
import type { BotAdminRepository } from '../../domain/repositories/BotAdminRepository';
import { ragAuthApi } from '../auth/ragAuthApi';

export class HttpBotAdminRepository implements BotAdminRepository {
  private getHeaders(): HeadersInit {
    const token = ragAuthApi.getToken();
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    };
  }

  async listBots(): Promise<Bot[]> {
    const response = await fetch('/rag-api/admin/bots', {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || 'Не удалось загрузить список ботов');
    }

    return response.json();
  }

  async getBot(id: string): Promise<Bot> {
    const response = await fetch(`/rag-api/admin/bots/${id}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || 'Бот не найден');
    }

    return response.json();
  }

  async createBot(data: BotCreateInput): Promise<Bot> {
    const response = await fetch('/rag-api/admin/bots', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || 'Не удалось создать бота');
    }

    return response.json();
  }

  async updateBot(id: string, data: BotUpdateInput): Promise<Bot> {
    const response = await fetch(`/rag-api/admin/bots/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || 'Не удалось обновить бота');
    }

    return response.json();
  }

  async deleteBot(id: string): Promise<void> {
    const response = await fetch(`/rag-api/admin/bots/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || 'Не удалось удалить бота');
    }
  }
}

export const botAdminRepository = new HttpBotAdminRepository();
