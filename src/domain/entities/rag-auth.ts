export interface RagUser {
  id: string;
  email: string;
  full_name: string;
  role: 'owner' | 'admin' | 'viewer';
  tenant_id: string;
  is_active: boolean;
  created_at: string;
}

export interface RagLoginResponse {
  user: RagUser;
  access_token: string;
  token_type: string;
}

export interface RagLoginInput {
  email: string;
  password: string;
}

export interface RagRegisterInput {
  email: string;
  password: string;
  full_name: string;
  tenant_name: string;
}
