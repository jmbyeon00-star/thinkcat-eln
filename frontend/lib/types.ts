// frontend/lib/types.ts

export type Hit = {
    key: string;
    title?: string | null;
    abstract?: string | null;
    score?: number | null;
    highlight?: Record<string, string[]>;
};

export type Row = {
    official_number: string;
    application_number?: string | number;
    title?: string | null;
    abstract?: string | null;
    filing_date?: string | null;
    grant_date?: string | null;
};
  
export type SearchItem = {
    application_number: string;
    title: string;
    abstract: string;
    filing_date?: string;
    grant_date?: string;
};

export type SearchResp = {
    total: number;
    page: number;
    size: number;
    data: SearchItem[];
};


// Recommendation
export interface CollectionDetail {
    id: number;
    collection_name: string;
    collection_code: string;
    source_type: string;
    project_names?: string[];
  }
  
  export interface ModelInfo {
    id: number;
    progress: number;
    version: number;
  }
  
  export interface TrainingParams {
    epoch: number;
    batch_size: number;
    learning_rate: number;
    max_length: number;
  }
  