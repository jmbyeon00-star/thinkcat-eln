export interface PatentSource {
    title: string;
    application_number?: string;
    address?: string;
    applicant_name?: string;
    inventor_name?: string;
    filing_date?: string;
    end_status?: string;
}
export interface SearchResultItem {
    _id: string;
    _score?: number;
    _source: PatentSource;
}
export type SearchOptions = {
    search_type: "exact" | "text" | "semantic" | "hybrid" | null;
    use_vector: boolean;
    exact_match: {
        title?: string | null;
        application_number?: string | null;
    };
    filters: {
        filing_year?: { from?: number; to?: number; gte?: number; lte?: number };
        filing_date?: { from?: string; to?: string; gte?: string; lte?: string };
        applicant_name?: string | null;
        inventor_name?: string | null;
        inventor_country_code?: string | null;
        end_status?: string | null;
    };

    text_query: {
        fields: string[]; // ["title", "abstract", "claim"]
        keyword: string[];
    };
};


export interface ElasticSearchResult {
    application_number: string;
    title: string;
    abstract?: string;
    filing_date?: string;
    publication_number?: string;
    grant_number?: string;
    cpc_code?: string;
    score?: number;
    vector?: number[] | null;
    collection_name?: string;
}