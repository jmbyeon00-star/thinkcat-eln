// utils/handleRedirectLogic.ts
import { NextRouter } from 'next/router';

interface RedirectParams {
    router: NextRouter;
    project_id: string;
    source_type: string; // API에서 받은 source_type ('UPLOAD' 또는 'SEARCH')
}

/*
 * 현재 URL의 서브 경로와 프로젝트의 필수 source_type을 비교하여 리디렉션합니다.
 *
 * @returns {boolean} 리디렉션이 발생했으면 true, 아니면 false를 반환합니다.
*/
export function handleRedirectLogic({
    router,
    project_id,
    source_type,
}: RedirectParams): boolean {

    // 1. 현재 URL 경로에서 서브 타입 추출 (예: 'upload' 또는 'search')
    // router.asPath는 router.isReady 이후에 사용해야 안전합니다.
    const currentPath = router.asPath;
    const currentSubPath = currentPath.split('/').pop()?.toLowerCase();

    // 2. API 데이터의 source_type을 소문자로 변환하여 비교 대상 준비
    const requiredSubPath = source_type.toLowerCase();

    // 3. 경로가 일치하지 않는 경우 리디렉션 실행
    if (currentSubPath && currentSubPath !== requiredSubPath) {

        const newPath = `/project/${project_id}/data/${requiredSubPath}`;

        // router.replace를 사용하여 히스토리를 오염시키지 않고 경로를 교체합니다.
        router.replace(newPath);

        return true; // 리디렉션 발생
    }

    return false; // 리디렉션 불필요
}