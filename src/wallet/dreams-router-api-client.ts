/**
 * Dreams Router API Client
 * Provides access to Dreams Router API endpoints with authentication support
 */

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  user?: User;
  apiKey?: string;
  sessionToken?: string;
  usageHistory?: UsageLog[];
  statistics?: UsageStats;
  summary?: UsageSummary;
  models?: ModelConfig[];
  stats?: ModelStats;
  providers?: ModelProvider[];
  categories?: ModelCategory[];
  recommendations?: ModelRecommendationResponse;
  error?: string;
  amountCredited?: number;
  newBalance?: number;
  balance?: number;
  userId?: string;
  walletAddress?: string;
  exists?: boolean;
  lastSeen?: number;
  message?: string;
  instructions?: any;
}

export interface User {
  id: string;
  walletAddress?: string;
  balance: number;
  authMethod: 'api-key' | 'wallet' | 'password' | 'github';
  createdAt: number;
  updatedAt: number;
  name?: string;
  email?: string;
  emailVerified?: boolean;
  githubId?: string;
  githubUsername?: string;
  githubLinkedAt?: number | null;
  lastSeen?: number;
}

export interface UsageLog {
  id: string;
  userId: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
  timestamp: number;
  paymentMethod?: string;
  provider?: string;
}

export interface UsageStats {
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  avgTokensPerRequest: number;
  mostUsedModel: string | null;
  requestCount: number;
  timeRange: {
    start: number;
    end: number;
  };
}

export interface UsageSummary {
  totalRequests: number;
  totalCost: number;
  totalTokens: number;
  modelsUsed: string[];
  paymentMethods: Record<string, { requests: number; cost: number }>;
  costByModel: Record<string, number>;
  tokensByModel: Record<string, number>;
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
  defaultHeaders?: Record<string, string>;
}

export class DreamsRouterApiClient {
  private baseURL: string;
  private defaultHeaders: Record<string, string> = {};
  private onTokenExpired?: () => Promise<string | null>;

  constructor(options: DreamsRouterApiClientOptions = {}) {
    this.baseURL = options.baseURL || 'https://api-beta.daydreams.systems/v1';

    if (options.apiKey) {
      this.setApiKey(options.apiKey);
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
    options: RequestInit = {}
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
          `HTTP ${response.status}: ${errorText || response.statusText}`
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
            this.setApiKey(newToken);

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

  async walletLogin(
    walletAddress: string,
    signature: string,
    message: string
  ): Promise<ApiResponse<{ user: User; sessionToken: string }>> {
    return this.request('/auth/wallet-login', {
      method: 'POST',
      body: JSON.stringify({ walletAddress, signature, message }),
    });
  }

  // Balance endpoints
  async getWalletBalance(address: string): Promise<
    ApiResponse<{
      balance: number;
      userId?: string;
      walletAddress?: string;
      exists?: boolean;
      lastSeen?: number;
    }>
  > {
    return this.request(`/wallet/balance/${address}`);
  }

  async processPayment(
    x402Payment: string
  ): Promise<ApiResponse<{ amountCredited: number; newBalance: number }>> {
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
}

// Default client instance
export const dreamsRouterApiClient = new DreamsRouterApiClient();
