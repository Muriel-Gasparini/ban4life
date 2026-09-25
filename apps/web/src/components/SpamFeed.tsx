import React, { useEffect, useState } from 'react';
import { SpamLogDto } from '@ban4life/types';
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
  const onInitialLogsLoadedRef = React.useRef(onInitialLogsLoaded);

  useEffect(() => {
    onInitialLogsLoadedRef.current = onInitialLogsLoaded;
  }, [onInitialLogsLoaded]);

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
          onInitialLogsLoadedRef.current?.(initialLogs);
        }
      } catch (err) {
        console.error('Failed to load initial spam logs', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchLogs();
  }, [token]);

  const formatPhoneNumber = (phone: string): string => {
    const clean = phone.replace(/\D/g, '');
    if (clean.startsWith('55') && (clean.length === 12 || clean.length === 13)) {
      // Brazil format: +55 (DD) 9XXXX-XXXX or +55 (DD) XXXX-XXXX
      const ddd = clean.slice(2, 4);
      const rest = clean.slice(4);
      if (rest.length === 9) {
        return `+55 (${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
      }
      return `+55 (${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
    }
    return `+${clean}`;
  };

  const getSenderDisplay = (log: SpamLogDto) => {
    let realPhone: string | null = log.senderPhone?.trim() || null;

    if (!realPhone && log.senderJid) {
      const isLid = log.senderJid.endsWith('@lid') || log.senderJid.includes('@lid');
      if (!isLid && log.senderJid.endsWith('@s.whatsapp.net')) {
        const raw = log.senderJid.split('@')[0].split(':')[0];
        if (/^\d{8,15}$/.test(raw)) {
          realPhone = raw;
        }
      }
    }

    const name = log.senderName?.trim() || null;
    const formattedPhone = realPhone ? formatPhoneNumber(realPhone) : null;

    return { name, formattedPhone };
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
    <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-2xl p-5 sm:p-6 shadow-xl flex flex-col h-full">
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

        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
          AO VIVO
        </div>
      </div>

      <div className="flex-1 overflow-y-auto max-h-[calc(100vh-270px)] min-h-[460px] pr-1.5 space-y-3.5">
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
            const { name, formattedPhone } = getSenderDisplay(log);
            return (
              <div
                key={log.id}
                className="p-4 sm:p-5 rounded-2xl bg-zinc-950/80 border border-zinc-800/90 hover:border-zinc-700/80 transition-all space-y-3.5 animate-in slide-in-from-top-2 duration-300"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="p-2 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 shrink-0">
                      <UserX className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <span className="text-sm font-bold text-zinc-100 truncate block">
                        {log.groupName}
                      </span>
                      <div className="flex items-center gap-2 text-xs mt-0.5 text-zinc-300">
                        {name && <span className="font-semibold text-zinc-200">{name}</span>}
                        {formattedPhone && (
                          <>
                            {name && <span className="text-zinc-600">•</span>}
                            <span className="font-mono text-zinc-400">{formattedPhone}</span>
                          </>
                        )}
                        {!name && !formattedPhone && (
                          <span className="text-zinc-500 italic">Número privado</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex sm:flex-row flex-col sm:items-center items-end gap-2 sm:gap-3 shrink-0">
                    <span className="inline-flex items-center gap-1.5 text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 shadow-sm">
                      <Sparkles className="h-3.5 w-3.5 text-red-400" />
                      {scorePercent}% Jev
                    </span>
                    <span className="text-xs text-zinc-400 flex items-center gap-1 font-mono">
                      <Clock className="h-3 w-3 text-zinc-500" />
                      {formatTime(log.createdAt)}
                    </span>
                  </div>
                </div>

                {/* Message preview */}
                <div className="p-3 sm:p-3.5 rounded-xl bg-zinc-900/90 border border-zinc-800/80 text-xs sm:text-[13px] text-zinc-200 font-mono leading-relaxed flex items-start gap-2.5">
                  <MessageSquare className="h-4 w-4 text-zinc-500 shrink-0 mt-0.5" />
                  <p className="line-clamp-3 break-words select-text">{log.messageText}</p>
                </div>

                <div className="flex items-center justify-between text-xs text-zinc-400 pt-1 border-t border-zinc-900/80">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-md bg-zinc-800/90 border border-zinc-700/50 text-zinc-300 font-medium text-[11px]">
                      {getCategoryLabel(log.jevCategory)}
                    </span>
                    {log.isCrossGroupBan && (
                      <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold text-[10px] uppercase tracking-wider">
                        Cross-Group Ban
                      </span>
                    )}
                  </div>
                  <span className="text-emerald-400 font-semibold flex items-center gap-1.5 text-xs">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
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
