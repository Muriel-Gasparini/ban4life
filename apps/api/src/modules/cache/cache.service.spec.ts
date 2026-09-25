import { CacheService } from './cache.service';

describe('CacheService', () => {
  let cacheService: CacheService;

  beforeEach(() => {
    cacheService = new CacheService();
  });

  it('should store and retrieve cached verdicts', () => {
    const text = 'Entre no nosso grupo vip: chat.whatsapp.com/123';
    const verdict = { isPromoSpamScore: 0.98, category: 'blatant_broadcast_spam' };

    expect(cacheService.get(text)).toBeUndefined();
    expect(cacheService.has(text)).toBe(false);

    cacheService.set(text, verdict);

    expect(cacheService.has(text)).toBe(true);
    expect(cacheService.get(text)).toEqual(verdict);
  });

  it('should normalize whitespace and casing when computing hash', () => {
    const text1 = '  Entre no   nosso grupo VIP!  ';
    const text2 = 'entre no nosso grupo vip!';
    const verdict = { isPromoSpamScore: 0.95, category: 'blatant_broadcast_spam' };

    cacheService.set(text1, verdict);

    expect(cacheService.get(text2)).toEqual(verdict);
    expect(cacheService.hashText(text1)).toBe(cacheService.hashText(text2));
  });

  it('should return undefined for empty or falsy text', () => {
    expect(cacheService.get('')).toBeUndefined();
    expect(cacheService.has('')).toBe(false);
  });

  it('should clear cache properly', () => {
    cacheService.set('some spam', { isPromoSpamScore: 0.9, category: 'blatant_broadcast_spam' });
    expect(cacheService.size).toBe(1);

    cacheService.clear();
    expect(cacheService.size).toBe(0);
    expect(cacheService.get('some spam')).toBeUndefined();
  });
});
