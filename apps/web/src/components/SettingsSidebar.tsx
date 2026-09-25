import React, { useState, useEffect } from 'react';
import { SettingsDto, UpdateSettingsDto } from '@ban4life/types';
import { Settings, X, Save, Check, BellRing, Trash2, Sliders, Shield } from 'lucide-react';

interface SettingsSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  token: string | null;
}

export const SettingsSidebar: React.FC<SettingsSidebarProps> = ({
  isOpen,
  onClose,
  token,
}) => {
  const [settings, setSettings] = useState<SettingsDto>({
    deleteSpamMessage: true,
    sendBanNotice: false,
    banNoticeTemplate: '🚫 Mensagem apagada e usuário expulso por divulgação não autorizada.',
    banThreshold: 0.85,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Load settings when opened
  useEffect(() => {
    if (!token || !isOpen) return;
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
  }, [token, isOpen]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    try {
      setIsSaving(true);
      const updateData: UpdateSettingsDto = {
        deleteSpamMessage: settings.deleteSpamMessage,
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
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/70 backdrop-blur-sm z-50 transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <aside
        className={`fixed inset-y-0 right-0 z-50 w-full max-w-md bg-zinc-900/95 border-l border-zinc-800 shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Configurações do Sistema"
      >
        {/* Header */}
        <div className="p-5 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-950/40">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Settings className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                Configurações
              </h2>
              <p className="text-[11px] text-zinc-400">
                Avisos, moderação e calibração do filtro Jev
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            title="Fechar configurações"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-500 text-xs">
              Carregando configurações...
            </div>
          ) : (
            <form id="settings-form" onSubmit={handleSave} className="space-y-4">
              {/* Section: Ações de Moderação */}
              <div>
                <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 text-emerald-400" />
                  Ações de Moderação
                </h3>
                
                {/* Toggle: Apagar mensagem de spam no grupo */}
                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
                  <input
                    id="drawerDeleteSpamMessage"
                    type="checkbox"
                    checked={settings.deleteSpamMessage}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, deleteSpamMessage: e.target.checked }))
                    }
                    className="h-4 w-4 mt-0.5 rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-zinc-900 accent-emerald-500 cursor-pointer"
                  />
                  <div className="flex-1">
                    <label
                      htmlFor="drawerDeleteSpamMessage"
                      className="text-xs font-semibold text-zinc-200 cursor-pointer flex items-center gap-1.5"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-emerald-400" />
                      Apagar mensagem de spam no grupo
                    </label>
                    <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">
                      Se ativado, revoga a mensagem no WhatsApp antes de expulsar o infrator. Se desativado, expulsa o membro preservando a mensagem no histórico.
                    </p>
                  </div>
                </div>
              </div>

              {/* Section: Mensagem de Aviso */}
              <div>
                <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <BellRing className="h-3.5 w-3.5 text-emerald-400" />
                  Notificações no Grupo
                </h3>

                {/* Toggle: Enviar aviso no grupo */}
                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80 mb-3">
                  <input
                    id="drawerSendBanNotice"
                    type="checkbox"
                    checked={settings.sendBanNotice}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, sendBanNotice: e.target.checked }))
                    }
                    className="h-4 w-4 mt-0.5 rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-zinc-900 accent-emerald-500 cursor-pointer"
                  />
                  <div className="flex-1">
                    <label
                      htmlFor="drawerSendBanNotice"
                      className="text-xs font-semibold text-zinc-200 cursor-pointer flex items-center gap-1.5"
                    >
                      Enviar mensagem pública após banimento
                    </label>
                    <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">
                      O bot enviará um texto informativo no grupo explicando que o spam foi removido.
                    </p>
                  </div>
                </div>

                {/* Textarea Template */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-300">
                    Texto do aviso automático
                  </label>
                  <textarea
                    rows={3}
                    value={settings.banNoticeTemplate}
                    disabled={!settings.sendBanNotice}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, banNoticeTemplate: e.target.value }))
                    }
                    placeholder="Ex: 🚫 Mensagem apagada e usuário expulso por divulgação não autorizada."
                    className={`w-full p-3 text-xs rounded-xl bg-zinc-950/80 border border-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-opacity ${
                      !settings.sendBanNotice ? 'opacity-40 cursor-not-allowed' : ''
                    }`}
                  />
                </div>
              </div>

              {/* Section: Sensibilidade Jev */}
              <div>
                <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Sliders className="h-3.5 w-3.5 text-emerald-400" />
                  Sensibilidade do Filtro Jev
                </h3>

                <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800/80 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-zinc-300">
                      Threshold de Banimento
                    </span>
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

                  <div className="flex justify-between text-[10px] text-zinc-400 pt-0.5">
                    <span>50% (Agressivo)</span>
                    <span className="text-emerald-400 font-semibold">85% (Recomendado)</span>
                    <span>99% (Conservador)</span>
                  </div>
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-zinc-800/80 bg-zinc-950/60 flex items-center justify-between gap-3">
          <div>
            {savedSuccess && (
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 animate-in fade-in">
                <Check className="h-3.5 w-3.5" />
                Salvo com sucesso!
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl border border-zinc-800 text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              Fechar
            </button>
            <button
              type="submit"
              form="settings-form"
              disabled={isLoading || isSaving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-semibold text-xs transition-colors shadow-lg shadow-emerald-500/20 disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              {isSaving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
