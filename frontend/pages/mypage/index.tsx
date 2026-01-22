import React from "react"; // React 명시적 임포트 (버전에 따라 필요할 수 있음)
import Head from "next/head";
import { useRouter } from "next/router";
import { User, Mail, Shield, Zap, Settings, ArrowLeft, LogOut, Key, ArrowRight } from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import { withMessages } from '@/lib/i18n/withMessages';

export const getServerSideProps = withMessages();

export default function MyPage() {
    const router = useRouter();
    const { data: session } = useSession();
    const user = session?.user;

    const handleLogout = async () => {
        await signOut({ redirect: false });
        router.push("/");
    };

    return (
        <React.Fragment>
            <Head>
                <title>마이페이지 | IPFORCE</title>
            </Head>

            <main className="h-screen bg-white selection:bg-blue-100 overflow-hidden">
                <div className="max-w-7xl mx-auto px-8 h-full flex flex-col justify-center py-6">

                    {/* Header */}
                    <div className="mb-10 animate-in fade-in slide-in-from-top-4 duration-700">
                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="flex items-center gap-2 text-zinc-400 hover:text-zinc-900 font-bold transition-colors mb-6 group text-sm"
                        >
                            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> 이전으로
                        </button>
                        <h1 className="text-4xl md:text-5xl font-black text-zinc-900 tracking-tighter">
                            계정 설정<span className="text-blue-600">.</span>
                        </h1>
                    </div>

                    <div className="grid lg:grid-cols-3 gap-8 items-start">

                        {/* Profile Card */}
                        <div className="lg:col-span-1 animate-in fade-in slide-in-from-left-4 duration-1000">
                            <div className="bg-zinc-900 rounded-[2.5rem] p-10 text-white shadow-2xl relative overflow-hidden group">
                                <Zap size={120} className="absolute -right-8 -bottom-8 text-white/5 group-hover:scale-110 transition-transform duration-700" />

                                <div className="relative z-10 flex flex-col items-center text-center">
                                    <div className="relative mb-6">
                                        <img
                                            src={user?.image || "/default-profile.png"}
                                            alt="Profile"
                                            className="w-24 h-24 rounded-full border-4 border-white/10 object-cover shadow-2xl"
                                        />
                                        <div className="absolute bottom-0 right-0 w-7 h-7 bg-blue-600 rounded-full border-4 border-zinc-900 flex items-center justify-center">
                                            <Shield size={10} className="text-white" />
                                        </div>
                                    </div>
                                    <h2 className="text-2xl font-black mb-1">{user?.name || "사용자"}</h2>
                                    <p className="text-zinc-500 text-sm font-bold mb-8">{user?.email}</p>

                                    <button
                                        type="button"
                                        onClick={handleLogout}
                                        className="w-full py-4 bg-white/5 hover:bg-red-500/10 text-zinc-400 hover:text-red-500 rounded-2xl text-xs font-black uppercase tracking-[0.2em] transition-all border border-white/5 hover:border-red-500/20 flex items-center justify-center gap-2"
                                    >
                                        <LogOut size={14} /> Sign Out
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Settings Info */}
                        <div className="lg:col-span-2 space-y-6 animate-in fade-in slide-in-from-right-4 duration-1000 delay-200">
                            <div className="bg-white rounded-[2.5rem] border border-zinc-100 p-10 shadow-sm hover:shadow-xl transition-all duration-500 flex flex-col h-full">
                                <div className="space-y-8">
                                    <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                                        <Settings size={14} className="text-blue-600" /> Account Security
                                    </h3>

                                    <div className="grid md:grid-cols-2 gap-4">
                                        <InfoField icon={<Mail size={18} />} label="이메일 주소" value={user?.email || "정보 없음"} />
                                        <InfoField icon={<Shield size={18} />} label="권한 등급" value="Enterprise Member" />
                                        <InfoField icon={<Key size={18} />} label="비밀번호" value="••••••••••••" isAction />
                                        <InfoField icon={<User size={18} />} label="마지막 접속" value={new Date().toLocaleDateString()} />
                                    </div>

                                    <div className="pt-8 border-t border-zinc-50">
                                        <div className="bg-blue-50/50 rounded-[2rem] p-8 flex items-center justify-between group cursor-pointer hover:bg-blue-50 transition-colors">
                                            <div className="flex items-center gap-6">
                                                <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-100">
                                                    <Zap size={24} />
                                                </div>
                                                <div className="text-left">
                                                    <h4 className="font-black text-zinc-900 tracking-tight">구독 플랜: Professional</h4>
                                                    <p className="text-zinc-500 text-sm font-medium">GPU 자원 우선 할당 및 무제한 프로젝트</p>
                                                </div>
                                            </div>
                                            <ArrowRight size={20} className="text-zinc-300 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </main>
        </React.Fragment>
    );
}

function InfoField({ icon, label, value, isAction = false }: { icon: React.ReactNode, label: string, value: string, isAction?: boolean }) {
    return (
        <div className="p-6 rounded-[2rem] bg-zinc-50/50 border border-zinc-100 group hover:bg-white hover:border-blue-100 hover:shadow-md transition-all">
            <div className="flex items-center gap-3 mb-3 text-zinc-400 group-hover:text-blue-600 transition-colors text-left">
                {icon}
                <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
            </div>
            <div className="flex items-center justify-between">
                <span className="font-bold text-zinc-900 truncate pr-4">{value}</span>
                {isAction && (
                    <button type="button" className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-md hover:bg-blue-600 hover:text-white transition-all">변경</button>
                )}
            </div>
        </div>
    );
}