'use client'

import { create } from 'zustand';

interface UserTaskState {
    isBusy: boolean
    progress: number
    status: 'RUNNING' | 'AVAILABLE'
    setState: (obj: Partial<UserTaskState>) => void
}

export const useUserTaskStore = create<UserTaskState>()((set: any) => ({
    isBusy: false,
    progress: 0,
    status: 'AVAILABLE',
    setState: (obj: Partial<UserTaskState>) => set(() => obj),
}))