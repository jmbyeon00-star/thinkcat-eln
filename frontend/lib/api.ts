export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
const GPU_BASE = process.env.NEXT_PUBLIC_GPU_BASE_URL;

export async function fetchAPI<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...options,
  });
  if (!res.ok) throw new Error(`API Error: ${res.status}`);
  return res.json();
}

async function fetchGPU<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${GPU_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error(`GPU API Error: ${res.status}`);
  return res.json();
}

// Announcements
export async function getStats(): Promise<any> {
  return fetchAPI('/api/announcements/stats');
}

export async function getAnnouncements(params: any = {}): Promise<any> {
  const queryParams = new URLSearchParams();

  if (params.page) queryParams.append('page', params.page.toString());
  if (params.page_size) queryParams.append('page_size', params.page_size.toString());
  if (params.keyword) queryParams.append('keyword', params.keyword);
  if (params.organization) queryParams.append('organization', params.organization);
  if (params.status && params.status !== '전체') queryParams.append('status', params.status);
  if (params.start_date) queryParams.append('start_date', params.start_date);
  if (params.end_date) queryParams.append('end_date', params.end_date);
  if (params.sort_field) queryParams.append('sort_field', params.sort_field);
  if (params.sort_order) queryParams.append('sort_order', params.sort_order);

  return fetchAPI(`/api/announcements?${queryParams.toString()}`);
}

export function calculateDday(endDate: string | null | undefined): string {
  if (!endDate) return '-';

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  if (isNaN(end.getTime())) return '-';

  const diffTime = end.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return '마감';
  if (diffDays === 0) return 'D-day';
  return `D-${diffDays}`;
}

// Patent search
export async function searchByApplication(appNum: string): Promise<any> {
  return fetchAPI(`/api/search/applicationNum/${encodeURIComponent(appNum)}`);
}

export async function searchByRegistration(regNum: string): Promise<any> {
  return fetchAPI(`/api/search/registrationNum/${encodeURIComponent(regNum)}`);
}

export async function searchByApplicant(applicantCode: string): Promise<any> {
  return fetchAPI(`/api/search/applicant/${encodeURIComponent(applicantCode)}`);
}

// Patent evaluation
export async function getPatentPrice(appNumber: string): Promise<any> {
  return fetchAPI('/api/patent/price', {
    method: 'POST',
    body: JSON.stringify({ app_number: appNumber }),
  });
}

export async function patentByCitpredict(appNum: string): Promise<any> {
  return fetchAPI(`/api/patent/citpredict/${encodeURIComponent(appNum)}`);
}

export async function patentByNpecheck(appNum: string): Promise<any> {
  return fetchAPI(`/api/patent/npecheck?appNumber=${encodeURIComponent(appNum)}`);
}

// Patent navigation (GPU Neo4j)
export async function getPatentNavigationGpu(appNumber: string, code: string): Promise<any> {
  return fetchGPU(`/gpu/neo4j/navigate?appNumber=${encodeURIComponent(appNumber)}&code=${encodeURIComponent(code)}`);
}

export async function getApplicantNavigate(appNumber: string, code: string): Promise<any> {
  return fetchGPU(`/gpu/neo4j/applicant-navigate?appNumber=${encodeURIComponent(appNumber)}&code=${encodeURIComponent(code)}`);
}

export async function applicantByNavigate(appNumber: string, code: string): Promise<any> {
  return fetchAPI(`/api/patent/applicant-navigate?appNumber=${encodeURIComponent(appNumber)}&code=${encodeURIComponent(code)}`);
}

// Neo4j vector search (GPU)
export async function searchNeo4jVector(params: {
  keyword: string;
  section?: string | null;
  page?: number;
  page_size?: number;
}): Promise<any> {
  return fetchGPU('/gpu/neo4j/vector', {
    method: 'POST',
    body: JSON.stringify({
      keyword: params.keyword,
      section: params.section ?? null,
      page: params.page ?? 1,
      size: params.page_size ?? 10,
    }),
  });
}

// Agent
export async function agentRecommend(appNumber: string, code: string, maxsize = 60, top_n = 10): Promise<any> {
  return fetchAPI(`/api/agent/recommend?appNumber=${encodeURIComponent(appNumber)}&code=${encodeURIComponent(code)}&maxsize=${maxsize}&top_n=${top_n}`);
}

export async function getAgentStatistics(companyName: string): Promise<any> {
  return fetchAPI(`/api/agent/company/${encodeURIComponent(companyName)}`);
}

export async function getAgentDetail(agentCode: string): Promise<any> {
  return fetchAPI(`/api/agent/people/${encodeURIComponent(agentCode)}`);
}

export async function getAgentSorting(option: string, params: {
  city?: string;
  gu?: string;
  dong?: string;
  sort?: string;
  page?: number;
  page_size?: number;
}): Promise<any> {
  const q = new URLSearchParams();
  if (option) q.append('option', option);
  if (params.city) q.append('city', params.city);
  if (params.gu) q.append('gu', params.gu);
  if (params.dong) q.append('dong', params.dong);
  if (params.sort) q.append('sort', params.sort);
  if (params.page) q.append('page', params.page.toString());
  if (params.page_size) q.append('page_size', params.page_size.toString());
  return fetchAPI(`/api/agent/sorting?${q.toString()}`);
}

export async function searchAgentCompany(q: string): Promise<any> {
  return fetchAPI(`/api/agent/search-company?q=${encodeURIComponent(q)}`);
}

export async function searchAgentKeyword(query: string, section: string, size: number = 60): Promise<any> {
  return fetchAPI('/api/agent/search-keyword', {
    method: 'POST',
    body: JSON.stringify({ query, section, size }),
  });
}
