import type { RagLoginInput, RagLoginResponse, RagRegisterInput, RagUser } from '../../domain/entities/rag-auth';

const TOKEN_KEY = 'rag.auth.token';
const USER_KEY = 'rag.auth.user';

export const ragAuthApi = {
  async login(data: RagLoginInput): Promise<RagLoginResponse> {
    const response = await fetch('/rag-api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.detail || 'Не удалось авторизоваться');
    }

    const result: RagLoginResponse = await response.json();
    localStorage.setItem(TOKEN_KEY, result.access_token);
    localStorage.setItem(USER_KEY, JSON.stringify(result.user));
    return result;
  },

  async register(data: RagRegisterInput): Promise<RagLoginResponse> {
    const response = await fetch('/rag-api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.detail || 'Не удалось зарегистрироваться');
    }

    const result: RagLoginResponse = await response.json();
    localStorage.setItem(TOKEN_KEY, result.access_token);
    localStorage.setItem(USER_KEY, JSON.stringify(result.user));
    return result;
  },

  async getMe(): Promise<RagUser> {
    const token = this.getToken();
    if (!token) {
      throw new Error('Токен отсутствует');
    }

    const response = await fetch('/rag-api/auth/me', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      this.logout();
      throw new Error('Сессия истекла');
    }

    const user: RagUser = await response.json();
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    return user;
  },

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },

  getUser(): RagUser | null {
    const userStr = localStorage.getItem(USER_KEY);
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  },

  isAuthenticated(): boolean {
    return !!this.getToken();
  }
};
