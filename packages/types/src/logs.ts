export interface SpamLogDto {
  id: string;
  groupJid: string;
  groupName: string;
  senderJid: string;
  senderName?: string | null;
  senderPhone?: string | null;
  messageText: string;
  jevScore: number;
  jevCategory: string;
  actionTaken: string;
  isCrossGroupBan?: boolean;
  createdAt: number;
}

export interface MetricsDto {
  totalEvaluated: number;
  totalSpamsBanned: number;
  cacheHits: number;
}
