import { create } from 'zustand';

interface UserTaskState {
    isBusy: boolean
    progress: number
    status: 'RUNNING' | 'FAILED' | 'COMPLETED'
    setState: (obj: Partial<UserTaskState>) => void
}

export const useUserTaskStore = create<UserTaskState>()((set: any) => ({
    isBusy: false,
    progress: 0,
    status: 'COMPLETED',
    setState: (obj: Partial<UserTaskState>) => set(() => obj),
}))