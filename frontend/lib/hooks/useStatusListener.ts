'use client'

import { useEffect } from 'react';
import { useUserTaskStore } from '@/lib/store/useUserTaskStore';

export default function useStatusListener(targetId: number | string | null) {
    const { setState } = useUserTaskStore()
    useEffect(() => {
        if (!targetId) return
        const base = "http://192.168.1.20:8000"
        const source = new EventSource(`${base}/api/status/stream/${targetId}`)

        source.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data)
                const raw = (data.status ?? '').toUpperCase()
                const status = raw === 'RUNNING' ? 'RUNNING' : 'AVAILABLE'

                setState({
                    status,
                    isBusy: status === 'RUNNING',
                })

                console.log('[SSE:status]', status)
            } catch (e) {
                console.warn('SSE JSON parse error', e)
            }
        }

        source.onerror = () => {
            console.warn('SSE 연결 끊김')
            source.close()
            setTimeout(() => useStatusListener(targetId), 3000)
        }

        return () => source.close()
    }, [targetId, setState])
}
