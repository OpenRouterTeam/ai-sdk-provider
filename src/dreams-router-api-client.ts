/**
 * Dreams Router API Client
 * Provides access to Dreams Router API endpoints with authentication support
 */

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  user?: User;
  api_key?: string;
  session_token?: string;
  usage_history?: UsageLog[];
  statistics?: UsageStats;
  summary?: UsageSummary;
  models?: ModelConfig[];
  stats?: ModelStats;
  providers?: ModelProvider[];
  categories?: ModelCategory[];
  recommendations?: ModelRecommendationResponse;
  error?: string;
  amount_credited?: number;
  new_balance?: number;
  balance?: number;
  user_id?: string;
  wallet_address?: string;
  exists?: boolean;
  last_seen?: number;
}

export interface User {
  id: string;
  wallet_address?: string;
  balance: number;
  auth_method: 'api-key' | 'wallet';
  created_at: string;
  updated_at: string;
}

export interface UsageLog {
  id: string;
  user_id: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost: number;
  created_at: string;
}

export interface UsageStats {
  total_requests: number;
  total_tokens: number;
  total_cost: number;
  average_cost_per_request: number;
}

export interface UsageSummary {
  period: string;
  total_requests: number;
  total_cost: number;
  total_tokens: number;
  most_used_model: string;
}

export interface ModelConfig {
  id: string;
  name: string;
  description: string;
  context_length: number;
  pricing: {
    prompt: number;
    completion: number;
  };
  capabilities: string[];
}

export interface ModelStats {
  total_models: number;
  active_models: number;
  most_popular: string;
}

export interface ModelProvider {
  id: string;
  name: string;
  models: string[];
}

export interface ModelCategory {
  id: string;
  name: string;
  description: string;
  models: string[];
}

export interface ModelRecommendationResponse {
  recommended_models: ModelConfig[];
  reasoning: string;
}

export interface DreamsRouterApiClientOptions {
  baseURL?: string;
  apiKey?: string;
  sessionToken?: string;
  defaultHeaders?: Record<string, string>;
}

export class DreamsRouterApiClient {
  private baseURL: string;
  private defaultHeaders: Record<string, string> = {};
  private onTokenExpired?: () => Promise<string | null>;

  constructor(options: DreamsRouterApiClientOptions = {}) {
    this.baseURL = options.baseURL || 'https://dev-router.daydreams.systems/v1';

    if (options.apiKey) {
      this.setApiKey(options.apiKey);
    }

    if (options.sessionToken) {
      this.setSessionToken(options.sessionToken);
    }

    if (options.defaultHeaders) {
      this.defaultHeaders = {
        ...this.defaultHeaders,
        ...options.defaultHeaders,
      };
    }
  }

  public setApiKey(apiKey: string) {
    this.defaultHeaders['Authorization'] = `Bearer ${apiKey}`;
  }

  public setSessionToken(sessionToken: string) {
    this.defaultHeaders['Authorization'] = `Bearer ${sessionToken}`;
  }

  public removeApiKey() {
    delete this.defaultHeaders['Authorization'];
  }

  public removeSessionToken() {
    delete this.defaultHeaders['Authorization'];
  }

  public setTokenExpiredCallback(callback: () => Promise<string | null>) {
    this.onTokenExpired = callback;
  }

  private async request<T = any>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<ApiResponse<T>> {
    const makeRequest = async (headers = this.defaultHeaders) => {
      const url = `${this.baseURL}${endpoint}`;
      const requestHeaders = {
        'Content-Type': 'application/json',
        ...headers,
        ...options.headers,
      };

      const config: RequestInit = {
        ...options,
        headers: requestHeaders,
      };

      const response = await fetch(url, config);

      if (!response.ok) {
        const errorText = await response.text();
        const error = new Error(
          `HTTP ${response.status}: ${errorText || response.statusText}`,
        );
        (error as any).status = response.status;
        (error as any).response = response;
        (error as any).errorText = errorText;
        throw error;
      }

      return response.json();
    };

    try {
      return await makeRequest();
    } catch (error: any) {
      // Check if this is a JWT token expiration error
      if (
        error.status === 401 &&
        this.onTokenExpired &&
        this.isJWTTokenExpired(error.errorText)
      ) {
        console.log('🔄 JWT token expired, requesting new token...');

        try {
          const newToken = await this.onTokenExpired();
          if (newToken) {
            console.log('✅ Got new JWT token, retrying request...');
            this.setSessionToken(newToken);

            // Retry with new token
            return await makeRequest({
              ...this.defaultHeaders,
              Authorization: `Bearer ${newToken}`,
            });
          }
        } catch (refreshError) {
          console.error('❌ Failed to refresh token:', refreshError);
          throw refreshError;
        }
      }

      console.error(`API request failed: ${endpoint}`, error);
      throw error;
    }
  }

