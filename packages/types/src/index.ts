export * from './groups';
export * from './logs';
export * from './settings';

export type BaileysStatus = 'disconnected' | 'connecting' | 'waiting_qr' | 'connected';

export interface BaileysStatusDto {
  status: BaileysStatus;
}

export interface BaileysQrDto {
  qr: string | null;
}

export interface AuthLoginResponseDto {
  token: string;
}

export type SseEventType = 'status' | 'spam' | 'group' | 'ping';

export interface SseEvent<T = unknown> {
  type: SseEventType;
  data: T;
}
