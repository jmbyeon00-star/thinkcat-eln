// frontend/lib/api.ts
import { apiFetch } from "./apiFetch";

// -----------------------------
// API 유틸리티 및 설정
// -----------------------------
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
// ✅ GPU 백엔드 서버 주소 (.env의 NEXT_PUBLIC_GPU_BASE_URL 사용)
//    개발=192.168.1.20:8103, 운영=L40S
export const GPU_SERVER_URL = process.env.NEXT_PUBLIC_GPU_BASE_URL || "http://192.168.1.20:8103";

export async function fetchAPI<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await apiFetch(`${API_BASE}${url}`, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...options,
  });
  if (!res.ok) throw new Error(`API Error: ${res.status}`);
  return res.json();
}

/**
 * [GPU 백엔드 전용] fetch 유틸리티 (8001 포트)
 */
export async function fetchGPU<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${GPU_SERVER_URL}${url}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`GPU API Error: ${res.status} - ${errorText}`);
  }
  return res.json();
}

// -----------------------------
// 특허 검색 API 함수들
// -----------------------------

// ✅ 키워드 검색 (BGEM3 + MLT - POST 방식)
export async function searchKeyword({
  keyword,
  category, // section
  page,
  size,
}: {
  keyword: string;
  category: string;
  page: number;
  size: number;
}) {
  return fetchAPI(`/api/search/keyword`, {
    method: "POST",
    body: JSON.stringify({
      category, keyword, page, size
    }),
  });
}

// ✅ 페이지네이션 검색 (GET 방식)
export async function searchPagination({
  section,
  keyword,
  page,
  page_size,
  method,
  include_vector = false,
  include_quote = false,
}: {
  section: string;
  keyword: string;
  page: number;
  page_size: number;
  method: string;
  include_vector?: boolean;
  include_quote?: boolean;
}) {
  const params = new URLSearchParams({
    section,
    keyword,
    page: page.toString(),
    page_size: page_size.toString(),
    method,
    include_vector: include_vector.toString(),
    include_quote: include_quote.toString(),
  });

  return fetchAPI(`/api/search/keyword?${params.toString()}`);
}

