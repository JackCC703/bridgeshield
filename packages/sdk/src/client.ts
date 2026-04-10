import type {
  BridgeShieldConfig,
  CheckAddressParams,
  CheckAddressResponse,
  SubmitAppealParams,
  SubmitAppealResponse,
  AppealStatusResponse,
  WhitelistSummary,
  HealthCheckResponse,
} from './types';
import { ApiError, NetworkError, ValidationError } from './types';

const DEFAULT_TIMEOUT = 5000;

export class BridgeShieldClient {
  private baseUrl: string;
  private apiKey?: string;
  private timeout: number;

  constructor(config: BridgeShieldConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.apiKey = config.apiKey;
    this.timeout = config.timeout ?? DEFAULT_TIMEOUT;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
      ...((options.headers as Record<string, string>) || {}),
    };

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.status >= 400) {
        const errorData = await response.json().catch(() => ({}));
        const error = new ApiError(
          errorData.message || `Request failed: ${response.status}`,
          response.status,
          errorData
        );
        throw error;
      }

      return response.json();
    } catch (err) {
      clearTimeout(timeoutId);

      if (err instanceof Error && err.name === 'AbortError') {
        throw new NetworkError('Request timeout');
      }

      if (err instanceof ApiError) {
        throw err;
      }

      throw new NetworkError(
        err instanceof Error ? err.message : 'Network error'
      );
    }
  }

  async checkAddress(
    params: CheckAddressParams
  ): Promise<CheckAddressResponse> {
    if (!params.address) {
      throw new ValidationError('Address is required', 'address');
    }

    return this.request<CheckAddressResponse>('/api/v1/aml/check', {
      method: 'POST',
      body: JSON.stringify({
        address: params.address,
        chainId: params.chainId ?? 1,
        amount: params.amount,
        senderAddress: params.senderAddress,
      }),
    });
  }

  async submitAppeal(params: SubmitAppealParams): Promise<SubmitAppealResponse> {
    if (!params.address) {
      throw new ValidationError('Address is required', 'address');
    }
    if (!params.reason) {
      throw new ValidationError('Reason is required', 'reason');
    }

    return this.request<SubmitAppealResponse>('/api/v1/aml/appeal', {
      method: 'POST',
      body: JSON.stringify({
        address: params.address,
        chainId: params.chainId ?? 1,
        reason: params.reason,
        contact: params.contact,
      }),
    });
  }

  async getAppealStatus(ticketId: string): Promise<AppealStatusResponse> {
    if (!ticketId) {
      throw new ValidationError('Ticket ID is required', 'ticketId');
    }

    return this.request<AppealStatusResponse>(
      `/api/v1/aml/appeal/status/${encodeURIComponent(ticketId)}`
    );
  }

  async getWhitelistSummary(): Promise<WhitelistSummary> {
    return this.request<WhitelistSummary>('/api/v1/aml/whitelist');
  }

  async healthCheck(): Promise<HealthCheckResponse> {
    return this.request<HealthCheckResponse>('/api/v1/health');
  }

  setBaseUrl(url: string): void {
    this.baseUrl = url.replace(/\/$/, '');
  }

  setApiKey(key: string): void {
    this.apiKey = key;
  }
}