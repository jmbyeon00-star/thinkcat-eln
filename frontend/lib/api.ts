// frontend/lib/api.ts

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

// export const GPU_BACKEND_URL = process.env.GPU_BACKEND_URL ?? "http://125.141.113.2:7001"
// export async function fetchGPU<T>(url: string, options?: RequestInit): Promise<T> {
//   const res = await fetch(`${GPU_BACKEND_URL}${url}`, {
//     headers: { "Content-Type": "application/json" },
//     credentials: "include",
//     ...options,
//   });
//   if (!res.ok) throw new Error(`API Error: ${res.status}`);
//   return res.json();
// }

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
//     const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
//     const res = await fetch(`${API_BASE}/api/patent/price`, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ app_number: appNumber }),
//     });
//     if (!res.ok) throw new Error("Failed to fetch patent price");
//     return res.json();
//   }


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
// export async function getPatentPrice(appNumber: string) {
//   const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
//   const res = await fetch(`${API_BASE}/api/patent/price`, {
//     method: "POST",
//     headers: { "Content-Type": "application/json" }, 
//   });
//   if (!res.ok) throw new Error("Failed to fetch patent price");
//   return res.json();
// }
export async function getPatentPrice(appNumber: string) {
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

  const requestBody = { app_number: appNumber };

  console.log("=== getPatentPrice Request ===");
  console.log("URL:", `${API_BASE}/api/patent/price`);
  console.log("Method:", "POST");
  console.log("Headers:", { "Content-Type": "application/json" });
  console.log("Body:", JSON.stringify(requestBody));
  console.log("appNumber:", appNumber);
  console.log("=============================");

  const res = await fetch(`${API_BASE}/api/patent/price`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  console.log("=== Response ===");
  console.log("Status:", res.status);
  console.log("Status Text:", res.statusText);
  console.log("===============");

  if (!res.ok) {
    const errorText = await res.text();
    console.error("=== Error Response ===");
    console.error("Status:", res.status);
    console.error("Body:", errorText);
    console.error("====================");
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
// ✅ 올바른 방법
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