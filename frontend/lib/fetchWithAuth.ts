export async function fetchWithAuth(url: string, options: RequestInit = {}) {
    // const base = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
    const base = process.env.NEXT_PUBLIC_API_BASE_URL || "http://192.168.1.20:8000";
    const res = await fetch(`${base}${url}`, {
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
  