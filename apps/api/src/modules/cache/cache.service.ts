import { Injectable, Logger } from '@nestjs/common';
import { LRUCache } from 'lru-cache';
import * as crypto from 'crypto';

export interface CachedVerdict {
  isPromoSpamScore: number;
  category: string;
  fromFallback?: boolean;
}

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly cache: LRUCache<string, CachedVerdict>;

  constructor() {
    this.cache = new LRUCache<string, CachedVerdict>({
      max: 5000,
      ttl: 1000 * 60 * 60, // 1 hour TTL
    });
  }

  hashText(text: string): string {
    const normalized = text.trim().toLowerCase().replace(/\s+/g, ' ');
    return crypto.createHash('sha256').update(normalized).digest('hex');
  }

  get(text: string): CachedVerdict | undefined {
    if (!text) return undefined;
    const hash = this.hashText(text);
    const result = this.cache.get(hash);
    if (result) {
      this.logger.debug(`Cache hit for text hash ${hash}`);
    }
    return result;
  }

  set(text: string, verdict: CachedVerdict): void {
    if (!text) return;
    const hash = this.hashText(text);
    this.cache.set(hash, verdict);
    this.logger.debug(`Cached verdict for hash ${hash}: score=${verdict.isPromoSpamScore}`);
  }

  has(text: string): boolean {
    if (!text) return false;
    const hash = this.hashText(text);
    return this.cache.has(hash);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}
