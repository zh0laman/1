export interface Bot {
  id: string;
  name: string;
  description: string | null;
  system_prompt: string | null;
  settings: Record<string, any>;
  is_active: boolean;
  tenant_id: string;
  created_at: string;
  updated_at: string;
}

export interface BotCreateInput {
  name: string;
  description?: string;
  system_prompt?: string;
  settings?: Record<string, any>;
}

export interface BotUpdateInput {
  name?: string;
  description?: string;
  system_prompt?: string;
  settings?: Record<string, any>;
  is_active?: boolean;
}
