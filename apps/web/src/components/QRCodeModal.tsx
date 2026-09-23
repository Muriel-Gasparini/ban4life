import React from 'react';
import { QrCode, RefreshCw, X, Smartphone, CheckCircle2 } from 'lucide-react';
import { BaileysStatus } from '@linkeshield/types';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  qrDataUrl: string | null;
  status: BaileysStatus;
  onRefresh: () => void;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({
  isOpen,
  onClose,
  qrDataUrl,
  status,
  onRefresh,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-6 sm:p-8">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="text-center mb-6">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-3">
            <QrCode className="h-6 w-6 text-emerald-400" />
          </div>
          <h3 className="text-xl font-bold text-white">Conectar ao WhatsApp</h3>
          <p className="text-xs text-zinc-400 mt-1">
            Escaneie o código abaixo com o WhatsApp do seu celular
          </p>
        </div>

        {status === 'connected' ? (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
            <CheckCircle2 className="h-16 w-16 text-emerald-400 animate-bounce" />
            <h4 className="text-lg font-semibold text-white">WhatsApp Conectado!</h4>
            <p className="text-sm text-zinc-400">O bot já está pronto e monitorando os grupos.</p>
            <button
              onClick={onClose}
              className="mt-4 px-6 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-medium text-sm transition-colors"
            >
              Fechar
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center">
            <div className="p-4 bg-white rounded-2xl shadow-inner flex items-center justify-center">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="WhatsApp QR Code"
                  className="w-64 h-64 object-contain rounded-lg"
                />
              ) : (
                <div className="w-64 h-64 flex flex-col items-center justify-center text-zinc-600 space-y-3">
                  <RefreshCw className="h-8 w-8 animate-spin text-zinc-400" />
                  <span className="text-xs text-zinc-500 font-medium">
                    Aguardando geração do QR Code...
                  </span>
                </div>
              )}
            </div>

            <div className="mt-6 w-full space-y-2 text-xs text-zinc-400 bg-zinc-950/60 p-4 rounded-xl border border-zinc-800/80">
              <div className="flex items-start gap-2">
                <Smartphone className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                <ol className="list-decimal list-inside space-y-1">
                  <li>Abra o WhatsApp no seu smartphone</li>
                  <li>Toque em Mais opções (ou Ajustes) &gt; Aparelhos conectados</li>
                  <li>Toque em Conectar um aparelho</li>
                  <li>Aponte a câmera para esta tela</li>
                </ol>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between w-full">
              <button
                onClick={onRefresh}
                className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Recarregar conexão
              </button>
              <button
                onClick={onClose}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Conectar mais tarde
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
