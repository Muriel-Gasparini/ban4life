export interface SettingsDto {
  sendBanNotice: boolean;
  banNoticeTemplate: string;
  banThreshold: number;
}

export interface UpdateSettingsDto {
  sendBanNotice?: boolean;
  banNoticeTemplate?: string;
  banThreshold?: number;
}
