import React, { useState } from 'react';
import { Shield, Lock, ArrowRight, AlertCircle } from 'lucide-react';

interface LoginModalProps {
  onLogin: (password: string) => Promise<boolean>;
}

export const LoginModal: React.FC<LoginModalProps> = ({ onLogin }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;

    setIsLoading(true);
    setError(null);

    const success = await onLogin(password);
    if (!success) {
      setError('Senha incorreta. Verifique a variável ADMIN_PASSWORD.');
    }
    setIsLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950">
      <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="text-center mb-6">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/20">
            <Shield className="h-6 w-6 text-zinc-950 stroke-[2.5]" />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">LinkeShield Painel</h2>
          <p className="text-xs text-zinc-400 mt-1">
            Digite a senha de administrador para acessar o painel de proteção.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <input
                type="password"
                placeholder="Senha de administrador"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl bg-zinc-950 border border-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/60 transition-all"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !password.trim()}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-zinc-950 font-semibold text-xs transition-colors shadow-lg shadow-emerald-500/20 disabled:opacity-50"
          >
            {isLoading ? (
              <span>Verificando...</span>
            ) : (
              <>
                <span>Acessar Painel</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
