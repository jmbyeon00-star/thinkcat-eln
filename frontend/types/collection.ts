export type CollectionInfo = {
    id: number;
    user_id: number;
    project_id: number;
    source_type: string;
    project_code: string;
    project_name: string;
    collection_code: string;
    collection_name: string;
    collection_category: string;
    collection_data_ratio: number;
    collection_data_num: number;
    counter_data_num: number;
    mean_vector: string;
    created_datetime: string;
    updated_datetime: string;

    calculated_ratio?: number;
}