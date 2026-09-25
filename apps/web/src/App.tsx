import { useState, useEffect, useCallback } from 'react';
import { BaileysStatus, SpamLogDto, MetricsDto } from '@ban4life/types';
import { useAuth } from './hooks/useAuth';
import { useSSE } from './hooks/useSSE';
import { useGroups } from './hooks/useGroups';
import { Header } from './components/Header';
import { MetricsOverview } from './components/MetricsOverview';
import { GroupList } from './components/GroupList';
import { SpamFeed } from './components/SpamFeed';
import { SettingsSidebar } from './components/SettingsSidebar';
import { QRCodeModal } from './components/QRCodeModal';
import { LoginModal } from './components/LoginModal';

export function App() {
  const { token, isAuthenticated, isLoading: authLoading, login, logout } = useAuth();
  const [baileysStatus, setBaileysStatus] = useState<BaileysStatus>('connecting');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [isQrModalOpen, setIsQrModalOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [logs, setLogs] = useState<SpamLogDto[]>([]);
  const [metrics, setMetrics] = useState<MetricsDto>({
    totalEvaluated: 0,
    totalSpamsBanned: 0,
    cacheHits: 0,
  });

  const { groups, isLoading: groupsLoading, fetchGroups, toggleGroup, updateGroupInList } =
    useGroups(token);

  // Fetch metrics from API
  const fetchMetrics = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/logs/metrics', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data: MetricsDto = await res.json();
        setMetrics(data);
      }
    } catch (err) {
      console.error('Failed to fetch metrics', err);
    }
  }, [token]);

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
    fetchMetrics();
  }, [fetchBaileysStatus, fetchMetrics]);

  const handleInitialLogsLoaded = useCallback((initial: SpamLogDto[]) => {
    setLogs(initial);
  }, []);

  const handleStatusUpdate = useCallback(
    (newStatus: BaileysStatus) => {
      setBaileysStatus(newStatus);
      if (newStatus === 'waiting_qr') {
        setIsQrModalOpen(true);
        fetchBaileysStatus();
      } else if (newStatus === 'connected') {
        setIsQrModalOpen(false);
        fetchGroups();
      }
    },
    [fetchBaileysStatus, fetchGroups],
  );

  const handleSpamEvent = useCallback((newSpam: SpamLogDto) => {
    setLogs((prev) => [newSpam, ...prev]);
    setMetrics((prev) => ({
      ...prev,
      totalEvaluated: prev.totalEvaluated + 1,
      totalSpamsBanned: prev.totalSpamsBanned + 1,
    }));
  }, []);

  const handleGroupEvent = useCallback(
    (updatedGroup: any) => {
      updateGroupInList(updatedGroup);
    },
    [updateGroupInList],
  );

  // Connect SSE for live real-time events
  useSSE({
    token,
    onStatus: handleStatusUpdate,
    onSpam: handleSpamEvent,
    onGroup: handleGroupEvent,
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
        Carregando painel Ban4Life...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginModal onLogin={login} />;
  }

  const protectedCount = groups.filter((g) => g.isProtected).length;

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col text-zinc-100">
      <Header
        status={baileysStatus}
        spamCount={logs.length}
        metrics={metrics}
        onLogout={logout}
        onOpenQr={() => setIsQrModalOpen(true)}
        onRestartBaileys={handleRestartBaileys}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <main className="flex-1 max-w-[1600px] w-full mx-auto p-4 sm:p-6 lg:p-8 xl:px-10 flex flex-col">
        {/* Top KPIs Banner */}
        <MetricsOverview
          protectedCount={protectedCount}
          totalGroups={groups.length}
          metrics={metrics}
          baileysStatus={baileysStatus}
          onOpenQr={() => setIsQrModalOpen(true)}
        />

        {/* Main Operational Split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch flex-1">
          {/* Left: Groups (Administered) */}
          <div className="lg:col-span-5 xl:col-span-4 flex flex-col">
            <GroupList
              groups={groups}
              isLoading={groupsLoading}
              onToggle={toggleGroup}
              onRefresh={fetchGroups}
            />
          </div>

          {/* Right: Live Spam Feed (Expansive Real-Time Stream) */}
          <div className="lg:col-span-7 xl:col-span-8 flex flex-col">
            <SpamFeed
              token={token}
              logs={logs}
              onInitialLogsLoaded={handleInitialLogsLoaded}
            />
          </div>
        </div>
      </main>

      {/* Collapsible Settings Drawer */}
      <SettingsSidebar
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        token={token}
      />

      {/* QR Code Modal */}
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
