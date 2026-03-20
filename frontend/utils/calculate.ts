//  /utils/calculate.ts
import { HistorySegment } from "@/types/ai";

export function getEpochInfo(segments: HistorySegment[] = []) {
    if (!segments || segments.length === 0) {
        return { prevEpoch: 0, added: 0 };
    }

    // 각 세그먼트에서 epoch 수를 안전하게 가져오는 헬퍼 함수
    const getVal = (s: any) => {
        // 1. 복수형(epochs) 확인 -> 2. 단수형(epoch) 확인 -> 3. 데이터 배열 길이 확인 -> 4. 기본값 0
        return s.epochs ?? s.epoch ?? s.train_acc?.length ?? 0;
    };

    const len = segments.length;

    // 1개면 그대로
    if (len === 1) {
        return { prevEpoch: segments[0].epochs, added: 0 };
    }

    // 2개 이상일 때 로직 통합 (slice와 reduce 사용)
    const prevEpoch = segments
        .slice(0, len - 1)
        .reduce((acc, s) => acc + getVal(s), 0);
    const added = getVal(segments[len - 1]);

    return { prevEpoch, added };
}

export function getBestAccuracyInfo(segments: HistorySegment[] = []) {
    if (!Array.isArray(segments) || segments.length === 0) {
        return { prevBestAccuracy: null, recentBestAccuracy: null };
    }

    // 한 번만 학습한 경우
    if (segments.length === 1) {
        const prevBestAccuracy = Math.max(...segments[0].valid_acc);
        return { prevBestAccuracy, recentBestAccuracy: null };
    }

    // 두 번 학습한 경우 (초기 + 추가 1회)
    if (segments.length === 2) {
        const prevBestAccuracy = Math.max(...segments[0].valid_acc);
        const recentBestAccuracy = Math.max(...segments[1].valid_acc);
        return { prevBestAccuracy, recentBestAccuracy };
    }

    // 3개 이상: 0 ~ n-2 모두의 최고 + 마지막 n-1의 최고
    const lastIndex = segments.length - 1;

    // 기존 + 이전 추가학습 (0 ~ n-2)
    const prevSegments = segments.slice(0, lastIndex);
    const prevBestAccuracy = Math.max(
        ...prevSegments.flatMap(s => s.valid_acc)
    );

    // 최근 추가학습 segment (n-1)
    const recentBestAccuracy = Math.max(...segments[lastIndex].valid_acc);

    return { prevBestAccuracy, recentBestAccuracy };
}