import { SearchResp } from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';

export async function apiJson<T = any>(url: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${API_BASE}${url}`, {
      headers: { "Content-Type": "application/json", ...(init.headers || {}) },
      ...init,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`${res.status} ${res.statusText} ${detail || ""}`.trim());
    }
    return res.json();
}

export async function searchPatents(params: {
  keyword: string;
  category: string;   // 'A'~'H','Y' 또는 '1'~'9'
  page?: number;
  size?: number;
}): Promise<SearchResp> {
  const { keyword, category, page = 1, size = 10 } = params;
  const res = await fetch(`${API_BASE}/api/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keyword, category, page, size }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

export async function searchByApplication(application_number: string) {
    const res = await fetch(`${API_BASE}/search/by-application`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ application_number }),
    });
  
    if (!res.ok) {
      const msg = await res.text();
      throw new Error(`HTTP ${res.status}: ${msg}`);
    }
  
    return res.json();
}

export async function searchPatentsAdvanced(params: { keyword: string; category: string; }) {
    const { keyword, category } = params;
    const res = await fetch(`${API_BASE}/search/bgem3/${category}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }
  