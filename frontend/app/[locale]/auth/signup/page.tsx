import { redirect } from 'next/navigation';
import { isIntegratedAuth, signupHref } from '@/lib/authNav';
import SignupForm from './SignupForm';

// 운영(통합 모드): 회원가입은 thinkcat.kr 포털에서만 → 포털로 리다이렉트
// 개발: 통합 쿠키를 받을 수 없으므로 자체 가입 폼 사용
export default function SignupPage() {
    if (isIntegratedAuth) {
        redirect(signupHref);
    }
    return <SignupForm />;
}
