import env from '../../config/env';

interface PluggyAuthResponse {
  apiKey: string;
}

interface PluggyItem {
  id: string;
  connector: {
    id: number;
    name: string;
    institutionUrl?: string;
    imageUrl?: string;
    primaryColor?: string;
  };
  status: string;
  createdAt?: string;
}

interface PluggyAccount {
  id: string;
  type: 'BANK' | 'CREDIT' | 'INVESTMENT' | string;
  name: string;
  balance?: number;
}

interface PluggyTransaction {
  id: string;
  description: string;
  amount: number;
  date: string;
  type?: 'DEBIT' | 'CREDIT' | string;
  merchant?: {
    name?: string;
  };
}

interface PluggyListResponse<T> {
  results: T[];
}

interface PluggyConnector {
  id: number;
  name: string;
  institutionUrl?: string;
  imageUrl?: string;
  primaryColor?: string;
  country?: string;
  type?: string;
}

interface PluggyCreateItemBody {
  connectorId: number;
  parameters: Record<string, unknown>;
  clientUserId?: string;
}

export class PluggyClient {
  private apiKey: string | null = null;
  private apiKeyExpiresAt = 0;

  private get baseUrl(): string {
    return env.PLUGGY_BASE_URL.replace(/\/$/, '');
  }

  private async getApiKey(): Promise<string> {
    const now = Date.now();
    if (this.apiKey && now < this.apiKeyExpiresAt) {
      return this.apiKey;
    }

    if (!env.PLUGGY_CLIENT_ID || !env.PLUGGY_CLIENT_SECRET) {
      throw new Error('Pluggy credentials are not configured (PLUGGY_CLIENT_ID / PLUGGY_CLIENT_SECRET).');
    }

    const response = await fetch(`${this.baseUrl}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: env.PLUGGY_CLIENT_ID,
        clientSecret: env.PLUGGY_CLIENT_SECRET,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Pluggy auth failed (${response.status}): ${text}`);
    }

    const data = await response.json() as PluggyAuthResponse;
    this.apiKey = data.apiKey;
    this.apiKeyExpiresAt = now + 25 * 60 * 1000;

    return data.apiKey;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const apiKey = await this.getApiKey();

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey,
        ...(init?.headers || {}),
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Pluggy request failed (${response.status}) ${path}: ${text}`);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }

  async createItem(input: PluggyCreateItemBody): Promise<PluggyItem> {
    return this.request<PluggyItem>('/items', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async getItem(itemId: string): Promise<PluggyItem> {
    return this.request<PluggyItem>(`/items/${itemId}`);
  }

  async deleteItem(itemId: string): Promise<void> {
    await this.request<void>(`/items/${itemId}`, { method: 'DELETE' });
  }

  async createConnectToken(clientUserId?: string): Promise<{ accessToken: string }> {
    return this.request<{ accessToken: string }>('/connect_token', {
      method: 'POST',
      body: JSON.stringify(clientUserId ? { clientUserId } : {}),
    });
  }

  async listConnectors(): Promise<PluggyConnector[]> {
    const data = await this.request<PluggyListResponse<PluggyConnector>>('/connectors');
    return data.results || [];
  }

  async getAccounts(itemId: string): Promise<PluggyAccount[]> {
    const data = await this.request<PluggyListResponse<PluggyAccount>>(`/accounts?itemId=${encodeURIComponent(itemId)}`);
    return data.results || [];
  }

  async getTransactions(accountId: string, from: string, to: string): Promise<PluggyTransaction[]> {
    const qs = `accountId=${encodeURIComponent(accountId)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    const data = await this.request<PluggyListResponse<PluggyTransaction>>(`/transactions?${qs}`);
    return data.results || [];
  }
}
