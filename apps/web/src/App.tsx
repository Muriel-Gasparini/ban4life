import { useState, useEffect, useCallback } from 'react';
import { BaileysStatus, SpamLogDto } from '@linkeshield/types';
import { useAuth } from './hooks/useAuth';
import { useSSE } from './hooks/useSSE';
import { useGroups } from './hooks/useGroups';
import { Header } from './components/Header';
import { GroupList } from './components/GroupList';
import { SettingsCard } from './components/SettingsCard';
import { SpamFeed } from './components/SpamFeed';
import { QRCodeModal } from './components/QRCodeModal';
import { LoginModal } from './components/LoginModal';

export function App() {
  const { token, isAuthenticated, isLoading: authLoading, login, logout } = useAuth();
  const [baileysStatus, setBaileysStatus] = useState<BaileysStatus>('connecting');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [isQrModalOpen, setIsQrModalOpen] = useState<boolean>(false);
  const [logs, setLogs] = useState<SpamLogDto[]>([]);

  const { groups, isLoading: groupsLoading, fetchGroups, toggleGroup, updateGroupInList } =
    useGroups(token);

  // Fetch initial Baileys status and QR code
  const fetchBaileysStatus = useCallback(async () => {
    if (!token) return;
    try {
      const [statusRes, qrRes] = await Promise.all([
        fetch('/api/baileys/status', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/baileys/qr', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (statusRes.ok) {
        const data = await statusRes.json();
        setBaileysStatus(data.status);
        if (data.status === 'waiting_qr') {
          setIsQrModalOpen(true);
        }
      }

      if (qrRes.ok) {
        const data = await qrRes.json();
        setQrCodeDataUrl(data.qr);
      }
    } catch (err) {
      console.error('Failed to fetch Baileys status/qr', err);
    }
  }, [token]);

  useEffect(() => {
    fetchBaileysStatus();
  }, [fetchBaileysStatus]);

  // Connect SSE for live real-time events
  useSSE({
    token,
    onStatus: (newStatus) => {
      setBaileysStatus(newStatus);
      if (newStatus === 'waiting_qr') {
        setIsQrModalOpen(true);
        fetchBaileysStatus();
      } else if (newStatus === 'connected') {
        setIsQrModalOpen(false);
        fetchGroups();
      }
    },
    onSpam: (newSpam) => {
      setLogs((prev) => [newSpam, ...prev]);
    },
    onGroup: (updatedGroup) => {
      updateGroupInList(updatedGroup);
    },
  });

  const handleRestartBaileys = async () => {
    if (!token) return;
    try {
      await fetch('/api/baileys/restart', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchBaileysStatus();
    } catch (err) {
      console.error('Failed to restart Baileys', err);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-500 text-xs">
        Carregando painel LinkeShield...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginModal onLogin={login} />;
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col text-zinc-100">
      <Header
        status={baileysStatus}
        spamCount={logs.length}
        onLogout={logout}
        onOpenQr={() => setIsQrModalOpen(true)}
        onRestartBaileys={handleRestartBaileys}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Groups + Settings */}
          <div className="lg:col-span-7 space-y-6">
            <GroupList
              groups={groups}
              isLoading={groupsLoading}
              onToggle={toggleGroup}
              onRefresh={fetchGroups}
            />

            <SettingsCard token={token} />
          </div>

          {/* Right Column: Live Spam Feed */}
          <div className="lg:col-span-5 h-full">
            <SpamFeed
              token={token}
              logs={logs}
              onInitialLogsLoaded={(initial) => setLogs(initial)}
            />
          </div>
        </div>
      </main>

      <QRCodeModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        qrDataUrl={qrCodeDataUrl}
        status={baileysStatus}
        onRefresh={fetchBaileysStatus}
      />
    </div>
  );
}

export default App;
