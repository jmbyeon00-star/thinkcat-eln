import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { Mail, Lock, LogIn, Loader2, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const API_BASE = "http://192.168.1.20:8000";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!email || !pw) {
        setErr('이메일과 비밀번호를 입력해주세요.');
        return;
    }
    setLoading(true);
    try {
        const res = await fetch(`${API_BASE}/auth/signin`, {
            method: 'POST',
            credentials: "include",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password: pw, remember }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.detail || '로그인 실패');
        localStorage.setItem('user', JSON.stringify(data.user));
        window.location.href = '/';
    } catch (e: any) {
        setErr(e.message || '네트워크 오류');
    } finally {
        setLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>로그인 | IPFORCE</title>
      </Head>
      
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Logo Section */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-4">
              {/* <div className="w-1 h-12 bg-gradient-to-b from-blue-600 to-indigo-600 rounded-full" /> */}
              <img 
                src="/logo3.svg" 
                alt="IPFORCE Logo" 
                className="h-12"
              />
            </div>
            <h1 className="text-3xl font-bold text-zinc-900 mb-2">
              로그인
            </h1>
            <p className="text-zinc-600">
              계정으로 접속해 IPFORCE 서비스를 이용하세요
            </p>
          </div>

          {/* Login Card */}
          <div className="bg-white rounded-2xl shadow-xl border border-zinc-100 overflow-hidden">
            {/* Card Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6">
              <div className="flex items-center gap-3">
                <LogIn className="w-6 h-6 text-white" />
                <h2 className="text-xl font-semibold text-white">
                  계정 로그인
                </h2>
              </div>
            </div>

            {/* Form Content */}
            <div className="p-8">
              {/* Error Message */}
              {err && (
                <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-900">로그인 오류</p>
                    <p className="text-sm text-red-800 mt-1">{err}</p>
                  </div>
                </div>
              )}

              <div className="space-y-5">
                {/* Email Input */}
                <div>
                  <label className="block text-sm font-semibold text-zinc-700 mb-2 flex items-center gap-2">
                    <div className="w-1 h-4 bg-gradient-to-b from-blue-600 to-indigo-600 rounded-full" />
                    <Mail size={16} className="text-zinc-600" />
                    이메일
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    disabled={loading}
                    className="w-full px-4 py-3 bg-white border-2 border-zinc-200 rounded-xl 
                      focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100
                      text-zinc-900 placeholder-zinc-400
                      transition-all duration-200
                      disabled:bg-zinc-50 disabled:cursor-not-allowed
                      shadow-sm hover:shadow-md"
                  />
                </div>

                {/* Password Input */}
                <div>
                  <label className="block text-sm font-semibold text-zinc-700 mb-2 flex items-center gap-2">
                    <div className="w-1 h-4 bg-gradient-to-b from-blue-600 to-indigo-600 rounded-full" />
                    <Lock size={16} className="text-zinc-600" />
                    비밀번호
                  </label>
                  <input
                    type="password"
                    value={pw}
                    onChange={(e) => setPw(e.target.value)}
                    placeholder="••••••••"
                    disabled={loading}
                    className="w-full px-4 py-3 bg-white border-2 border-zinc-200 rounded-xl 
                      focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100
                      text-zinc-900 placeholder-zinc-400
                      transition-all duration-200
                      disabled:bg-zinc-50 disabled:cursor-not-allowed
                      shadow-sm hover:shadow-md"
                  />
                </div>

                {/* Remember & Forgot */}
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                      disabled={loading}
                      className="w-4 h-4 text-blue-600 border-zinc-300 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer disabled:cursor-not-allowed"
                    />
                    <span className="text-sm text-zinc-700 group-hover:text-zinc-900 transition-colors">
                      로그인 상태 유지
                    </span>
                  </label>
                  <Link
                    href="/forgot"
                    className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline transition-colors"
                  >
                    비밀번호 찾기
                  </Link>
                </div>

                {/* Submit Button */}
                <button
                  onClick={onSubmit}
                  disabled={loading || !email || !pw}
                  className="w-full px-6 py-3.5 text-base font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 
                    hover:from-blue-700 hover:to-indigo-700
                    disabled:from-zinc-300 disabled:to-zinc-400 disabled:cursor-not-allowed
                    rounded-xl shadow-lg hover:shadow-xl
                    transition-all duration-200
                    flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 size={20} className="animate-spin" />
                      <span>로그인 중...</span>
                    </>
                  ) : (
                    <>
                      <LogIn size={20} />
                      <span>로그인</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="px-8 py-5 bg-zinc-50 border-t border-zinc-100 text-center">
              <p className="text-sm text-zinc-600">
                처음 방문하셨나요?{' '}
                <Link
                  href="/auth/signup"
                  className="font-semibold text-blue-600 hover:text-blue-700 hover:underline transition-colors"
                >
                  회원가입
                </Link>
              </p>
            </div>
          </div>

          {/* Additional Info */}
          <div className="mt-6 text-center">
            <p className="text-xs text-zinc-500">
              로그인에 문제가 있으신가요?{' '}
              <Link
                href="/support"
                className="text-blue-600 hover:text-blue-700 hover:underline"
              >
                고객 지원
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}