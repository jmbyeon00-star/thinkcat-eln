'use client';

import { useSession, signIn } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { useRouter, Link } from '@/routing';
import { useSearchParams } from 'next/navigation';
import { Mail, Lock, LogIn, Loader2, AlertCircle, ArrowLeft, Sparkles } from 'lucide-react';

export default function LoginPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { status } = useSession();

    const [email, setEmail] = useState('');
    const [pw, setPw] = useState('');
    const [remember, setRemember] = useState(true);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    useEffect(() => {
        if (status === 'authenticated') {
            // callbackUrl은 이미 locale prefix(/ko/...)를 포함하므로 locale을 자동으로 붙이는
            // @/routing router.push 대신 raw 네비게이션을 써서 /ko/ko/... 이중 prefix를 방지한다.
            const callbackUrl = searchParams.get('callbackUrl') || '/';
            window.location.href = callbackUrl;
        }
    }, [status, searchParams]);

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setErr(null);

        if (!email || !pw) {
            setErr('이메일과 비밀번호를 입력해주세요.');
            return;
        }

        setLoading(true);
        try {
            const res = await signIn('credentials', {
                redirect: false,
                username: email,
                password: pw,
            });

            if (res?.error) throw new Error(res.error);
            if (res?.ok) {
                const callbackUrl = searchParams.get('callbackUrl') || '/';
                window.location.href = callbackUrl;
            }
        } catch (e: any) {
            setErr(e.message || '로그인에 실패했습니다. 정보를 확인해주세요.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="w-full max-w-[480px] animate-in fade-in slide-in-from-bottom-4 duration-1000">
                {/* 상단 로고 및 텍스트 */}
                <div className="text-center mb-8">
                    {/* <Link href="/" className="inline-block mb-8 group transition-transform active:scale-95">
                        <span className="text-3xl font-black tracking-tighter text-zinc-900 leading-none">
                            THINKCAT-ELN
                            <span className="text-orange-600 transition-colors group-hover:text-red-600">.</span>
                        </span>
                    </Link> */}
                    <h1 className="text-3xl font-black text-zinc-900 tracking-tight mb-2">다시 오신 것을 환영합니다</h1>
                    <p className="text-zinc-500 font-medium text-sm">분석 워크스페이스에 접속하여 통찰력을 발견하세요.</p>
                </div>

                {/* 로그인 카드 */}
                <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-zinc-200/50 border border-zinc-100 p-10 relative overflow-hidden">
                    {/* 에러 메시지 */}
                    {err && (
                        <div className="mb-8 bg-red-50 border border-red-100 rounded-2xl p-4 flex items-start gap-3 animate-in shake duration-500">
                            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                            <p className="text-sm font-bold text-red-800 leading-snug">{err}</p>
                        </div>
                    )}

                    <form onSubmit={onSubmit} className="space-y-6">
                        <div className="space-y-5">
                            {/* 이메일 입력 */}
                            <div className="space-y-2">
                                {/* <label className="flex items-center gap-2 text-[11px] font-black text-zinc-400 uppercase tracking-widest ml-1">
                                    <Mail size={12} className="text-blue-600" /> Email Address
                                </label> */}
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="you@company.com"
                                    className="w-full px-6 py-3.5 bg-zinc-50 border-none rounded-2xl focus:bg-white focus:ring-4 focus:ring-blue-50 outline-none transition-all font-medium text-zinc-900 placeholder:text-zinc-300 shadow-inner"
                                    disabled={loading}
                                    required
                                />
                            </div>

                            {/* 비밀번호 입력 */}
                            <div className="space-y-2">
                                <input
                                    type="password"
                                    value={pw}
                                    onChange={(e) => setPw(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full px-6 py-3.5 bg-zinc-50 border-none rounded-2xl focus:bg-white focus:ring-4 focus:ring-blue-50 outline-none transition-all font-medium text-zinc-900 placeholder:text-zinc-300 shadow-inner"
                                    disabled={loading}
                                    required
                                />
                                <div className="flex justify-between items-end ml-1">
                                    {/* <label className="flex items-center gap-2 text-[11px] font-black text-zinc-400 uppercase tracking-widest">
                                        <Lock size={12} className="text-blue-600" /> Password
                                    </label> */}
                                    <Link href="/forgot" className="text-[10px] font-bold text-zinc-400 hover:text-blue-600 transition-colors">
                                        비밀번호를 잊으셨나요?
                                    </Link>
                                </div>
                            </div>
                        </div>

                        {/* 로그인 상태 유지 */}
                        <div className="flex items-center">
                            <label className="flex items-center gap-3 cursor-pointer group select-none">
                                <div className="relative">
                                    <input
                                        type="checkbox"
                                        checked={remember}
                                        onChange={(e) => setRemember(e.target.checked)}
                                        className="peer sr-only"
                                        disabled={loading}
                                    />
                                    <div className="w-5 h-5 border-2 border-zinc-200 rounded-md bg-white peer-checked:bg-blue-600 peer-checked:border-blue-600 transition-all group-hover:border-blue-400" />
                                    <svg className="absolute top-1 left-1 w-3 h-3 text-white scale-0 peer-checked:scale-100 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <span className="text-sm font-bold text-zinc-500 group-hover:text-zinc-900 transition-colors">로그인 상태 유지</span>
                            </label>
                        </div>

                        {/* 로그인 버튼 */}
                        <button
                            type="submit"
                            disabled={loading || !email || !pw}
                            className="w-full bg-zinc-900 text-white py-5 rounded-[1.5rem] font-black shadow-xl hover:bg-black disabled:bg-zinc-100 disabled:text-zinc-300 disabled:shadow-none transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 group mt-4"
                        >
                            {loading ? (
                                <>
                                    <Loader2 size={20} className="animate-spin text-zinc-400" />
                                    <span>인증 중...</span>
                                </>
                            ) : (
                                <>
                                    <LogIn size={20} className="group-hover:translate-x-1 transition-transform" />
                                    <span>시스템 접속</span>
                                </>
                            )}
                        </button>
                    </form>
                </div>

                {/* 푸터 영역 */}
                <div className="mt-8 flex flex-col items-center gap-6">
                    <p className="text-sm font-bold text-zinc-400">
                        계정이 없으신가요?{' '}
                        <Link href="/auth/signup" className="text-blue-600 hover:text-blue-700 underline underline-offset-4 decoration-2">
                            무료 회원가입
                        </Link>
                    </p>

                    <button onClick={() => router.push('/')} className="flex items-center gap-2 text-[11px] font-black text-zinc-300 hover:text-zinc-900 uppercase tracking-widest transition-colors">
                        <ArrowLeft size={14} /> Back to main
                    </button>
                </div>
        </div>
    );
}
