import { Shield, ShieldAlert, WifiOff, LogOut, RefreshCw, Zap, Settings } from 'lucide-react';
import { BaileysStatus, MetricsDto } from '@ban4life/types';

interface HeaderProps {
  status: BaileysStatus;
  spamCount: number;
  metrics?: MetricsDto;
  onLogout: () => void;
  onOpenQr: () => void;
  onRestartBaileys: () => void;
  onOpenSettings?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  status,
  spamCount,
  metrics,
  onLogout,
  onOpenQr,
  onRestartBaileys,
  onOpenSettings,
}) => {
  const displaySpamCount = metrics ? metrics.totalSpamsBanned : spamCount;
  const getStatusBadge = () => {
    switch (status) {
      case 'connected':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            ONLINE
          </span>
        );
      case 'waiting_qr':
        return (
          <button
            onClick={onOpenQr}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
          >
            <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
            AGUARDANDO QR CODE
          </button>
        );
      case 'connecting':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <RefreshCw className="h-3 w-3 animate-spin" />
            CONECTANDO...
          </span>
        );
      default:
        return (
          <button
            onClick={onRestartBaileys}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-zinc-700 transition-colors"
          >
            <WifiOff className="h-3 w-3" />
            DESCONECTADO (RECONECTAR)
          </button>
        );
    }
  };

  return (
    <header className="border-b border-zinc-800/80 bg-zinc-900/60 backdrop-blur sticky top-0 z-30">
      <div className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/10">
            <Shield className="h-5 w-5 text-zinc-950 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-white">Ban4Life</h1>
              <span className="text-[10px] uppercase font-mono tracking-wider px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                v1.0
              </span>
            </div>
            <p className="text-xs text-zinc-400 hidden sm:block">
              Proteção autônoma anti-spam para grupos WhatsApp
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Status Badge */}
          {getStatusBadge()}

          {/* Spam Counter & Metrics (Header Compact) */}
          <div
            className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-zinc-800/80 text-zinc-300 border border-zinc-700/60"
            title={
              metrics
                ? `Total mensagens avaliadas: ${metrics.totalEvaluated} | Intercepções Cache 0ms: ${metrics.cacheHits}`
                : undefined
            }
          >
            <ShieldAlert className="h-3.5 w-3.5 text-emerald-400" />
            <span>
              <strong className="text-white font-semibold">{displaySpamCount}</strong> spams eliminados
            </span>
            {metrics && metrics.cacheHits > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                <Zap className="h-2.5 w-2.5" />
                {metrics.cacheHits} em 0ms
              </span>
            )}
          </div>

          {/* Settings Button */}
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              title="Configurações do sistema"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-800 bg-zinc-950/80 text-zinc-300 hover:text-white hover:bg-zinc-800 hover:border-emerald-500/30 transition-all text-xs font-medium shadow-sm"
            >
              <Settings className="h-4 w-4 text-emerald-400" />
              <span className="hidden sm:inline">Configurações</span>
            </button>
          )}

          {/* Logout */}
          <button
            onClick={onLogout}
            title="Sair do painel"
            className="p-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
