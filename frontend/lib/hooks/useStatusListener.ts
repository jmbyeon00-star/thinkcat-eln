// /frontend/lib/store/useStatusListener.ts

import { useEffect, useState } from 'react';
import { useUserTaskStore, UserTaskState } from '@/lib/store/useUserTaskStore';

export default function useStatusListener(targetId: number | string | null) {
    const setState = useUserTaskStore((state) => state.setState)
    const [retryKey, setRetryKey] = useState(0) // 재연결 트리거용 키

    useEffect(() => {
        if (!targetId) return
        const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
        const source = new EventSource(`${API_BASE}/api/status/stream/${targetId}`)

        source.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data)
                const raw = (data.status ?? '').toUpperCase()
                // const status = raw === 'RUNNING' ? 'RUNNING' : 'AVAILABLE'
                let status: 'RUNNING' | 'INFERRING' | 'AVAILABLE' = 'AVAILABLE'

                if (raw === 'RUNNING') status = 'RUNNING'
                else if (raw === 'INFERRING') status = 'INFERRING'

                setState({
                    isBusy: status === 'RUNNING' || status === 'INFERRING',
                    status,
                    task: data.task,
                    run_type: data.run_type,
                    progress: data.progress,
                    remaining_time: data.remaining_time,
                    targetId: data.target_id
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
            setTimeout(() => setRetryKey((prev) => prev + 1), 1000)
        }

        return () => source.close()
    }, [targetId, setState])
}
