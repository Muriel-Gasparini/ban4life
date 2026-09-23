import React, { useEffect, useState } from 'react';
import { SpamLogDto } from '@linkeshield/types';
import { Radio, ShieldAlert, Sparkles, UserX, Clock, MessageSquare } from 'lucide-react';

interface SpamFeedProps {
  token: string | null;
  logs: SpamLogDto[];
  onInitialLogsLoaded?: (logs: SpamLogDto[]) => void;
}

export const SpamFeed: React.FC<SpamFeedProps> = ({
  token,
  logs,
  onInitialLogsLoaded,
}) => {
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!token) return;
    const fetchLogs = async () => {
      try {
        setIsLoading(true);
        const res = await fetch('/api/logs?limit=50', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const initialLogs: SpamLogDto[] = await res.json();
          onInitialLogsLoaded?.(initialLogs);
        }
      } catch (err) {
        console.error('Failed to load initial spam logs', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchLogs();
  }, [token, onInitialLogsLoaded]);

  const formatSender = (senderJid: string) => {
    const raw = senderJid.split('@')[0].split(':')[0];
    if (raw.length >= 12) {
      // Brazil format: +55 (DD) 9XXXX-XXXX
      return `+${raw.slice(0, 2)} ${raw.slice(2, 4)} ${raw.slice(4)}`;
    }
    return `+${raw}`;
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'blatant_broadcast_spam':
        return 'Spam Ostensivo / Golpe';
      case 'soft_promotion':
        return 'Autopromoção';
      default:
        return category;
    }
  };

  return (
    <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-2xl p-5 shadow-xl flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Radio className="h-5 w-5 text-emerald-400 animate-pulse" />
            Feed em Tempo Real (SSE)
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Intercepções e banimentos executados autonomamente pelo bot
          </p>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-semibold">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
          AO VIVO
        </div>
      </div>

      <div className="flex-1 overflow-y-auto max-h-[500px] pr-1 space-y-3">
        {logs.length === 0 ? (
          <div className="text-center py-16 px-4 rounded-xl border border-dashed border-zinc-800 text-zinc-500">
            {isLoading ? (
              <span className="text-xs">Carregando feed de moderação...</span>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <ShieldAlert className="h-8 w-8 text-zinc-600" />
                <p className="text-xs text-zinc-400">Nenhum spam detectado recentemente.</p>
                <p className="text-[11px] text-zinc-600">
                  Assim que mensagens suspeitas forem interceptadas nos grupos ativos, elas aparecerão aqui em tempo real.
                </p>
              </div>
            )}
          </div>
        ) : (
          logs.map((log) => {
            const scorePercent = Math.round(log.jevScore * 100);
            return (
              <div
                key={log.id}
                className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800/90 hover:border-zinc-700 transition-all space-y-2.5 animate-in slide-in-from-top-2 duration-300"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="p-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 shrink-0">
                      <UserX className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-zinc-200 truncate block">
                        {log.groupName}
                      </span>
                      <span className="text-[11px] font-mono text-zinc-400">
                        {formatSender(log.senderJid)}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end shrink-0">
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                      <Sparkles className="h-3 w-3 text-red-400" />
                      {scorePercent}% Jev
                    </span>
                    <span className="text-[10px] text-zinc-500 flex items-center gap-1 mt-1">
                      <Clock className="h-3 w-3" />
                      {formatTime(log.createdAt)}
                    </span>
                  </div>
                </div>

                {/* Message preview */}
                <div className="p-2.5 rounded-lg bg-zinc-900/90 border border-zinc-800/80 text-xs text-zinc-300 font-mono flex items-start gap-2">
                  <MessageSquare className="h-3.5 w-3.5 text-zinc-500 shrink-0 mt-0.5" />
                  <p className="line-clamp-3 break-words text-[11px]">{log.messageText}</p>
                </div>

                <div className="flex items-center justify-between text-[10px] text-zinc-500">
                  <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
                    {getCategoryLabel(log.jevCategory)}
                  </span>
                  <span className="text-emerald-500 font-medium">
                    Apagado & Banido Instantaneamente
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
