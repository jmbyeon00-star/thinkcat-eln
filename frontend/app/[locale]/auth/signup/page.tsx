import { redirect } from 'next/navigation';

// 회원가입은 통합 계정(thinkcat.kr 포털)에서만 받는다.
// 기존 자체 가입 폼은 page.form-backup.tsx.bak 참고 (SSO 연동 전 임시 조치)
export default function SignupPage() {
    redirect('https://www.thinkcat.kr/portal/signup');
}
