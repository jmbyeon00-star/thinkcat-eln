// /frontend/lib/store/useUserTaskStore.ts

import { create } from 'zustand';

export interface UserTaskState {
    isBusy: boolean;
    progress: number;
    remaining_time: string;
    run_type: string;
    status: 'RUNNING' | 'INFERRING' | 'AVAILABLE';
    targetId: number;
    task: string;
    setState: (obj: Partial<UserTaskState>) => void;
}

export const useUserTaskStore = create<UserTaskState>()((set: any) => ({
    isBusy: false,
    progress: 0,
    remaining_time: "",
    run_type: "",
    status: 'AVAILABLE',
    targetId: 0,
    task: "idle",
    setState: (obj: Partial<UserTaskState>) => set(() => obj),
}))