  private isJWTTokenExpired(errorText: string): boolean {
    return (
      errorText.includes('Token expired') ||
      errorText.includes('jwt expired') ||
      errorText.includes('Invalid token') ||
      errorText.includes('Invalid API key or session token')
    );
  }

  // Auth endpoints
  async getProfile(): Promise<ApiResponse<{ user: User }>> {
    return this.request('/auth/profile');
  }

  async authenticateWithWallet(
    x402Payment: string,
  ): Promise<ApiResponse<{ user: User; api_key: string }>> {
    return this.request('/auth/wallet-profile', {
      method: 'POST',
      body: JSON.stringify({ x402Payment }),
    });
  }

  async walletLogin(
    walletAddress: string,
    signature: string,
    message: string,
  ): Promise<ApiResponse<{ user: User; session_token: string }>> {
    return this.request('/auth/wallet-login', {
      method: 'POST',
      body: JSON.stringify({ walletAddress, signature, message }),
    });
  }

  // Balance endpoints
  async getWalletBalance(address: string): Promise<
    ApiResponse<{
      balance: number;
      user_id?: string;
      wallet_address?: string;
      exists?: boolean;
      last_seen?: number;
    }>
  > {
    return this.request(`/wallet/balance/${address}`);
  }

  async processPayment(
    x402Payment: string,
  ): Promise<ApiResponse<{ amount_credited: number; new_balance: number }>> {
    return this.request('/payments/process', {
      method: 'POST',
      headers: {
        'X-PAYMENT': x402Payment,
      },
    });
  }

  // Model endpoints
  async getDetailedModels(): Promise<ApiResponse<{ models: ModelConfig[] }>> {
    return this.request('/models/detailed');
  }

  async getModelStats(): Promise<ApiResponse<{ stats: ModelStats }>> {
    return this.request('/models/stats');
  }

  async getProviders(): Promise<ApiResponse<{ providers: ModelProvider[] }>> {
    return this.request('/models/providers');
  }

  async getModelCategories(): Promise<
    ApiResponse<{ categories: ModelCategory[] }>
  > {
    return this.request('/models/categories');
  }

  async searchModels(query: string): Promise<ApiResponse> {
    return this.request(`/models/search?q=${encodeURIComponent(query)}`);
  }

  async getModelRecommendations(requirements: {
    budget?: number;
    needsVision?: boolean;
    needsFunctions?: boolean;
    needsStreaming?: boolean;
    minTokens?: number;
  }): Promise<ApiResponse<{ recommendations: ModelRecommendationResponse }>> {
    const params = new URLSearchParams();
    Object.entries(requirements).forEach(([key, value]) => {
      if (value !== undefined) {
        params.set(key, value.toString());
      }
    });
    return this.request(`/models/recommendations?${params}`);
  }

  async checkModelAvailability(modelName: string): Promise<ApiResponse> {
    return this.request(
      `/models/${encodeURIComponent(modelName)}/availability`,
    );
  }

  async getModelDetails(modelName: string): Promise<ApiResponse> {
    return this.request(`/models/${encodeURIComponent(modelName)}`);
  }

  // Usage endpoints
  async getUsageHistory(
    limit: number = 100,
  ): Promise<ApiResponse<{ usage_history: UsageLog[] }>> {
    return this.request(`/auth/usage?limit=${limit}`);
  }

  async getUsageStats(): Promise<ApiResponse<{ statistics: UsageStats }>> {
    return this.request('/auth/stats');
  }

  async getUsageSummary(
    period: string = '7d',
  ): Promise<ApiResponse<{ summary: UsageSummary }>> {
    return this.request(`/auth/usage/summary?period=${period}`);
  }

  // Wallet usage endpoints (public)
  async getWalletUsage(
    address: string,
    limit: number = 100,
  ): Promise<ApiResponse<{ usage_history: UsageLog[] }>> {
    return this.request(`/wallet/usage/${address}?limit=${limit}`);
  }

  async getWalletStats(
    address: string,
  ): Promise<ApiResponse<{ statistics: UsageStats }>> {
    return this.request(`/wallet/stats/${address}`);
  }

  async getWalletUsageSummary(
    address: string,
    period: string = '7d',
  ): Promise<ApiResponse<{ summary: UsageSummary }>> {
    return this.request(`/wallet/usage/summary/${address}?period=${period}`);
  }

  // Platform fee endpoints
  async getPlatformFeeInfo(): Promise<ApiResponse> {
    return this.request('/platform-fee');
  }
}

// Default client instance
export const dreamsRouterApiClient = new DreamsRouterApiClient();
