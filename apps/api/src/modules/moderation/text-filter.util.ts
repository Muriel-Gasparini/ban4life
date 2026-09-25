/**
 * Utility functions to extract message content and normalize text from WhatsApp messages.
 * Note: Under the Pure Jev architecture, we DO NOT filter or match text using regex.
 * All text extraction and unwrap logic is handled here for Jev evaluation.
 */

/**
 * Unwraps nested WhatsApp messages (e.g. ephemeral, view-once, documents, edited).
 */
export function unwrapMessage(messageObj: any): any {
  let current = messageObj;
  while (current && typeof current === 'object') {
    if (current.ephemeralMessage?.message) {
      current = current.ephemeralMessage.message;
    } else if (current.viewOnceMessage?.message) {
      current = current.viewOnceMessage.message;
    } else if (current.viewOnceMessageV2?.message) {
      current = current.viewOnceMessageV2.message;
    } else if (current.documentWithCaptionMessage?.message) {
      current = current.documentWithCaptionMessage.message;
    } else if (current.editedMessage?.message) {
      current = current.editedMessage.message;
    } else if (current.protocolMessage?.editedMessage) {
      current = current.protocolMessage.editedMessage;
    } else {
      break;
    }
  }
  return current;
}

/**
 * Extracts pure text or media captions (image, video, document) from a WhatsApp message object.
 * Returns null if the message contains no text/caption (e.g., pure image/media with no caption).
 */
export function extractMessageText(messageObj: any): string | null {
  if (!messageObj) return null;

  const unwrapped = unwrapMessage(messageObj);
  if (!unwrapped) return null;

  // Direct text
  if (typeof unwrapped.conversation === 'string' && unwrapped.conversation.trim().length > 0) {
    return unwrapped.conversation.trim();
  }

  // Extended text
  if (unwrapped.extendedTextMessage?.text && typeof unwrapped.extendedTextMessage.text === 'string') {
    const trimmed = unwrapped.extendedTextMessage.text.trim();
    if (trimmed.length > 0) return trimmed;
  }

  // Image caption
  if (unwrapped.imageMessage?.caption && typeof unwrapped.imageMessage.caption === 'string') {
    const trimmed = unwrapped.imageMessage.caption.trim();
    if (trimmed.length > 0) return trimmed;
  }

  // Video caption
  if (unwrapped.videoMessage?.caption && typeof unwrapped.videoMessage.caption === 'string') {
    const trimmed = unwrapped.videoMessage.caption.trim();
    if (trimmed.length > 0) return trimmed;
  }

  // Document caption
  if (unwrapped.documentMessage?.caption && typeof unwrapped.documentMessage.caption === 'string') {
    const trimmed = unwrapped.documentMessage.caption.trim();
    if (trimmed.length > 0) return trimmed;
  }

  // Template or button reply
  if (unwrapped.buttonsResponseMessage?.selectedDisplayText) {
    return unwrapped.buttonsResponseMessage.selectedDisplayText.trim();
  }

  if (unwrapped.templateButtonReplyMessage?.selectedDisplayText) {
    return unwrapped.templateButtonReplyMessage.selectedDisplayText.trim();
  }

  if (unwrapped.listResponseMessage?.title) {
    return unwrapped.listResponseMessage.title.trim();
  }

  return null;
}

/**
 * Normalizes text for consistent hashing and comparisons.
 */
export function normalizeMessageText(text: string): string {
  if (!text) return '';
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}
