// hooks/project/useCollectionActions.ts

import { useState, useCallback } from 'react';

export const useCollectionActions = (projectId: string | number, token: string, onRefresh?: () => Promise<void>) => {
    const [isActionLoading, setIsActionLoading] = useState(false);
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

    // 추가 로직
    const addCollection = useCallback(async (name: string) => {
        if (!token || !API_BASE) return false;
        try {
            setIsActionLoading(true);
            const res = await fetch(`${API_BASE}/api/project/${projectId}/collection`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ collection_name: name }),
            });
            if (!res.ok) throw new Error("추가 실패");
            if (onRefresh) await onRefresh(); // 성공 시 리스트 갱신
            return true;
        } catch (error) {
            console.error(error);
            return false;
        } finally {
            setIsActionLoading(false);
        }
    }, [projectId, token, onRefresh]);

    // 삭제 로직
    const deleteCollections = useCallback(async (targets: { id: number; code: string }[]) => {
        if (targets.length === 0 || !token || !API_BASE) return false;
        try {
            setIsActionLoading(true);
            const res = await fetch(`${API_BASE}/api/project/${projectId}/collections/delete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ items: targets.map(t => ({ id: t.id, collection_code: t.code })) }),
            });
            if (!res.ok) throw new Error("삭제 실패");
            if (onRefresh) await onRefresh(); // 성공 시 리스트 갱신
            return true;
        } catch (error) {
            console.error(error);
            return false;
        } finally {
            setIsActionLoading(false);
        }
    }, [projectId, token, onRefresh]);

    return { addCollection, deleteCollections, isActionLoading };
};