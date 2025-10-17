// frontend/lib/api.ts
// export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";
const API_BASE = "http://192.168.1.20:8000"

export async function apiJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...options,
  });
  if (!res.ok) throw new Error(`API Error: ${res.status}`);
  return res.json();
}

// ✅ 키워드 검색 (BGEM3 + MLT)
export async function searchKeyword({
  keyword,
  category,
  page,
  size,
}: {
  keyword: string;
  category: string;
  page: number;
  size: number;
}) {
  return apiJson(`/api/search/keyword/${category}`, {
    method: "POST",
    body: JSON.stringify({ keyword, page, size }),
  });
}

// ✅ 출원번호 검색
export async function searchByApplication({
  application_number,
  page,
  size,
}: {
  application_number: string;
  page: number;
  size: number;
}) {
  return apiJson(`/api/search/by-application`, {
    method: "POST",
    body: JSON.stringify({ application_number, page, size }),
  });
}

// ✅ 등록번호 검색
export async function searchByRegistration({
  registration_number,
  page,
  size,
}: {
  registration_number: string;
  page: number;
  size: number;
}) {
  return apiJson(`/api/search/by-registration`, {
    method: "POST",
    body: JSON.stringify({ registration_number, page, size }),
  });
}

export async function getPatentPrice(appNumber: string) {
    // const base = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
    const base = "http://192.168.1.20:8000"
    const res = await fetch(`${base}/api/patent/price`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app_number: appNumber }),
    });
    if (!res.ok) throw new Error("Failed to fetch patent price");
    return res.json();
  }
  