import React from 'react';
import { ShieldCheck, ShieldAlert, Zap, Wifi, QrCode } from 'lucide-react';
import { BaileysStatus, MetricsDto } from '@ban4life/types';

interface MetricsOverviewProps {
  protectedCount: number;
  totalGroups: number;
  metrics: MetricsDto;
  baileysStatus: BaileysStatus;
  onOpenQr?: () => void;
}

export const MetricsOverview: React.FC<MetricsOverviewProps> = ({
  protectedCount,
  totalGroups,
  metrics,
  baileysStatus,
  onOpenQr,
}) => {
  const protectedPercent = totalGroups > 0 ? Math.round((protectedCount / totalGroups) * 100) : 0;

  const getStatusCard = () => {
    switch (baileysStatus) {
      case 'connected':
        return {
          title: 'ONLINE',
          subtitle: 'Sincronizado e monitorando',
          color: 'text-emerald-400',
          badgeBg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
          dot: 'bg-emerald-400 animate-pulse',
        };
      case 'waiting_qr':
        return {
          title: 'AGUARDANDO QR',
          subtitle: 'Clique para escanear',
          color: 'text-amber-400',
          badgeBg: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
          dot: 'bg-amber-400 animate-ping',
        };
      case 'connecting':
        return {
          title: 'CONECTANDO...',
          subtitle: 'Estabelecendo sessão',
          color: 'text-blue-400',
          badgeBg: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
          dot: 'bg-blue-400 animate-ping',
        };
      default:
        return {
          title: 'DESCONECTADO',
          subtitle: 'Aguardando reconexão',
          color: 'text-zinc-400',
          badgeBg: 'bg-zinc-800 border-zinc-700 text-zinc-400',
          dot: 'bg-zinc-500',
        };
    }
  };

  const statusInfo = getStatusCard();

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5 mb-6">
      {/* KPI 1: Grupos Protegidos */}
      <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 shadow-lg flex items-center gap-3.5 sm:gap-4">
        <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
          <ShieldCheck className="h-5 w-5 sm:h-6 sm:w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <span className="text-[11px] sm:text-xs font-medium text-zinc-400 uppercase tracking-wider block truncate">
            Grupos Protegidos
          </span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-xl sm:text-2xl font-bold text-white tracking-tight font-mono">
              {protectedCount}
            </span>
            <span className="text-xs text-zinc-500">
              de {totalGroups} ({protectedPercent}%)
            </span>
          </div>
        </div>
      </div>

      {/* KPI 2: Spams Eliminados */}
      <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 shadow-lg flex items-center gap-3.5 sm:gap-4">
        <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 shrink-0">
          <ShieldAlert className="h-5 w-5 sm:h-6 sm:w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <span className="text-[11px] sm:text-xs font-medium text-zinc-400 uppercase tracking-wider block truncate">
            Spams Eliminados
          </span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-xl sm:text-2xl font-bold text-white tracking-tight font-mono">
              {metrics.totalSpamsBanned}
            </span>
            <span className="text-xs text-zinc-500">
              de {metrics.totalEvaluated} analisados
            </span>
          </div>
        </div>
      </div>

      {/* KPI 3: Cache 0ms */}
      <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 shadow-lg flex items-center gap-3.5 sm:gap-4">
        <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
          <Zap className="h-5 w-5 sm:h-6 sm:w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <span className="text-[11px] sm:text-xs font-medium text-zinc-400 uppercase tracking-wider block truncate">
            Intercepções 0ms
          </span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-xl sm:text-2xl font-bold text-white tracking-tight font-mono">
              {metrics.cacheHits}
            </span>
            <span className="text-xs text-zinc-500">
              economia de API
            </span>
          </div>
        </div>
      </div>

      {/* KPI 4: Conexão WhatsApp */}
      <div
        onClick={baileysStatus === 'waiting_qr' ? onOpenQr : undefined}
        className={`bg-zinc-900/80 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 shadow-lg flex items-center gap-3.5 sm:gap-4 ${
          baileysStatus === 'waiting_qr' ? 'cursor-pointer hover:border-amber-500/40 transition-colors' : ''
        }`}
      >
        <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-xl bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center text-zinc-300 shrink-0">
          {baileysStatus === 'waiting_qr' ? (
            <QrCode className="h-5 w-5 sm:h-6 sm:w-6 text-amber-400" />
          ) : (
            <Wifi className={`h-5 w-5 sm:h-6 sm:w-6 ${statusInfo.color}`} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <span className="text-[11px] sm:text-xs font-medium text-zinc-400 uppercase tracking-wider block truncate">
            WhatsApp Bot
          </span>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-white">
              <span className={`h-2 w-2 rounded-full ${statusInfo.dot}`} />
              {statusInfo.title}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
