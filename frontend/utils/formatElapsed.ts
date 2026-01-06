// utils/formatElapsed.ts

export function formatElapsed(ms: number): string {
    const seconds = ms / 1000;

    // 👉 60초 미만이면: "N초"
    if (seconds < 60) {
        return `${seconds.toFixed(2)}초`;
    }

    // 👉 60초 이상 3600초 미만이면: "N분 M초"
    if (seconds < 3600) {
        const minutes = Math.floor(seconds / 60);
        const sec = Math.floor(seconds % 60); // 정수로 표시

        // 초가 0이면 "N분"만 표시 가능 (원하면)
        if (sec === 0) return `${minutes}분`;

        return `${minutes}분 ${sec}초`;
    }

    // 👉 1시간 이상이면 (확장용)
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (minutes === 0) return `${hours}시간`;

    return `${hours}시간 ${minutes}분`;
}
