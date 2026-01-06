export async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    credentials: "include", // ✅ JWT 쿠키 자동 포함
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`Auth request failed (${res.status})`);
  return res.json();
}
