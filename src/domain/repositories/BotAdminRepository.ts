import type { Bot, BotCreateInput, BotUpdateInput } from '../entities/bot';

export interface BotAdminRepository {
  listBots(): Promise<Bot[]>;
  getBot(id: string): Promise<Bot>;
  createBot(data: BotCreateInput): Promise<Bot>;
  updateBot(id: string, data: BotUpdateInput): Promise<Bot>;
  deleteBot(id: string): Promise<void>;
}
