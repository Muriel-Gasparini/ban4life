import React, { useState } from 'react';
import { GroupDto } from '@linkeshield/types';
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

  const filteredGroups = groups.filter((g) =>
    g.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const protectedCount = groups.filter((g) => g.isProtected).length;

  const handleToggle = async (id: string) => {
    setTogglingId(id);
    await onToggle(id);
    setTogglingId(null);
  };

  return (
    <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-2xl p-5 shadow-xl flex flex-col h-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
              Grupos Protegidos
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {protectedCount} de {groups.length} ativos
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            Ative ou desative o LinkeShield grupo a grupo com um clique
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Search box */}
          <div className="relative flex-1 sm:w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
            <input
              type="text"
              placeholder="Buscar grupo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-zinc-950/80 border border-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50"
            />
          </div>

          <button
            onClick={onRefresh}
            title="Atualizar grupos"
            disabled={isLoading}
            className="p-1.5 rounded-xl border border-zinc-800 bg-zinc-950/80 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto max-h-[380px] pr-1 space-y-2">
        {filteredGroups.length === 0 ? (
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
                <p className="text-xs text-zinc-400">Nenhum grupo sincronizado ainda.</p>
                <p className="text-[11px] text-zinc-600">
                  Conecte o WhatsApp para sincronizar automaticamente os grupos participantes.
                </p>
              </div>
            )}
          </div>
        ) : (
          filteredGroups.map((group) => {
            const isToggling = togglingId === group.id;
            return (
              <div
                key={group.id}
                className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                  group.isProtected
                    ? 'bg-zinc-950/70 border-emerald-500/30 shadow-sm shadow-emerald-950/30'
                    : 'bg-zinc-950/40 border-zinc-800/80 opacity-75 hover:opacity-100'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 pr-3">
                  <div
                    className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${
                      group.isProtected
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-zinc-800/80 text-zinc-400 border border-zinc-700/60'
                    }`}
                  >
                    <Users className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs sm:text-sm font-semibold text-zinc-100 truncate">
                      {group.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-zinc-400 flex items-center gap-1">
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
