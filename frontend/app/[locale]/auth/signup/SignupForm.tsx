'use client';

import React, { useState, useMemo } from 'react';
import { useRouter, Link } from '@/routing'; // 🚀 수정된 부분
import { User, Mail, Lock, UserPlus, Loader2, AlertCircle, ArrowLeft, CheckCircle2, ShieldCheck } from 'lucide-react';

function validateEmail(v: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}
function pwScore(v: string) {
    let s = 0;
    if (v.length >= 8) s++;
    if (/[0-9]/.test(v)) s++;
    if (/[a-zA-Z]/.test(v)) s++;
    if (/[^0-9a-zA-Z]/.test(v)) s++;
    return s;
}

export default function SignupForm() {
    const router = useRouter();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [pw, setPw] = useState('');
    const [pw2, setPw2] = useState('');
    const [agree, setAgree] = useState(false);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const emailOk = useMemo(() => validateEmail(email), [email]);
    const score = useMemo(() => pwScore(pw), [pw]);
    const pwOk = useMemo(() => pw.length >= 8 && pw === pw2, [pw, pw2]);
    const canSubmit = name && emailOk && pwOk && agree && !loading;

    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setErr(null);
        if (!canSubmit) return;

        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/user/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password: pw, agree }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.detail || '회원가입 실패');
            window.location.href = '/';
        } catch (e: any) {
            setErr(e.message || '네트워크 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="w-full max-w-[480px] animate-in fade-in slide-in-from-bottom-4 duration-1000">
                <div className="text-center mb-8">
                    {/* <Link href="/" className="inline-block mb-6 group transition-transform active:scale-95">
                        <span className="text-3xl font-black tracking-tighter text-zinc-900 leading-none">
                            THINKCAT-ELN
                            <span className="text-orange-600 transition-colors group-hover:text-red-600">.</span>
                        </span>
                    </Link> */}
                    <h1 className="text-3xl font-black text-zinc-900 tracking-tight mb-2">계정 만들기</h1>
                    <p className="text-zinc-500 font-medium text-sm text-center">최첨단 AI 특허 분석 솔루션을 경험해 보세요.</p>
                </div>

                <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-zinc-200/50 border border-zinc-100 p-10 relative">
                    {err && (
                        <div className="mb-6 bg-red-50 border border-red-100 rounded-2xl p-4 flex items-start gap-3 animate-in shake">
                            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                            <p className="text-sm font-bold text-red-800">{err}</p>
                        </div>
                    )}

                    <form onSubmit={onSubmit} className="space-y-5">
                        <div className="space-y-2 text-left">
                            {/* <label className="flex items-center gap-2 text-[11px] font-black text-zinc-400 uppercase tracking-widest ml-1">
                                <User size={12} className="text-blue-600" /> Name
                            </label> */}
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="성함 또는 기업명"
                                className="w-full px-6 py-3.5 bg-zinc-50 border-none rounded-2xl focus:bg-white focus:ring-4 focus:ring-blue-50 outline-none transition-all font-medium text-zinc-900 placeholder:text-zinc-300 shadow-inner"
                                disabled={loading}
                            />
                        </div>

                        <div className="space-y-2 text-left">
                            {/* <label className="flex items-center gap-2 text-[11px] font-black text-zinc-400 uppercase tracking-widest ml-1">
                                <Mail size={12} className="text-blue-600" /> Business Email
                            </label> */}
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@company.com"
                                className={`w-full px-6 py-3.5 bg-zinc-50 border-2 rounded-2xl focus:bg-white focus:ring-4 focus:ring-blue-50 outline-none transition-all font-medium text-zinc-900 placeholder:text-zinc-300 shadow-inner ${email.length > 0 && !emailOk ? 'border-red-100 bg-red-50/30' : 'border-transparent'}`}
                                disabled={loading}
                            />
                            {email.length > 0 && !emailOk && <p className="text-[10px] text-red-500 font-bold ml-1 text-left">올바른 이메일 형식이 아닙니다.</p>}
                        </div>

                        <div className="space-y-2 text-left">
                            {/* <label className="flex items-center gap-2 text-[11px] font-black text-zinc-400 uppercase tracking-widest ml-1">
                                <Lock size={12} className="text-blue-600" /> Password
                            </label> */}
                            <input
                                type="password"
                                value={pw}
                                onChange={(e) => setPw(e.target.value)}
                                placeholder="8자 이상 / 영문, 숫자, 특수문자 조합"
                                className="w-full px-6 py-3.5 bg-zinc-50 border-none rounded-2xl focus:bg-white focus:ring-4 focus:ring-blue-50 outline-none transition-all font-medium text-zinc-900 placeholder:text-zinc-300 shadow-inner"
                                disabled={loading}
                            />
                            {pw.length > 0 && (
                                <div className="px-1 pt-1">
                                    <div className="flex gap-1 h-1.5 mb-1.5">
                                        {[...Array(4)].map((_, i) => (
                                            <div key={i} className={`flex-1 rounded-full transition-colors ${i < score ? (score <= 2 ? 'bg-orange-400' : 'bg-blue-600') : 'bg-zinc-200'}`} />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="space-y-2 text-left">
                            {/* <label className="flex items-center gap-2 text-[11px] font-black text-zinc-400 uppercase tracking-widest ml-1">
                                <ShieldCheck size={12} className="text-blue-600" /> Confirm Password
                            </label> */}
                            <input
                                type="password"
                                value={pw2}
                                onChange={(e) => setPw2(e.target.value)}
                                placeholder="비밀번호를 다시 입력하세요"
                                className={`w-full px-6 py-3.5 bg-zinc-50 border-2 rounded-2xl focus:bg-white focus:ring-4 focus:ring-blue-50 outline-none transition-all font-medium text-zinc-900 placeholder:text-zinc-300 shadow-inner ${pw2.length > 0 && pw !== pw2 ? 'border-red-100 bg-red-50/30' : 'border-transparent'}`}
                                disabled={loading}
                            />
                        </div>

                        <div className="pt-2 text-left">
                            <label className="flex items-start gap-3 cursor-pointer group select-none">
                                <div className="relative mt-0.5">
                                    <input
                                        type="checkbox"
                                        checked={agree}
                                        onChange={(e) => setAgree(e.target.checked)}
                                        className="peer sr-only"
                                        disabled={loading}
                                    />
                                    <div className="w-5 h-5 border-2 border-zinc-200 rounded-md bg-white peer-checked:bg-blue-600 peer-checked:border-blue-600 transition-all group-hover:border-blue-400" />
                                    <CheckCircle2 size={12} className="absolute top-1 left-1 text-white scale-0 peer-checked:scale-100 transition-transform stroke-[4]" />
                                </div>
                                <span className="text-xs font-bold text-zinc-500 group-hover:text-zinc-900 transition-colors leading-relaxed">
                                    (필수) 이용약관 및 개인정보 처리방침에 동의합니다.
                                </span>
                            </label>
                        </div>

                        <button
                            type="submit"
                            disabled={!canSubmit}
                            className="w-full bg-zinc-900 text-white py-5 rounded-[1.5rem] font-black shadow-xl hover:bg-black disabled:bg-zinc-100 disabled:text-zinc-300 disabled:shadow-none transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 group mt-4"
                        >
                            {loading ? (
                                <>
                                    <Loader2 size={20} className="animate-spin text-zinc-400" />
                                    <span>계정 생성 중...</span>
                                </>
                            ) : (
                                <>
                                    <UserPlus size={20} className="group-hover:scale-110 transition-transform" />
                                    <span>가입하기</span>
                                </>
                            )}
                        </button>
                    </form>
                </div>

                <div className="mt-8 text-center">
                    <p className="text-sm font-bold text-zinc-400">
                        이미 계정이 있으신가요?{' '}
                        <Link href="/auth/signin" className="text-blue-600 hover:text-blue-700 underline underline-offset-4 decoration-2">
                            로그인하기
                        </Link>
                    </p>
                </div>
        </div>
    );
}
