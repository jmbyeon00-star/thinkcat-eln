// utils/randomSeed.ts
function seededRandomColor(seed: number) {
    // 간단한 seed 기반 난수
    let x = Math.sin(seed) * 10000;
    const r = Math.floor((x - Math.floor(x)) * 256);

    x = Math.sin(seed * 2) * 10000;
    const g = Math.floor((x - Math.floor(x)) * 256);

    x = Math.sin(seed * 3) * 10000;
    const b = Math.floor((x - Math.floor(x)) * 256);

    return `rgb(${r}, ${g}, ${b})`;
}
function generateUniqueColor(usedColors: Set<string>, seed: number) {
    let hue = (seed * 137.508) % 360; // 균등한 색 분포
    let color = `hsl(${hue}, 70%, 50%)`;

    let step = 1;
    while (
        usedColors.has(color) ||
        color === "#16a34a" ||
        color === "#ff0000") {
        hue = (hue + 23 * step) % 360;  // 충돌 회피
        color = `hsl(${hue}, 70%, 50%)`;
        step++;
    }

    usedColors.add(color);
    return color;
}

export function getSegmentColor(usedColors: Set<string>, segIndex: number, lastIndex: number) {
    if (segIndex === 0) {
        usedColors.add("#16a34a");
        return "#16a34a"; // 초기 학습
    }

    if (segIndex === lastIndex) {
        usedColors.add("#ff0000");
        return "#ff0000"; // 마지막 추가학습
    }

    return generateUniqueColor(usedColors, segIndex);
}