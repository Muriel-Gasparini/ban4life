import { useEffect, useRef } from 'react';
import { BaileysStatus, GroupDto, SpamLogDto } from '@linkeshield/types';

interface UseSSEOptions {
  token: string | null;
  onStatus?: (status: BaileysStatus) => void;
  onSpam?: (spam: SpamLogDto) => void;
  onGroup?: (group: GroupDto) => void;
}

export function useSSE({ token, onStatus, onSpam, onGroup }: UseSSEOptions) {
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!token) return;

    const url = `/api/events?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (!payload || !payload.type) return;

        switch (payload.type) {
          case 'status':
            onStatus?.(payload.data.status);
            break;
          case 'spam':
            onSpam?.(payload.data);
            break;
          case 'group':
            onGroup?.(payload.data);
            break;
          case 'ping':
            // heartbeat ping
            break;
        }
      } catch (err) {
        console.error('Failed to parse SSE event data', err);
      }
    };

    es.onerror = (err) => {
      console.warn('SSE connection error, retrying...', err);
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [token, onStatus, onSpam, onGroup]);
}
