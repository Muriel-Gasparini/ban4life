import React, { useState, useMemo } from 'react';
import { GroupDto } from '@ban4life/types';
import { Users, Search, ShieldCheck, ShieldAlert, RefreshCw } from 'lucide-react';

interface GroupListProps {
  groups: GroupDto[];
  isLoading: boolean;
  onToggle: (id: string) => Promise<boolean>;
  onRefresh: () => void;
}

export const GroupList: React.FC<GroupListProps> = ({
  groups,
  isLoading,
  onToggle,
  onRefresh,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const sortedAndFilteredGroups = useMemo(() => {
    return [...groups]
      .filter((g) => g.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => {
        if (a.isProtected !== b.isProtected) {
          return a.isProtected ? -1 : 1;
        }
        return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
      });
  }, [groups, searchTerm]);

  const protectedCount = groups.filter((g) => g.isProtected).length;

  const handleToggle = async (id: string) => {
    setTogglingId(id);
    await onToggle(id);
    setTogglingId(null);
  };

  return (
    <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-2xl p-5 sm:p-6 shadow-xl flex flex-col h-full">
      {/* Header section with structured search */}
      <div className="space-y-3 mb-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
            <h2 className="text-base font-bold text-white tracking-tight truncate">
              Grupos Administrados
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
              {protectedCount} de {groups.length}
            </span>
          </div>

          <button
            onClick={onRefresh}
            title="Atualizar grupos"
            disabled={isLoading}
            className="p-2 rounded-xl border border-zinc-800 bg-zinc-950/80 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors disabled:opacity-50 shrink-0"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <p className="text-xs text-zinc-400">
          Exibindo apenas grupos onde o número conectado é administrador
        </p>

        {/* Full-width Search bar */}
        <div className="relative w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Buscar grupo por nome..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm rounded-xl bg-zinc-950/80 border border-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-colors"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto max-h-[calc(100vh-270px)] min-h-[460px] pr-1.5 space-y-2.5">
        {sortedAndFilteredGroups.length === 0 ? (
          <div className="text-center py-12 px-4 rounded-xl border border-dashed border-zinc-800 text-zinc-500">
            {isLoading ? (
              <div className="flex flex-col items-center gap-2">
                <RefreshCw className="h-6 w-6 animate-spin text-emerald-400" />
                <span className="text-xs">Sincronizando grupos...</span>
              </div>
            ) : searchTerm ? (
              <span className="text-xs">Nenhum grupo encontrado com &quot;{searchTerm}&quot;</span>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <ShieldAlert className="h-8 w-8 text-zinc-600" />
                <p className="text-xs text-zinc-400">Nenhum grupo administrado encontrado.</p>
                <p className="text-[11px] text-zinc-600 max-w-xs">
                  O Ban4Life exibe apenas grupos onde o número conectado é administrador para poder aplicar moderação.
                </p>
              </div>
            )}
          </div>
        ) : (
          sortedAndFilteredGroups.map((group) => {
            const isToggling = togglingId === group.id;
            return (
              <div
                key={group.id}
                className={`flex items-center justify-between p-3.5 sm:p-4 rounded-xl border transition-all ${
                  group.isProtected
                    ? 'bg-zinc-950/70 border-emerald-500/30 shadow-sm shadow-emerald-950/30'
                    : 'bg-zinc-950/40 border-zinc-800/80 opacity-75 hover:opacity-100'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 pr-3">
                  <div
                    className={`h-9 w-9 sm:h-10 sm:w-10 rounded-xl flex items-center justify-center shrink-0 ${
                      group.isProtected
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-zinc-800/80 text-zinc-400 border border-zinc-700/60'
                    }`}
                  >
                    <Users className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs sm:text-sm font-semibold text-zinc-100 truncate">
                      {group.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] sm:text-xs text-zinc-400 flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {group.participantCount} membros
                      </span>
                      {group.isProtected && (
                        <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400">
                          Protegido
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Switch ON/OFF */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={group.isProtected}
                  disabled={isToggling}
                  onClick={() => handleToggle(group.id)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-zinc-900 ${
                    group.isProtected ? 'bg-emerald-500' : 'bg-zinc-700'
                  } ${isToggling ? 'opacity-50 cursor-wait' : ''}`}
                >
                  <span className="sr-only">Ativar proteção</span>
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      group.isProtected ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
