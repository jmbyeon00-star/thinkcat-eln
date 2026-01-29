// utils/common.ts
import { DedupConfig, NewDataSourceInfo } from '@/types/project'
/*
 * 중복 제거에 사용할 최종 키 목록과 활성화 여부를 결정합니다.
 * @param newDataSourceInfo - 새로 추가된 데이터 정보 (sourceType, standardDedupKey 등)
 * @param customDedupKeys - 유저가 직접 선택한 커스텀 키 목록
 * @param isDeduplicationEnabled - 유저가 중복 제거를 활성화했는지 여부
 * @returns { enabled: boolean, keys: string[] | null }
*/
export const getDeduplicationConfig = (
    newDataSourceInfo: NewDataSourceInfo | null,
    customDedupKeys: string[],
    isDeduplicationEnabled: boolean
): DedupConfig => {

    // 1. 유저가 명시적으로 비활성화한 경우, 키 유무와 상관없이 비활성화
    if (!isDeduplicationEnabled) {
        return { enabled: false, keys: null };
    }

    let finalKeys: string[] | null = null;

    // 2. 표준 키 (예: '출원번호')가 있으면, 이를 최우선으로 사용
    if (newDataSourceInfo?.standardDedupKey) {
        finalKeys = [newDataSourceInfo.standardDedupKey];
    }
    // 3. 표준 키가 없고, 커스텀 키가 선택된 경우, 이를 사용
    else if (customDedupKeys.length > 0) {
        finalKeys = customDedupKeys;
    }

    return {
        // 키가 null이 아닐 때만 enabled = true
        enabled: finalKeys !== null,
        keys: finalKeys,
    };
};

// 'YYYY-MM-DDTHH:mm:ss...' 형식의 문자열에서 날짜(YYYY-MM-DD)만 추출하는 함수
export function setDatetimeToDate(dateTimeString: string | null | undefined): string {
    if (!dateTimeString) {
        return "";
    }
    // T를 기준으로 분리하거나, 앞에서 10글자만 잘라냅니다.
    // dateTimeString.slice(0, 10)을 사용해도 무방합니다.
    const parts = dateTimeString.split('T');
    return parts[0];

}

/**
 * ISO 형식의 날짜/시간 문자열을 현재 시간과의 상대적인 시간 문자열로 변환합니다.
 * (예: "2시간 전", "3일 전")  
 * @param dateTimeString - 'YYYY-MM-DDTHH:mm:ssZ' 형식의 날짜/시간 문자열 (string)
 * @returns 상대적인 시간을 나타내는 문자열 (string)
 */
export function formatTimeAgo(dateTimeString: string | null | undefined): string {
    if (!dateTimeString) {
        return "알 수 없음";
    }

    // 1. Date 객체 생성 및 시간 차이 계산
    const now: Date = new Date();
    const past: Date = new Date(dateTimeString);

    // 날짜가 유효하지 않은 경우
    if (isNaN(past.getTime())) {
        return "날짜 형식 오류";
    }

    // 시간 차이 (밀리초 단위)
    const diff: number = now.getTime() - past.getTime();

    // 시간 단위 상수 정의 (밀리초 기준)
    const MINUTE: number = 60 * 1000;
    const HOUR: number = 60 * MINUTE;
    const DAY: number = 24 * HOUR;
    const MONTH: number = 30 * DAY; // 근사치
    const YEAR: number = 365 * DAY; // 근사치

    // 2. 차이에 따라 적절한 단위로 변환
    if (diff < MINUTE) {
        return "방금 전";
    }

    if (diff < HOUR) {
        return `${Math.floor(diff / MINUTE)}분 전`;
    }

    if (diff < DAY) {
        return `${Math.floor(diff / HOUR)}시간 전`;
    }

    if (diff < MONTH) {
        return `${Math.floor(diff / DAY)}일 전`;
    }

    if (diff < YEAR) {
        return `${Math.floor(diff / MONTH)}개월 전`;
    }

    return `${Math.floor(diff / YEAR)}년 전`;
}
// export function setDatetimeToDate() {}는 위에서 구현되었습니다.

// 두 함수 모두 export 되었으므로, 별도의 default export는 제거했습니다.
// 필요하다면, export { formatTimeAgo, setDatetimeToDate }; 도 가능합니다.


export function getQueryString(
    value: string | string[] | undefined
): string | undefined {
    if (typeof value !== "string") return undefined;

    try {
        return decodeURIComponent(value);
    } catch {
        // 혹시 잘못 인코딩된 값 방어
        return value;
    }
}

export function authHeader(token?: string) {
    return token ? { Authorization: `Bearer ${token}` } : {};
}

export function truncateText(text: string | undefined, maxLength: number = 100) {
    if (!text) return "-";
    return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
};