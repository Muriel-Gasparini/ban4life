import { TypeSafeService } from './typesafe.service';

describe('TypeSafeService', () => {
  it('should return fallback if client is not configured', async () => {
    // Service created without client
    const service = new TypeSafeService();
    // Force client to null
    (service as any).client = null;

    const result = await service.judgeSpam('Grupo Teste', 'Olá amigos');
    expect(result.isPromoSpamScore).toBe(0);
    expect(result.category).toBe('organic_or_legitimate');
    expect(result.fromFallback).toBe(true);
  });

  it('should return judgment with fromFallback false on successful API call', async () => {
    const mockClient = {
      systemOne: jest.fn().mockResolvedValue({
        answers: {
          is_promo_spam: { noul: 0.94 },
          spam_category: { choice: 'blatant_broadcast_spam' },
        },
      }),
    };

    const service = new TypeSafeService();
    service.setClient(mockClient as any);
    const result = await service.judgeSpam('Vagas SP', 'Acesse nosso grupo vip');

    expect(result.isPromoSpamScore).toBe(0.94);
    expect(result.category).toBe('blatant_broadcast_spam');
    expect(result.fromFallback).toBe(false);
    expect(mockClient.systemOne).toHaveBeenCalledTimes(1);
    expect(mockClient.systemOne).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'jev-latest',
        state: {
          group_name: 'Vagas SP',
          message: 'Acesse nosso grupo vip',
        },
      }),
      expect.objectContaining({
        timeout: 2000,
        retry: { maxRetries: 0 },
      }),
    );
  });

  it('should retry on attempt 1 failure and return successful attempt 2', async () => {
    const mockClient = {
      systemOne: jest
        .fn()
        .mockRejectedValueOnce(new Error('Network oscillation'))
        .mockResolvedValueOnce({
          answers: {
            is_promo_spam: { noul: 0.99 },
            spam_category: { choice: 'blatant_broadcast_spam' },
          },
        }),
    };

    const service = new TypeSafeService();
    service.setClient(mockClient as any);
    const result = await service.judgeSpam('Grupo 1', 'Spam texto');

    expect(result.isPromoSpamScore).toBe(0.99);
    expect(result.fromFallback).toBe(false);
    expect(mockClient.systemOne).toHaveBeenCalledTimes(2);
  });

  it('should fail open after 2 failed attempts returning score 0 and fromFallback true', async () => {
    const mockClient = {
      systemOne: jest
        .fn()
        .mockRejectedValue(new Error('Persistent API outage')),
    };

    const service = new TypeSafeService();
    service.setClient(mockClient as any);
    const result = await service.judgeSpam('Grupo 1', 'Texto qualquer');

    expect(result.isPromoSpamScore).toBe(0);
    expect(result.category).toBe('organic_or_legitimate');
    expect(result.fromFallback).toBe(true);
    expect(mockClient.systemOne).toHaveBeenCalledTimes(2);
  });

  it('should fail open when API call hangs beyond timeout', async () => {
    let pendingTimer: any;
    const mockClient = {
      systemOne: jest.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            pendingTimer = setTimeout(resolve, 5000);
            if (pendingTimer?.unref) pendingTimer.unref();
          }),
      ),
    };

    const service = new TypeSafeService();
    service.setClient(mockClient as any);
    const result = await service.judgeSpam('Grupo 1', 'Timeout text');

    if (pendingTimer) clearTimeout(pendingTimer);
    expect(result.isPromoSpamScore).toBe(0);
    expect(result.fromFallback).toBe(true);
  }, 10000);
});
