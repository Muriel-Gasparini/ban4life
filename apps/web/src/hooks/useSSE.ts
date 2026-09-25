import { useEffect, useRef } from 'react';
import { BaileysStatus, GroupDto, SpamLogDto } from '@ban4life/types';

interface UseSSEOptions {
  token: string | null;
  onStatus?: (status: BaileysStatus) => void;
  onSpam?: (spam: SpamLogDto) => void;
  onGroup?: (group: GroupDto) => void;
}

export function useSSE({ token, onStatus, onSpam, onGroup }: UseSSEOptions) {
  const eventSourceRef = useRef<EventSource | null>(null);

  // Keep latest callbacks in refs to avoid reconnecting on every render
  const onStatusRef = useRef(onStatus);
  const onSpamRef = useRef(onSpam);
  const onGroupRef = useRef(onGroup);

  useEffect(() => {
    onStatusRef.current = onStatus;
  }, [onStatus]);

  useEffect(() => {
    onSpamRef.current = onSpam;
  }, [onSpam]);

  useEffect(() => {
    onGroupRef.current = onGroup;
  }, [onGroup]);

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
            onStatusRef.current?.(payload.data.status);
            break;
          case 'spam':
            onSpamRef.current?.(payload.data);
            break;
          case 'group':
            onGroupRef.current?.(payload.data);
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
  }, [token]);
}
