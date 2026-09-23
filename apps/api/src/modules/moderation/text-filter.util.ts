/**
 * Utility functions to extract message content and test for links or suspicious spam patterns.
 */

const URL_REGEX = /(?:https?:\/\/|www\.)[^\s/$.?#].[^\s]*/i;
const WA_GROUP_REGEX = /chat\.whatsapp\.com\/[A-Za-z0-9_-]+/i;
const WA_ME_REGEX = /wa\.me\/[0-9]+/i;
const TELEGRAM_REGEX = /(?:t\.me|telegram\.me)\/[A-Za-z0-9_+]+/i;
const SHORTENERS_REGEX = /(?:bit\.ly|tinyurl\.com|is\.gd|cutt\.ly|linktr\.ee|shope\.ee|s\.shopee|kwai-app\.com)\/[A-Za-z0-9_-]+/i;

const SPAM_KEYWORDS = [
  /grupo\s+(?:vip|de\s+vagas|no\s+whatsapp|do\s+telegram)/i,
  /entre\s+no\s+(?:nosso\s+)?grupo/i,
  /link\s+do\s+grupo/i,
  /renda\s+extra/i,
  /ganhe\s+dinheiro/i,
  /trabalhe\s+de\s+casa/i,
  /pix\s+(?:imediato|na\s+hora|em\s+dobro)/i,
  /vagas?\s+(?:urgentes?|abertas?|home\s*office)/i,
  /cadastre-se\s+e\s+ganhe/i,
  /clique\s+no\s+link/i,
  /acesse\s+o\s+link/i,
];

export function extractMessageText(messageObj: any): string | null {
  if (!messageObj) return null;

  // Direct text
  if (messageObj.conversation) {
    return messageObj.conversation;
  }

  // Extended text
  if (messageObj.extendedTextMessage?.text) {
    return messageObj.extendedTextMessage.text;
  }

  // Image caption
  if (messageObj.imageMessage?.caption) {
    return messageObj.imageMessage.caption;
  }

  // Video caption
  if (messageObj.videoMessage?.caption) {
    return messageObj.videoMessage.caption;
  }

  // Document caption
  if (messageObj.documentMessage?.caption) {
    return messageObj.documentMessage.caption;
  }

  // Template or button reply
  if (messageObj.buttonsResponseMessage?.selectedButtonId) {
    return messageObj.buttonsResponseMessage.selectedDisplayText || messageObj.buttonsResponseMessage.selectedButtonId;
  }

  if (messageObj.templateButtonReplyMessage?.selectedId) {
    return messageObj.templateButtonReplyMessage.selectedDisplayText || messageObj.templateButtonReplyMessage.selectedId;
  }

  return null;
}

export function containsSuspiciousPatternOrLink(text: string): boolean {
  if (!text || typeof text !== 'string') return false;

  const normalized = text.trim();
  if (normalized.length === 0) return false;

  // 1. Direct link matches
  if (
    URL_REGEX.test(normalized) ||
    WA_GROUP_REGEX.test(normalized) ||
    WA_ME_REGEX.test(normalized) ||
    TELEGRAM_REGEX.test(normalized) ||
    SHORTENERS_REGEX.test(normalized)
  ) {
    return true;
  }

  // 2. Suspicious spam promo keywords
  for (const keywordRegex of SPAM_KEYWORDS) {
    if (keywordRegex.test(normalized)) {
      return true;
    }
  }

  return false;
}
