'use client'

import { useEffect } from 'react';
import { useUserTaskStore } from '@/lib/store/useUserTaskStore';

export default function useStatusListener(targetId: number | string | null) {
    const { setState } = useUserTaskStore()
    useEffect(() => {
        if (!targetId) return
        const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "https://ipforce.co.kr";
        const source = new EventSource(`${API_BASE}/api/status/stream/${targetId}`)

        source.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data)
                const raw = (data.status ?? '').toUpperCase()
                // const status = raw === 'RUNNING' ? 'RUNNING' : 'AVAILABLE'
                let status: 'RUNNING' | 'INFERRING' | 'AVAILABLE' = 'AVAILABLE'
                
                if (raw === 'RUNNING') {
                    status = 'RUNNING'
                } else if (raw === 'INFERRING') {
                    status = 'INFERRING'
                } else {
                    status = 'AVAILABLE'
                }

                setState({
                    status,
                    isBusy: status === 'RUNNING' || status === 'INFERRING'
                })

                // console.log('[SSE:status]', status)
                console.log('[SSE:status]', status, '(isBusy:', status !== 'AVAILABLE', ')')
            } catch (e) {
                console.warn('SSE JSON parse error', e)
            }
        }

        source.onerror = () => {
            console.warn('SSE 연결 끊김')
            source.close()
            setTimeout(() => useStatusListener(targetId), 1000)
        }

        return () => source.close()
    }, [targetId, setState])
}
