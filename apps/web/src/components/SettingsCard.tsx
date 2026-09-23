import React, { useState, useEffect } from 'react';
import { SettingsDto, UpdateSettingsDto } from '@linkeshield/types';
import { Settings, Save, Check, BellRing } from 'lucide-react';

interface SettingsCardProps {
  token: string | null;
}

export const SettingsCard: React.FC<SettingsCardProps> = ({ token }) => {
  const [settings, setSettings] = useState<SettingsDto>({
    sendBanNotice: false,
    banNoticeTemplate: '🚫 Mensagem apagada e usuário expulso por divulgação não autorizada.',
    banThreshold: 0.85,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (!token) return;
    const fetchSettings = async () => {
      try {
        setIsLoading(true);
        const res = await fetch('/api/settings', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data: SettingsDto = await res.json();
          setSettings(data);
        }
      } catch (err) {
        console.error('Failed to load settings', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSettings();
  }, [token]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    try {
      setIsSaving(true);
      const updateData: UpdateSettingsDto = {
        sendBanNotice: settings.sendBanNotice,
        banNoticeTemplate: settings.banNoticeTemplate,
        banThreshold: settings.banThreshold,
      };

      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (res.ok) {
        const updated: SettingsDto = await res.json();
        setSettings(updated);
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Failed to update settings', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-2xl p-5 shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Settings className="h-5 w-5 text-emerald-400" />
            Configurações de Aviso e Sensibilidade
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Personalize mensagens automáticas e calibre o filtro semântico Jev
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        {/* Checkbox: Enviar aviso no grupo */}
        <div className="flex items-start gap-3 p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
          <input
            id="sendBanNotice"
            type="checkbox"
            checked={settings.sendBanNotice}
            onChange={(e) =>
              setSettings((prev) => ({ ...prev, sendBanNotice: e.target.checked }))
            }
            className="h-4 w-4 mt-0.5 rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-zinc-900 accent-emerald-500"
          />
          <div className="flex-1">
            <label
              htmlFor="sendBanNotice"
              className="text-xs sm:text-sm font-semibold text-zinc-200 cursor-pointer flex items-center gap-1.5"
            >
              <BellRing className="h-3.5 w-3.5 text-emerald-400" />
              Enviar aviso no grupo após banir
            </label>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Se ativado, o bot enviará uma mensagem no grupo após apagar o spam e expulsar o infrator.
            </p>
          </div>
        </div>

        {/* Input: Mensagem de aviso */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-zinc-300">
            Mensagem de aviso após banimento
          </label>
          <textarea
            rows={2}
            value={settings.banNoticeTemplate}
            disabled={!settings.sendBanNotice}
            onChange={(e) =>
              setSettings((prev) => ({ ...prev, banNoticeTemplate: e.target.value }))
            }
            placeholder="Ex: 🚫 Mensagem apagada e usuário expulso por divulgação não autorizada."
            className={`w-full p-3 text-xs rounded-xl bg-zinc-950/80 border border-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-opacity ${
              !settings.sendBanNotice ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          />
        </div>

        {/* Slider: Threshold Jev */}
        <div className="p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-zinc-300">
              Sensibilidade Jev (Threshold de Banimento)
            </label>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {Math.round(settings.banThreshold * 100)}%
            </span>
          </div>
          <input
            type="range"
            min="0.50"
            max="0.99"
            step="0.01"
            value={settings.banThreshold}
            onChange={(e) =>
              setSettings((prev) => ({
                ...prev,
                banThreshold: parseFloat(e.target.value),
              }))
            }
            className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />
          <div className="flex justify-between text-[10px] text-zinc-400">
            <span>50% (Mais agressivo)</span>
            <span>85% (Recomendado)</span>
            <span>99% (Ultraconservador)</span>
          </div>
        </div>

        {/* Action button */}
        <div className="flex items-center justify-end gap-3 pt-1">
          {savedSuccess && (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-400 animate-in fade-in">
              <Check className="h-3.5 w-3.5" />
              Configurações salvas com sucesso!
            </span>
          )}
          <button
            type="submit"
            disabled={isLoading || isSaving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-semibold text-xs transition-colors shadow-lg shadow-emerald-500/20 disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            {isSaving ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </form>
    </div>
  );
};
