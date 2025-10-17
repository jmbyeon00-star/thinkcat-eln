import { useState, useMemo } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import styles from './Signup.module.css';

function validateEmail(v: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}
function pwScore(v: string) {
    // 아주 간단한 점수: 길이/숫자/문자/특수문자
    let s = 0;
    if (v.length >= 8) s++;
    if (/[0-9]/.test(v)) s++;
    if (/[a-zA-Z]/.test(v)) s++;
    if (/[^0-9a-zA-Z]/.test(v)) s++;
    return s; // 0~4
}

export default function SignupPage() {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [pw, setPw] = useState('');
    const [pw2, setPw2] = useState('');
    const [agree, setAgree] = useState(false);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const emailOk = useMemo(()=> validateEmail(email), [email]);
    const score = useMemo(()=> pwScore(pw), [pw]);
    const pwOk = useMemo(()=> pw.length >= 8 && pw === pw2, [pw, pw2]);
    const canSubmit = name && emailOk && pwOk && agree && !loading;

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setErr(null);

        if (!canSubmit) {
        setErr('입력값을 다시 확인해줘.');
        return;
        }
        setLoading(true);
        try {
            const res = await fetch('http://127.0.0.1:8000/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type':'application/json' },
                body: JSON.stringify({ name, email, password: pw, agree }),
            });
            const data = await res.json().catch(()=> ({}));
            if (!res.ok) throw new Error(data?.detail || '회원가입 실패');
            
            // 토큰 쿠키가 설정되었으므로 홈으로 이동
            window.location.href = '/';
        } catch (e: any) {
            setErr(e.message || '네트워크 오류');
        } finally {
            setLoading(false);
        }
    }   

    return (
        <>
            <Head><title>회원가입 | IPFORCE</title></Head>
            <main className={styles.wrap}>
                <section className={styles.card}>
                {/* <div className={styles.brand}><img src="/logo.svg" alt="IPFORCE" /></div> */}
                <h1 className={styles.title}>회원가입</h1>
                <p className={styles.subtitle}>IPFORCE 계정을 만들어 서비스를 이용하세요.</p>

                {err && <div className={styles.alert}>{err}</div>}

                <form onSubmit={onSubmit} className={styles.form}>
                    <label className={styles.label}>
                        이름
                        <input
                            type="text"
                            className={styles.input}
                            placeholder="홍길동"
                            value={name}
                            onChange={(e)=>setName(e.target.value)}
                        />
                    </label>

                    <label className={styles.label}>
                    이메일
                    <input
                        type="email"
                        className={styles.input}
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e)=>setEmail(e.target.value)}
                    />
                    {!emailOk && email.length > 0 && (
                        <small style={{color:'#c62828'}}>올바른 이메일 형식이 아닙니다.</small>
                    )}
                    </label>

                    <label className={styles.label}>
                    비밀번호
                    <input
                        type="password"
                        className={styles.input}
                        placeholder="8자 이상 / 숫자·문자·특수문자"
                        value={pw}
                        onChange={(e)=>setPw(e.target.value)}
                    />
                    {pw.length > 0 && (
                        <div style={{fontSize:'.85rem', color:'#6b7280'}}>
                        강도: {['약함','보통','좋음','좋음','매우 좋음'][score]}
                        </div>
                    )}
                    </label>

                    <label className={styles.label}>
                    비밀번호 확인
                    <input
                        type="password"
                        className={styles.input}
                        placeholder="다시 입력"
                        value={pw2}
                        onChange={(e)=>setPw2(e.target.value)}
                    />
                    {pw2.length > 0 && pw !== pw2 && (
                        <small style={{color:'#c62828'}}>비밀번호가 일치하지 않습니다.</small>
                    )}
                    </label>

                    <div className={styles.row}>
                    <label className={styles.checkbox}>
                        <input type="checkbox" checked={agree} onChange={(e)=>setAgree(e.target.checked)} />
                        (필수) 이용약관 및 개인정보 처리방침에 동의합니다.
                    </label>
                    </div>

                    <button className={styles.submit} disabled={!canSubmit}>
                    {loading ? '처리 중…' : '가입하기'}
                    </button>
                </form>

                <div className={styles.footer}>
                    이미 계정이 있으신가요? <Link href="/auth/Login" className={styles.link}>로그인</Link>
                </div>
                </section>
            </main>
        </>
    );
}