// ✅ 특허 가격 조회
export async function getPatentPrice(appNumber: string) {
  const requestBody = { app_number: appNumber };

  const res = await apiFetch(`${API_BASE}/api/patent/new-price`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to fetch patent price: ${res.status} - ${errorText}`);
  }

  return res.json();
}

// ✅ 출원번호 검색
export async function searchByApplication(appNumber: string) {
  return fetchAPI(`/api/search/applicationNum/${appNumber}`);
}

// ✅ 등록번호 검색
export async function searchByRegistration(regNumber: string) {
  return fetchAPI(`/api/search/registrationNum/${regNumber}`);
}

// ✅ 출원인코드 검색
export async function searchByApplicant(applicantCode: string) {
  return fetchAPI(`/api/search/applicant/${applicantCode}`);
}

//=========== patent_router ===================================
// ✅ 피인용수 예측
export async function patentByCitpredict(appNumber: string): Promise<any> {
  return fetchAPI<any>(`/api/patent/citpredict/${appNumber}`);
}

// ✅ 특허 네비게이션 데이터
export async function patentByNavigate(appNumber: string, code: string) {
  return fetchAPI(`/api/patent/navigate?appNumber=${appNumber}&code=${code}`);
}

// ✅ NPE 예측
export async function patentByNpecheck(appNumber: string) {
  return fetchAPI(`/api/patent/npecheck?appNumber=${appNumber}`);
}

// ✅ 신착특허 (홈 화면 티커용)
export async function getRecentPatents(limit: number = 20, section?: string) {
  const sectionParam = section ? `&section=${section}` : "";
  return fetchAPI(`/api/patent/recent?limit=${limit}${sectionParam}`);
}

// ✅ R&D공고 신착 (홈 화면 티커용)
export async function getRecentAnnouncements(limit: number = 10) {
  return fetchAPI(`/api/announcements/recent?limit=${limit}`);
}

// =========== collectionanalysis_router =========================
// 콜렉션 조회
export async function getCollectionList(): Promise<any> {
  return fetchAPI(`/api/collection/collect?collectionCode=`);
}

export async function collectionanalysisByCode(collectionCode: string) {
  return fetchAPI(`/api/collection/collect?collectionCode=${collectionCode}`)
}

// UMAP 데이터 조회
export async function getUmapData(collectionCode: string | string[]) {
  return fetchAPI(`/api/collection/analysis/umap`, {
    method: 'POST',
    body: JSON.stringify({ collection_code: collectionCode }),
  });
}

// ================ 기업 네비게이션 ===============================
export async function applicantByNavigate(appNumber: string, code: string) {
  return fetchAPI(`/api/patent/applicant-navigate?appNumber=${appNumber}&code=${code}`);
}

// =============== 대리인 관련 기능 ================================

// =============== 대리인 추천기능 ================================
export async function agentRecommend(appNumber: string, code: string) {
  return fetchAPI(`/api/agent/recommend?appNumber=${appNumber}&code=${code}`);
}

// ============== 대리인 사무소 통계 조회 =================================
export async function getAgentStatistics(agentCompany: string) {
  return fetchAPI(`/api/agent/company/${encodeURIComponent(agentCompany)}`);
}

// ============== 대리인 사무소 특허 목록 (CPC 섹션/연도별, 페이지 단위) ====================
export async function getAgentCompanyPatents(
  agentCompany: string,
  params: { section?: string; filingYear?: string; page?: number; pageSize?: number }
) {
  const qs = new URLSearchParams();
  if (params.section) qs.set("section", params.section);
  if (params.filingYear) qs.set("filing_year", params.filingYear);
  qs.set("page", String(params.page ?? 1));
  qs.set("page_size", String(params.pageSize ?? 5));
  return fetchAPI(`/api/agent/company/${encodeURIComponent(agentCompany)}/patents?${qs.toString()}`);
}

// ============== 대리인 조회 =====================================
export async function getAgentDetail(agentCode: string) {
  return fetchAPI(`/api/agent/people/${agentCode}`);
}

// ============= 사무소 추천정렬 ===================================
export async function getAgentSorting(
  option: string,
  params?: {
    city?: string;
    gu?: string;
    dong?: string;
    page?: number;
    page_size?: number;
    sort?: string; // 'recommend' | 'nearest' | 'oldest'
  }
) {
  const query = new URLSearchParams({
    option: option.toLowerCase(),
    page: (params?.page || 1).toString(),
    page_size: (params?.page_size || 10).toString(),
  });

  if (params?.sort) query.append("sort", params.sort);
  if (params?.city) query.append("city", params.city);
  if (params?.gu) query.append("gu", params.gu);
  if (params?.dong) query.append("dong", params.dong);

  return fetchAPI(`/api/agent/sorting?${query.toString()}`);
}

// ============== 사무소 명칭 검색 =====================================
export async function searchAgentCompany(query: string) {
  const encodedQuery = encodeURIComponent(query.trim());
  return fetchAPI(`/api/agent/search-company?q=${encodedQuery}`);
}

// ============= 사무소 키워드 검색 ====================================
export async function searchAgentKeyword(query: string, section: string, size: number = 60) {
  return fetchAPI(`/api/agent/search-keyword`, {
    method: 'POST',
    body: JSON.stringify({
      query: query.trim(),
      section: section,
      size: size
    })
  });
}


// ------------------------------------------------------------
// ✅ 국가 R&D 공고 (Research Projects) API 함수들
// ------------------------------------------------------------

/**
 * 통계 데이터 조회 (전체 공고 수, 진행 중 공고 수 등)
 */
export async function getStats(): Promise<any> {
  return fetchAPI('/api/announcements/stats');
}

/**
 * 공고 목록 조회
 */
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

/**
 * D-day 계산 유틸리티 함수 (API 호출 없이 로컬에서 계산)
 * @param endDate - 마감일 (YYYY-MM-DD)
 */
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


// -----------------------------
// 특허 검색 API 함수들 (GPU 서버 호출)
// -----------------------------

/**
 * ✅ Neo4j GPU 벡터 검색 (8001 포트)
 * StandardSearchView 혹은 [keyword].tsx 에서 호출
 */
export async function searchNeo4jVector({
  keyword,
  section,
  page = 1,
  page_size = 10,
}: {
  keyword: string;
  section: string | null;
  page: number;
  page_size: number;
}) {
  // 백엔드 경유(/api/search/neo4j-vector). 브라우저->GPU 직접호출은 https에서 Mixed Content로 막힘.
  return fetchAPI(`/api/search/neo4j-vector`, {
    method: "POST",
    body: JSON.stringify({
      keyword: keyword.trim(),
      section: section === "all" ? null : section, // 'all'이면 null로 보내 전체 검색 유도
      page: page,
      size: page_size, // 백엔드 수신 필드명 size
    }),
  });
}

export async function getPatentNavigationGpu(appNumber: string, code: string) {
  // 백엔드 라우터: @router.get("/navigate")
  // 호출 구조: /gpu/neo4j/navigate?appNumber=...&code=...
  const sectionCode = code;

  // 백엔드 경유(/api/search/neo4j-navigate). 브라우저->GPU 직접호출은 https에서 Mixed Content로 막힘.
  return fetchAPI(
    `/api/search/neo4j-navigate?appNumber=${appNumber.trim()}&code=${sectionCode}`,
    {
      method: "GET",
    }
  );
}

export async function getApplicantNavigate(
  appNumber: string,
  code: string,
  maxsize: number = 100,
  top_n: number = 10
) {
  // 백엔드 라우터 : @router.get("/applicant-navigate")
  // 호출 구조: /gpu/neo4j/applicant-navigate?
  const sectionCode = code;

  // 백엔드 경유(/api/search/neo4j-applicant-navigate). Mixed Content 회피.
  return fetchAPI(
    `/api/search/neo4j-applicant-navigate?appNumber=${appNumber.trim()}&code=${sectionCode}&maxsize=${maxsize}&top_n=${top_n}`,
    {
      method: "GET",
    }
  );
}