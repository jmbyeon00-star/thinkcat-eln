// utils/auth.ts
export function getUserId(): number | null {
    if (typeof window === 'undefined') return null

    const token = localStorage.getItem('access_token')
    if (!token) return null

    try {
        const payload = JSON.parse(atob(token.split('.')[1]))
        return Number(payload.sub)
    } catch {
        return null
    }
}
