export interface SettingsDto {
  deleteSpamMessage: boolean;
  sendBanNotice: boolean;
  banNoticeTemplate: string;
  banThreshold: number;
}

export interface UpdateSettingsDto {
  deleteSpamMessage?: boolean;
  sendBanNotice?: boolean;
  banNoticeTemplate?: string;
  banThreshold?: number;
}
