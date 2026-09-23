import { Injectable, Logger } from '@nestjs/common';
import { TypeSafeClient, choice, noul } from '@typesafe-ai/sdk';
import { loadEnv } from '../../config/env';

export interface SpamJudgmentResult {
  isPromoSpamScore: number;
  category: string;
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

  async judgeSpam(groupName: string, text: string): Promise<SpamJudgmentResult> {
    if (!this.client) {
      this.logger.warn('Calling judgeSpam without TYPESAFE_API_KEY configured');
      return {
        isPromoSpamScore: 0,
        category: 'organic_or_legitimate',
      };
    }

    try {
      const response = await this.client.systemOne({
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
      });

      const score = response.answers?.is_promo_spam?.noul ?? 0;
      const category = response.answers?.spam_category?.choice ?? 'organic_or_legitimate';

      this.logger.log(
        `Jev evaluation for group "${groupName}": score=${score}, category=${category}`,
      );

      return {
        isPromoSpamScore: score,
        category,
      };
    } catch (error: any) {
      this.logger.error(`Error calling TypeSafe Jev API: ${error?.message || error}`);
      throw error;
    }
  }
}
