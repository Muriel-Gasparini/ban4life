export interface SpamLogDto {
  id: string;
  groupJid: string;
  groupName: string;
  senderJid: string;
  messageText: string;
  jevScore: number;
  jevCategory: string;
  actionTaken: string;
  createdAt: number;
}
