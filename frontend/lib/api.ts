// frontend/lib/api.ts

import { PathParamsContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";

// -----------------------------
// API 유틸리티 함수
// -----------------------------
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
export async function fetchAPI<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...options,
  });
  if (!res.ok) throw new Error(`API Error: ${res.status}`);
  return res.json();
}

// -----------------------------
// 특허 검색 API 함수들
// -----------------------------

// ✅ 키워드 검색 (BGEM3 + MLT)
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

// // ✅ 출원번호 검색
// export async function searchByApplication({
//   application_number,
//   page,
//   size,
// }: {
//   application_number: string;
//   page: number;
//   size: number;
// }) {
//   return fetchAPI(`/api/search/appnum`, {
//     method: "POST",
//     body: JSON.stringify({ application_number, page, size }),
//   });
// }

// // ✅ 등록번호 검색
// export async function searchByRegistration({
//   registration_number,
//   page,
//   size,
// }: {
//   registration_number: string;
//   page: number;
//   size: number;
// }) {
//   return fetchAPI(`/api/search/regnum`, {
//     method: "POST",
//     body: JSON.stringify({ registration_number, page, size }),
//   });
// }

// export async function getPatentPrice(appNumber: string) {
//     const

// ------------------------------------------------------------
// ✅ 페이지네이션 검색
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
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

  const requestBody = { app_number: appNumber };

  const res = await fetch(`${API_BASE}/api/patent/price`, {
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

//  2026-02-04 ~
// ================ 기업 네비게이션 ===============================
export async function applicantByNavigate(appNumber: string, code: string) {
  return fetchAPI(`/api/patent/applicant-navigate?appNumber=${appNumber}&code=${code}`);
}

// =============== 대리인 추천기능 ================================
export async function agentRecommend(appNumber: string, code: string) {
  return fetchAPI(`/api/agent/recommend?appNumber=${appNumber}&code=${code}`);
}
// ============== 대리인 사무소 통게 조회 =================================
export async function getAgentStatistics(agentCompany: string) {
  return fetchAPI(`/api/agent/company/${encodeURIComponent(agentCompany)}`);
}
// ============== 대리인 조회 =====================================
export async function getAgentDetail(agentCode: string) {
  return fetchAPI(`/api/agent/people/${agentCode}`);
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
 * 공고 목록 조회 (기존 fetch를 이 함수로 대체하여 사용 가능)
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

  // 날짜 형식이 유효하지 않은 경우 처리
  if (isNaN(end.getTime())) return '-';

  const diffTime = end.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return '마감';
  if (diffDays === 0) return 'D-day';
  return `D-${diffDays}`;
}

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
    // 기본값 설정 (페이지 1, 사이즈 10)
    page: (params?.page || 1).toString(),
    page_size: (params?.page_size || 10).toString(),
  });

  // 1. 정렬 기준이 있다면 추가 (recommend, nearest, oldest 등)
  if (params?.sort) {
    query.append("sort", params.sort);
  }

  // 2. 위치 정보가 있을 경우에만 쿼리에 추가
  // (이 로직을 통해 '가까운순'일 때만 좌표 정보가 백엔드로 전달됩니다)
  if (params?.city) query.append("city", params.city);
  if (params?.gu) query.append("gu", params.gu);
  if (params?.dong) query.append("dong", params.dong);

  return fetchAPI(`/api/agent/sorting?${query.toString()}`);
}



// ============== 사무소 명칭 검색 =====================================
export async function searchAgentCompany(query: string) {
  // query가 '한양'일 경우 확실하게 인코딩하여 전달합니다.
  const encodedQuery = encodeURIComponent(query.trim());
  return fetchAPI(`/api/agent/search-company?q=${encodedQuery}`);
}


// ============= 사무소 키워드 검색 ====================================
export async function searchAgentKeyword(query: string, section: string, size: number = 60) {
  return fetchAPI(`/api/agent/search-keyword`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: query.trim(),
      section: section,
      size: size
    })
  });
}