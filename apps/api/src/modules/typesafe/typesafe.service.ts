import { Injectable, Logger } from '@nestjs/common';
import { TypeSafeClient, choice, noul } from '@typesafe-ai/sdk';
import { loadEnv } from '../../config/env';

export interface SpamJudgmentResult {
  isPromoSpamScore: number;
  category: string;
  fromFallback?: boolean;
}

@Injectable()
export class TypeSafeService {
  private readonly logger = new Logger(TypeSafeService.name);
  private client: TypeSafeClient | null = null;

  constructor() {
    const env = loadEnv();
    if (env.TYPESAFE_API_KEY) {
      this.client = new TypeSafeClient({ apiKey: env.TYPESAFE_API_KEY });
    } else {
      this.logger.warn(
        'TYPESAFE_API_KEY not configured. Mock judgments or fallback will be used if invoked.',
      );
    }
  }

  setClient(client: TypeSafeClient | null): void {
    this.client = client;
  }

  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
  ): Promise<T> {
    let timer: NodeJS.Timeout | null = null;
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`Timeout after ${timeoutMs}ms`));
        }, timeoutMs);
      });

      const opPromise = operation();
      // Prevent unhandled promise rejection if operation fails after timeout
      opPromise.catch(() => {});

      return await Promise.race([opPromise, timeoutPromise]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }

  async judgeSpam(groupName: string, text: string): Promise<SpamJudgmentResult> {
    if (!this.client) {
      this.logger.warn('Calling judgeSpam without TYPESAFE_API_KEY configured');
      return {
        isPromoSpamScore: 0,
        category: 'organic_or_legitimate',
        fromFallback: true,
      };
    }

    const MAX_ATTEMPTS = 2;
    const TIMEOUT_MS = 2000;

    const callJev = async (): Promise<SpamJudgmentResult> => {
      const response = await this.client!.systemOne(
        {
          model: 'jev-latest',
          state: {
            group_name: groupName,
            message: text,
          },
          questions: {
            is_promo_spam: noul(
              'A mensagem em `message` é uma divulgação não solicitada de grupo externo, golpe ou spam em massa no grupo `group_name`?',
              {
                true: 'Broadcast impessoal promovendo grupos externos (vagas, sorteios, PIX, links de WhatsApp/Telegram), sem relação com a conversa.',
                false: 'Conversa legítima entre membros, link contextualmente relevante ou resposta tirando dúvida.',
              },
            ),
            spam_category: choice('Qual a categoria desta mensagem?', {
              blatant_broadcast_spam: 'Divulgação ostensiva, spam em massa ou golpe',
              soft_promotion: 'Convite moderado ou autopromoção',
              organic_or_legitimate: 'Conversa legítima ou resposta comum',
            }),
          },
        },
        {
          timeout: TIMEOUT_MS,
          retry: { maxRetries: 0 },
        },
      );

      const score = response.answers?.is_promo_spam?.noul ?? 0;
      const category = response.answers?.spam_category?.choice ?? 'organic_or_legitimate';

      return {
        isPromoSpamScore: score,
        category,
        fromFallback: false,
      };
    };

    // Resiliência Fail-Open: 2 tentativas rápidas (timeout de 2s por chamada)
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const result = await this.executeWithTimeout(callJev, TIMEOUT_MS);
        this.logger.log(
          `Jev evaluation for group "${groupName}" (attempt ${attempt}): score=${result.isPromoSpamScore}, category=${result.category}`,
        );
        return result;
      } catch (err: any) {
        if (attempt < MAX_ATTEMPTS) {
          this.logger.warn(
            `Jev evaluation attempt ${attempt} failed: ${err?.message || err}. Retrying...`,
          );
        } else {
          this.logger.warn(
            `Jev evaluation failed after ${MAX_ATTEMPTS} attempts (${err?.message || err}). Failing open to protect chat flow.`,
          );
        }
      }
    }

    return {
      isPromoSpamScore: 0,
      category: 'organic_or_legitimate',
      fromFallback: true,
    };
  }
}
