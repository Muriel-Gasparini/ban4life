import {
  extractMessageText,
  containsSuspiciousPatternOrLink,
} from './text-filter.util';

describe('text-filter.util', () => {
  describe('extractMessageText', () => {
    it('should return null for undefined or empty message object', () => {
      expect(extractMessageText(undefined)).toBeNull();
      expect(extractMessageText(null)).toBeNull();
      expect(extractMessageText({})).toBeNull();
    });

    it('should extract plain conversation text', () => {
      const msg = { conversation: 'Olá pessoal, tudo bem?' };
      expect(extractMessageText(msg)).toBe('Olá pessoal, tudo bem?');
    });

    it('should extract extendedTextMessage text', () => {
      const msg = { extendedTextMessage: { text: 'Confira nosso novo site!' } };
      expect(extractMessageText(msg)).toBe('Confira nosso novo site!');
    });

    it('should extract image caption', () => {
      const msg = { imageMessage: { caption: 'Foto do evento' } };
      expect(extractMessageText(msg)).toBe('Foto do evento');
    });

    it('should extract video caption', () => {
      const msg = { videoMessage: { caption: 'Vídeo da apresentação' } };
      expect(extractMessageText(msg)).toBe('Vídeo da apresentação');
    });

    it('should extract document caption', () => {
      const msg = { documentMessage: { caption: 'Relatório em PDF' } };
      expect(extractMessageText(msg)).toBe('Relatório em PDF');
    });
  });

  describe('containsSuspiciousPatternOrLink', () => {
    it('should return false for empty or non-string inputs', () => {
      expect(containsSuspiciousPatternOrLink('')).toBe(false);
      expect(containsSuspiciousPatternOrLink('   ')).toBe(false);
      expect(containsSuspiciousPatternOrLink(null as any)).toBe(false);
      expect(containsSuspiciousPatternOrLink(undefined as any)).toBe(false);
    });

    it('should return false for organic conversation without links or spam patterns', () => {
      expect(containsSuspiciousPatternOrLink('Bom dia, alguém sabe que horas começa a reunião?')).toBe(false);
      expect(containsSuspiciousPatternOrLink('Valeu pelo feedback, vou ajustar o código!')).toBe(false);
      expect(containsSuspiciousPatternOrLink('Parabéns pela conquista!')).toBe(false);
    });

    it('should detect standard http and https URLs', () => {
      expect(containsSuspiciousPatternOrLink('Acesse https://exemplo.com para conferir')).toBe(true);
      expect(containsSuspiciousPatternOrLink('Veja http://meusite.com/promocao')).toBe(true);
      expect(containsSuspiciousPatternOrLink('Entrem em www.promocao-pix.com')).toBe(true);
    });

    it('should detect WhatsApp group invite links', () => {
      expect(
        containsSuspiciousPatternOrLink('Entrem no grupo novo: https://chat.whatsapp.com/ABC12345XYZ'),
      ).toBe(true);
      expect(
        containsSuspiciousPatternOrLink('chat.whatsapp.com/Ghi7890JKL'),
      ).toBe(true);
    });

    it('should detect wa.me direct links', () => {
      expect(containsSuspiciousPatternOrLink('Me chama no privado: wa.me/5511999999999')).toBe(true);
    });

    it('should detect Telegram invite links', () => {
      expect(containsSuspiciousPatternOrLink('Grupo de vagas no telegram: t.me/vagasremotas')).toBe(true);
      expect(containsSuspiciousPatternOrLink('Entre em telegram.me/canalvip')).toBe(true);
    });

    it('should detect URL shorteners', () => {
      expect(containsSuspiciousPatternOrLink('Clique aqui bit.ly/rendaextra2026')).toBe(true);
      expect(containsSuspiciousPatternOrLink('tinyurl.com/vagas-abertas')).toBe(true);
      expect(containsSuspiciousPatternOrLink('linktr.ee/promocoes')).toBe(true);
    });

    it('should detect suspicious spam promo phrases', () => {
      expect(containsSuspiciousPatternOrLink('Quer renda extra trabalhando poucas horas?')).toBe(true);
      expect(containsSuspiciousPatternOrLink('Ganhe dinheiro rápido na sua conta')).toBe(true);
      expect(containsSuspiciousPatternOrLink('Entre no nosso grupo exclusivo')).toBe(true);
      expect(containsSuspiciousPatternOrLink('Temos vagas home office urgentes')).toBe(true);
      expect(containsSuspiciousPatternOrLink('Faça o cadastro e clique no link')).toBe(true);
    });
  });
});
