// pages/auth/verify.tsx
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';

// const API_BASE = process.env.NEXT_PUBLIC_API_BASE; // 예: http://localhost:8000
const API_BASE = "http://192.168.1.20:8000"

type Phase = 'checking' | 'form' | 'success' | 'error';

export default function VerifyPage() {
  const router = useRouter();
  const qEmail = typeof router.query.email === 'string' ? router.query.email : '';
  const qCode  = typeof router.query.code  === 'string' ? router.query.code  : '';

  const [email, setEmail] = useState(qEmail);
  const [code, setCode]   = useState(qCode);
  const [phase, setPhase] = useState<Phase>('checking');
  const [message, setMessage] = useState('인증 처리 중입니다...');

  const canAuto = useMemo(() => !!(qEmail && qCode), [qEmail, qCode]);

  useEffect(() => {
    if (!canAuto) {
      setPhase('form');
      setMessage('이메일과 인증 코드를 입력하세요.');
      return;
    }
    (async () => {
      await doVerify(qEmail, qCode);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAuto]);

  async function doVerify(e: string, c: string) {
    setPhase('checking');
    setMessage('인증 처리 중입니다...');
    console.log("API_BASE:", API_BASE)
    try {
      const res = await fetch(`${API_BASE}/auth/verify`, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ email: e, code: c })
      });
      const j = await res.json();

      if (res.ok) {
        setPhase('success');
        setMessage('인증이 완료되었습니다. 잠시 후 로그인 페이지로 이동합니다.');
        setTimeout(() => router.replace('/auth/signin'), 1500);
      } else {
        setPhase('error');
        setMessage(j.detail || '인증에 실패했습니다. 코드를 다시 확인해주세요.');
      }
    } catch (err) {
      setPhase('error');
      setMessage('서버 통신 오류가 발생했습니다.');
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await doVerify(email.trim(), code.trim());
  }

  return (
    <main style={{maxWidth: 480, margin: '40px auto', padding: '0 16px'}}>
      <h1 style={{marginBottom: 8}}>이메일 인증</h1>
      <p style={{color:'#666', marginBottom: 24}}>
        가입 시 받은 인증 코드를 입력하거나, 메일의 버튼을 눌러 이 페이지에 접속하세요.
      </p>

      {(phase === 'checking') && (
        <div style={{padding: '12px 16px', background:'#f5f5f5', borderRadius: 8}}>
          {message}
        </div>
      )}

      {(phase === 'error' || phase === 'form') && (
        <form onSubmit={onSubmit} className="card" style={{display:'grid', gap:12}}>
          <label style={{display:'grid', gap:6}}>
            <span>이메일</span>
            <input
              type="email"
              value={email}
              onChange={e=>setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              style={{padding:'10px 12px', border:'1px solid #ccc', borderRadius:8}}
            />
          </label>
          <label style={{display:'grid', gap:6}}>
            <span>인증 코드 (6자리, 대문자/숫자)</span>
            <input
              type="text"
              value={code}
              onChange={e=>setCode(e.target.value.toUpperCase())}
              required
              maxLength={6}
              placeholder="8IAZL3"
              style={{padding:'10px 12px', border:'1px solid #ccc', borderRadius:8, textTransform:'uppercase', letterSpacing:2}}
            />
          </label>
          <button type="submit" style={{padding:'10px 14px', borderRadius:8, border:'none', background:'#3b82f6', color:'#fff', fontWeight:700}}>
            인증하기
          </button>

          {(phase === 'error') && (
            <div style={{padding: '10px 12px', background:'#fff5f5', border:'1px solid #f5c2c2', borderRadius:8, color:'#a40000'}}>
              {message}
            </div>
          )}
        </form>
      )}

      {phase === 'success' && (
        <div style={{padding: '12px 16px', background:'#ecfff1', border:'1px solid #9ae6b4', borderRadius: 8}}>
          {message}
        </div>
      )}
    </main>
  );
}
