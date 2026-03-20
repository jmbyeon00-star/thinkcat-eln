import { api } from './apiClient';

export interface SearchQueryHistoryItem {
    id: number;
    user_id: number;
    query: string;
    search_type: string; // e.g., "ai", "standard", "similar"
    timestamp: string; // ISO 8601 string
}

export const saveSearchQuery = async (query: string, searchType: string, token: string | undefined): Promise<SearchQueryHistoryItem> => {
    if (!token) {
        throw new Error("Authentication token is missing.");
    }
    const response = await api.post<SearchQueryHistoryItem>(
        '/api/search/history',
        { query, search_type: searchType },
        { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
};

export const getSearchHistory = async (token: string | undefined): Promise<SearchQueryHistoryItem[]> => {
    if (!token) {
        // console.warn("Authentication token is missing. Cannot fetch search history.");
        return []; // Return empty array if no token
    }
    const response = await api.get<SearchQueryHistoryItem[]>(
        '/api/search/history',
        { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
    return response.data;
};

export const deleteSearchHistoryItem = async (id: number, token: string | undefined): Promise<void> => {
    if (!token) {
        throw new Error("Authentication token is missing.");
    }
    await api.delete(
        `/api/search/history/${id}`,
        { headers: { Authorization: `Bearer ${token}` } }
    );
};