'use client'
import { useEffect } from 'react';
import { useUserTaskStore } from '@/lib/store/useUserTaskStore';

export default function useProgressListener(targetId: number | string) {
    const { setState } = useUserTaskStore()

    useEffect(() => {
        if (!targetId) return
        const source = new EventSource(`/api/status/stream/${targetId}`)

        source.onmessage = (event) => {
            const data = JSON.parse(event.data)
            console.log("[SSE]", data)

            // 상태에 따라 전역변수 갱신
            setState({
                status: data.status ?? 'RUNNING',
                isBusy: data.status === 'RUNNING',
            })
        }

        source.onerror = () => {
            console.warn('SSE 연결 끊김')
            source.close()
        }

        return () => source.close()
    }, [targetId, setState])
}
