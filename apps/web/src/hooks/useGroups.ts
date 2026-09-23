import { useState, useEffect, useCallback } from 'react';
import { GroupDto } from '@linkeshield/types';

export function useGroups(token: string | null) {
  const [groups, setGroups] = useState<GroupDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGroups = useCallback(async () => {
    if (!token) return;
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch('/api/groups', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        throw new Error('Falha ao carregar lista de grupos');
      }
      const data: GroupDto[] = await res.json();
      setGroups(data);
    } catch (err: any) {
      setError(err?.message || 'Erro ao carregar grupos');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const toggleGroup = async (id: string): Promise<boolean> => {
    if (!token) return false;

    // Optimistic UI update
    setGroups((prev) =>
      prev.map((g) => (g.id === id ? { ...g, isProtected: !g.isProtected } : g)),
    );

    try {
      const res = await fetch(`/api/groups/${encodeURIComponent(id)}/toggle`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error('Falha ao alternar proteção do grupo');
      }

      const updated: GroupDto = await res.json();
      setGroups((prev) => prev.map((g) => (g.id === id ? updated : g)));
      return true;
    } catch (err) {
      console.error(err);
      // Revert on failure
      fetchGroups();
      return false;
    }
  };

  const updateGroupInList = useCallback((updatedGroup: GroupDto) => {
    setGroups((prev) => {
      const index = prev.findIndex((g) => g.id === updatedGroup.id);
      if (index >= 0) {
        const copy = [...prev];
        copy[index] = updatedGroup;
        return copy;
      }
      return [updatedGroup, ...prev];
    });
  }, []);

  return { groups, isLoading, error, fetchGroups, toggleGroup, updateGroupInList };
}
