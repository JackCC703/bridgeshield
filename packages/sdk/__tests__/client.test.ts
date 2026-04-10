import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BridgeShieldClient } from '../src/client';
import type { ApiError, NetworkError, ValidationError } from '../src/types';

describe('BridgeShieldClient', () => {
  let client: BridgeShieldClient;
  const baseUrl = 'https://api.test.bridgeshield.io';

  beforeEach(() => {
    client = new BridgeShieldClient({ baseUrl });
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create client with baseUrl', () => {
      const c = new BridgeShieldClient({ baseUrl: 'https://test.com' });
      expect(c).toBeInstanceOf(BridgeShieldClient);
    });

    it('should trim trailing slash from baseUrl', () => {
      const c = new BridgeShieldClient({ baseUrl: 'https://test.com/' });
      expect(c).toBeInstanceOf(BridgeShieldClient);
    });

    it('should use default timeout of 5000ms', () => {
      const c = new BridgeShieldClient({ baseUrl: 'https://test.com' });
      expect(c).toBeInstanceOf(BridgeShieldClient);
    });
  });

  describe('checkAddress', () => {
    it('should call /api/v1/aml/check with correct params', async () => {
      const mockResponse = {
        checkId: 'chk_123',
        address: '0x1234567890abcdef1234567890abcdef12345678',
        chainId: 1,
        riskScore: 85,
        riskLevel: 'HIGH',
        decision: 'BLOCK',
        isWhitelisted: false,
        cacheHit: false,
      };
      
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const result = await client.checkAddress({
        address: '0x1234567890abcdef1234567890abcdef12345678',
        chainId: 1,
      });

      expect(fetch).toHaveBeenCalledWith(
        'https://api.test.bridgeshield.io/api/v1/aml/check',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ address: '0x1234567890abcdef1234567890abcdef12345678', chainId: 1 }),
        })
      );
      expect(result.checkId).toBe('chk_123');
      expect(result.riskScore).toBe(85);
    });

    it('should throw ValidationError when address is empty', async () => {
      await expect(
        client.checkAddress({ address: '' })
      ).rejects.toThrow('Address is required');
    });

    it('should throw ApiError on 4xx response', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ message: 'Invalid address format' }),
      } as Response);

      await expect(
        client.checkAddress({ address: '0x123' })
      ).rejects.toThrow('Invalid address format');
    });

    it('should throw ApiError on 5xx response', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ message: 'Internal server error' }),
      } as Response);

      await expect(
        client.checkAddress({ address: '0x123' })
      ).rejects.toThrow('Internal server error');
    });

    it('should throw NetworkError on network failure', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'));

      await expect(
        client.checkAddress({ address: '0x123' })
      ).rejects.toThrow('Failed to fetch');
    });

    it('should include optional params when provided', async () => {
      const mockResponse = {
        checkId: 'chk_123',
        address: '0x123',
        chainId: 1,
        riskScore: 50,
        riskLevel: 'MEDIUM',
        decision: 'REVIEW',
        isWhitelisted: false,
        cacheHit: false,
      };
      
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      await client.checkAddress({
        address: '0x123',
        chainId: 1,
        amount: '1000',
        senderAddress: '0xabc',
      });

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            address: '0x123',
            chainId: 1,
            amount: '1000',
            senderAddress: '0xabc',
          }),
        })
      );
    });
  });

  describe('submitAppeal', () => {
    it('should call /api/v1/aml/appeal with correct params', async () => {
      const mockResponse = {
        ticketId: 'APT-20260410-001',
        address: '0x123',
        chainId: 1,
        status: 'PENDING',
        estimatedReviewAt: '2026-04-17T00:00:00.000Z',
        message: 'Appeal submitted',
        nextSteps: ['Wait for review'],
      };
      
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const result = await client.submitAppeal({
        address: '0x123',
        reason: 'My address was flagged incorrectly',
        contact: 'user@example.com',
      });

      expect(result.ticketId).toBe('APT-20260410-001');
      expect(result.status).toBe('PENDING');
    });

    it('should throw ValidationError when address is empty', async () => {
      await expect(
        client.submitAppeal({ address: '', reason: 'Test reason' })
      ).rejects.toThrow('Address is required');
    });

    it('should throw ValidationError when reason is empty', async () => {
      await expect(
        client.submitAppeal({ address: '0x123', reason: '' })
      ).rejects.toThrow('Reason is required');
    });

    it('should throw ApiError on 409 conflict', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: () => Promise.resolve({ message: 'Appeal already exists' }),
      } as Response);

      await expect(
        client.submitAppeal({ address: '0x123', reason: 'Test' })
      ).rejects.toThrow('Appeal already exists');
    });
  });

  describe('getAppealStatus', () => {
    it('should call /api/v1/aml/appeal/status/:ticketId', async () => {
      const mockResponse = {
        ticketId: 'APT-20260410-001',
        status: 'PENDING',
        createdAt: '2026-04-10T00:00:00.000Z',
        estimatedReviewAt: '2026-04-17T00:00:00.000Z',
      };
      
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const result = await client.getAppealStatus('APT-20260410-001');

      expect(fetch).toHaveBeenCalledWith(
        'https://api.test.bridgeshield.io/api/v1/aml/appeal/status/APT-20260410-001',
        expect.any(Object)
      );
      expect(result.ticketId).toBe('APT-20260410-001');
    });

    it('should throw ValidationError when ticketId is empty', async () => {
      await expect(
        client.getAppealStatus('')
      ).rejects.toThrow('Ticket ID is required');
    });

    it('should throw ApiError on 404', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ message: 'Appeal not found' }),
      } as Response);

      await expect(
        client.getAppealStatus('APT-INVALID')
      ).rejects.toThrow('Appeal not found');
    });
  });

  describe('getWhitelistSummary', () => {
    it('should call /api/v1/aml/whitelist', async () => {
      const mockResponse = {
        total: 25,
        categories: [{ category: 'KNOWN_PROTOCOL', count: 15 }],
        lastSyncedAt: '2026-04-10T00:00:00.000Z',
        version: '0.0.0',
      };
      
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const result = await client.getWhitelistSummary();

      expect(fetch).toHaveBeenCalledWith(
        'https://api.test.bridgeshield.io/api/v1/aml/whitelist',
        expect.any(Object)
      );
      expect(result.total).toBe(25);
    });
  });

  describe('healthCheck', () => {
    it('should call /api/v1/health', async () => {
      const mockResponse = {
        status: 'healthy',
        timestamp: '2026-04-10T00:00:00.000Z',
        version: '0.0.0',
        uptime: '3600s',
        services: {
          database: { healthy: true, status: 'connected' },
          riskData: { healthy: true, status: 'loaded' },
          cache: { healthy: true, status: 'ready' },
          redis: 'disabled',
        },
      };
      
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const result = await client.healthCheck();

      expect(result.status).toBe('healthy');
      expect(result.version).toBe('0.0.0');
    });

    it('should return degraded status when services are down', async () => {
      const mockResponse = {
        status: 'degraded',
        timestamp: '2026-04-10T00:00:00.000Z',
        version: '0.0.0',
        uptime: '3600s',
        services: {
          database: { healthy: false, status: 'disconnected' },
          riskData: { healthy: true, status: 'loaded' },
          cache: { healthy: true, status: 'ready' },
          redis: 'disabled',
        },
      };
      
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const result = await client.healthCheck();

      expect(result.status).toBe('degraded');
    });
  });

  describe('setBaseUrl', () => {
    it('should update baseUrl for subsequent calls', async () => {
      const mockResponse = { status: 'healthy' };
      
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      client.setBaseUrl('https://new-api.test.com');
      await client.healthCheck();

      expect(fetch).toHaveBeenCalledWith(
        'https://new-api.test.com/api/v1/health',
        expect.any(Object)
      );
    });
  });

  describe('setApiKey', () => {
    it('should include Authorization header when apiKey is set', async () => {
      const mockResponse = { status: 'healthy' };
      
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      client.setApiKey('test-api-key-123');
      await client.healthCheck();

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key-123',
          }),
        })
      );
    });
  });
});
