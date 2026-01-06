import type { UserTaskState } from "@/lib/store/useUserTaskStore";

export interface Props {
    model: ModelDetail | null;
    isBusy: boolean;
    storeStatus: "RUNNING" | "INFERRING" | "AVAILABLE";
    token?: string;
    onStateChange?: (obj: Partial<UserTaskState>) => void;
}

export type HistorySegment = {
    train_loss: number[];
    train_acc: number[];
    valid_loss: number[];
    valid_acc: number[];
    epochs: number;
    accuracy: number;
};

export type ModelDetail = {
    id: number;
    data_id?: number;
    model_name: string;
    model_desc?: string;
    data_scope: string;
    data_type: string;
    task_type: string;
    source_type: string;
    collection_num: number;
    progress: number;
    progress_status: "RUNNING" | "COMPLETED" | "FAILED";
    created_datetime?: string;
    train_status: number;
    elapsed_time: number;
    updated_count?: number;
    accuracy?: number;
    epoch?: number;
    batch_size?: number;
    learning_rate?: number;
    data_num?: number;
    n_data_num?: number;
    max_length?: number;

    history?: {
        segments: HistorySegment[];
    };
    mapping?: Record<string, string>;
};

export interface RetrainRow {
    key: string;
    epoch: number;
    accuracy: number;
    loss: number;
    segment: number;
    color: string;
    train_acc: number;
    valid_acc: number;
    train_loss: number;
    valid_loss: number;
}

export const taskMapper: Record<string, string> = {
    classification: "분류",
    recommedation: "추천",
    etc: "기타",
};