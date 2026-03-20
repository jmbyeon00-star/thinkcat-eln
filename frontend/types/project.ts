// @/types/project 
export type NewDataSourceInfo = {
    sourceType: 'upload' | 'search';
    fileIds?: number[];
    searchKey?: string;
    standardDedupKey?: string; // 표준 키 (예: '출원번호')
    fileHeaders?: string[];
    count?: number;
};

export interface DedupConfig {
    enabled: boolean;
    keys: string[] | null;
}
export type ProjectInfo = {
    id: number;
    user_id: number;
    source_type: string;
    task_type: string;
    project_code: string;
    project_status: number;
    project_name: string;
    project_description: string;
    collection_num: number;
    is_counter_used: number;
    labeled_documents: number;
    unlabeled_document: number;
    model_count: number;
    mean_score: number;
    temp_category: string;
    modified: string;
    created_datetime: string;
    updated_datetime: string;
};

export type Activity = {
    action: string;
    time: string;
};
export type ProjectData = {
    sourceId?: string;
    id?: string;
    user_id?: number;
    source_type?: string;
    group_code?: string;
    project_code?: string;
    project_id?: number;
    collection_id?: number;
    collection_name?: string;
    class_name?: string;
    label?: string;
    title?: string;
    abstract?: string;
    used?: number;
    applicant_name?: string;
    applicant_code?: string;
    application_number?: number;
    application_date?: string;
    grand_status?: number;
    ipc_code?: string;
    cpc_code?: string;
    probability?: number;
    data_status?: 'NEW' | 'EDITED' | 'ORIGINAL' | string;
    created_datetime?: string;
    updated_datetime?: string;

    status?: "진행중",
    recentActivities?: Activity[];
    // recentActivities?: [
    //     { action: "모델 '100-13' 학습 완료", time: "2시간 전" },
    //     { action: "데이터 50개 추가", time: "1일 전" },
    //     { action: "프로젝트 생성", time: "3일 전" },
    // ],
};

export interface ProjectGroupItems {
    id: number;
    group_code: string;
    group_name: string;
    group_items: ProjectData[];
    count: number;
    last_updated: string;
}

export interface ProjectDataGroups {
    total_count: number;
    group_count: number;
    groups: ProjectGroupItems[];
    last_updated: string;
}

export type TrainingDataItems = ProjectData[];
export type TrainingConfig = {
    model_name?: string;
    model_desc?: string;
    epoch: number;
    batch_size: number;
    learning_rate: number;
    max_length: number;
    shuffle: boolean,
}

export type DataSourceType = 'group' | 'upload' | 'search';
export type DataSourceInfo = {
    name: string;
    count: number;
    type: DataSourceType;
    sourceId?: string | number;
    isUsed?: boolean;
    isCounterUsed?: boolean;
};
export type DataSummary = {
    totalItemsCount: number;
    isValid: boolean;
    sourceList: DataSourceInfo[];
    selectedGroupCount?: number;
    newlyAddedFileCount?: number;
};