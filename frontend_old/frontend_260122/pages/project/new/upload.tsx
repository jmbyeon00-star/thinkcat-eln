import dynamic from "next/dynamic";
import { useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { UploadCloud, FileText, Target, ArrowRight, Loader2, Sparkles, Info, ArrowLeft, Zap } from "lucide-react";
import { useSession } from "next-auth/react";
import { Session } from "next-auth";
import { withMessages } from '@/lib/i18n/withMessages';

export const getServerSideProps = withMessages();

function ProjectUploadIndex() {
    const router = useRouter();
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

    const { data: session } = useSession() as {
        data: (Session & { access_token?: string }) | null;
        status: "loading" | "authenticated" | "unauthenticated";
    };
    const token = session?.access_token;

    const [name, setName] = useState("");
    const [desc, setDesc] = useState("");
    const [taskType, setTaskType] = useState("classification");
    const [creating, setCreating] = useState(false);

    async function createProject() {
        if (!name.trim()) return alert("프로젝트 이름을 입력하세요.");
        setCreating(true);
        try {
            const res = await fetch(`${API_BASE}/api/project`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                credentials: "include",
                body: JSON.stringify({
                    project_name: name,
                    project_description: desc,
                    source_type: "upload",
                    task_type: taskType,
                }),
            });
            if (!res.ok) throw new Error("프로젝트 생성 실패");
            const data = await res.json();
            router.push(`/project/${data.id}`);
        } catch (e: any) {
            alert("프로젝트 생성 실패: " + e.message);
        } finally {
            setCreating(false);
        }
    }

    const taskOptions = [
        { value: "classification", label: "지능형 특허 분류", desc: "BERT 모델이 업로드된 텍스트의 문맥을 파악하여 최적의 카테고리로 매칭합니다." },
    ];

    return (
        <>
            <Head>
                <title>파일 업로드 프로젝트 생성 | IPFORCE</title>
            </Head>

            {/* 🚀 h-screen과 overflow-hidden으로 스크롤 방지 */}
            <div className="h-screen bg-white selection:bg-emerald-100 overflow-hidden">
                <div className="max-w-7xl mx-auto px-8 h-full flex flex-col justify-center py-8">

                    {/* Header: 높이 압축 */}
                    <div className="mb-8 animate-in fade-in slide-in-from-top-4 duration-700">
                        <button
                            onClick={() => router.back()}
                            className="flex items-center gap-2 text-zinc-400 hover:text-zinc-900 font-bold transition-colors mb-4 group text-sm"
                        >
                            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> 이전 단계로
                        </button>

                        <div className="flex items-center gap-3 mb-2">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 text-white shadow-lg">
                                <UploadCloud size={12} className="text-emerald-400" />
                                <span className="text-[9px] font-black uppercase tracking-[0.2em]">File Upload Mode</span>
                            </div>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black text-zinc-900 tracking-tighter">
                            파일 업로드 프로젝트 생성<span className="text-emerald-600">.</span>
                        </h1>
                    </div>

                    {/* 3:1 레이아웃 구조: gap과 높이 최적화 */}
                    <div className="grid lg:grid-cols-4 gap-8 items-stretch">

                        {/* Left: Input Form (75%) */}
                        <div className="lg:col-span-3 animate-in fade-in slide-in-from-bottom-6 duration-1000">
                            <div className="bg-white rounded-[2.5rem] border border-zinc-100 p-8 md:p-10 shadow-sm hover:shadow-xl transition-all duration-500">

                                <div className="space-y-10">
                                    {/* Project Name Field */}
                                    <div className="space-y-4">
                                        <label className="flex items-center gap-2 text-[15px] font-black text-zinc-400 uppercase tracking-[0.2em]">
                                            <FileText size={12} className="text-emerald-600" /> 프로젝트 명칭
                                        </label>
                                        <input
                                            type="text"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            placeholder="예) 2025 상반기 특허 분석 프로젝트"
                                            className="w-full text-2xl font-black text-zinc-900 placeholder:text-zinc-100 bg-transparent border-b-2 border-zinc-50 focus:border-emerald-600 outline-none pb-3 transition-all"
                                            disabled={creating}
                                        />
                                    </div>

                                    {/* Description Field */}
                                    <div className="space-y-4">
                                        <label className="flex items-center gap-2 text-[15px] font-black text-zinc-400 uppercase tracking-[0.2em]">
                                            <Target size={12} className="text-emerald-600" /> 분석 목표 및 설명
                                        </label>
                                        <textarea
                                            value={desc}
                                            onChange={(e) => setDesc(e.target.value)}
                                            placeholder="분석을 통해 얻고자 하는 기술적 인사이트를 요약하세요..."
                                            rows={2}
                                            className="w-full text-lg font-medium text-zinc-600 placeholder:text-zinc-100 bg-zinc-50/50 rounded-[1.5rem] p-6 border-none outline-none focus:ring-4 focus:ring-emerald-50 transition-all resize-none"
                                            disabled={creating}
                                        />
                                    </div>

                                    {/* Task Engine Selection */}
                                    <div className="space-y-4">
                                        <label className="flex items-center gap-2 text-[15px] font-black text-zinc-400 uppercase tracking-[0.2em]">
                                            <Sparkles size={12} className="text-emerald-600" /> 인공지능 모델
                                        </label>
                                        <div className="p-6 rounded-[2rem] bg-emerald-600 text-white shadow-xl shadow-emerald-100 flex items-center justify-between group relative overflow-hidden transition-transform hover:scale-[1.01]">
                                            <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform">
                                                <Target size={140} />
                                            </div>
                                            <div className="flex items-center gap-6 relative z-10">
                                                <div className="w-6 h-6 rounded-full border-4 border-white/30 flex items-center justify-center">
                                                    <div className="w-2 h-2 bg-white rounded-full shadow-sm" />
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-black tracking-tight text-white">특허 분류 모델</h3>
                                                    <p className="text-emerald-100 text-xs font-medium max-w-sm">
                                                        업로드된 텍스트의 문맥을 심층 분석하여 기술 카테고리로 매칭합니다.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Create Button: 상단 여백 조절 */}
                                <div className="mt-12 flex flex-col md:flex-row items-center justify-between pt-6 border-t border-zinc-50 gap-4">
                                    <p className="text-[11px] text-zinc-400 font-bold flex items-center gap-2">
                                        <Info size={14} /> 프로젝트 생성 후 다음 단계에서 파일을 업로드합니다.
                                    </p>
                                    <button
                                        onClick={createProject}
                                        disabled={creating || !name.trim()}
                                        className="w-full md:w-auto bg-zinc-900 text-white px-12 py-4 rounded-[1.5rem] font-black shadow-lg hover:bg-black disabled:bg-zinc-100 disabled:text-zinc-300 disabled:shadow-none transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-3 group"
                                    >
                                        {creating ? (
                                            <>
                                                <Loader2 size={20} className="animate-spin text-zinc-400" />
                                                <span className="text-sm">구축 중...</span>
                                            </>
                                        ) : (
                                            <>
                                                <span className="text-sm">워크스페이스 생성</span>
                                                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Right: Sidebar Guide (25%) */}
                        <div className="lg:col-span-1 space-y-4 animate-in fade-in slide-in-from-right-4 duration-1000 delay-300">
                            <div className="bg-zinc-900 rounded-[2rem] p-8 text-white shadow-xl relative overflow-hidden">
                                <Zap size={60} className="absolute -right-4 -bottom-4 text-white/5" />
                                <h3 className="font-black text-lg mb-4 tracking-tight relative z-10">Integration</h3>
                                <ul className="space-y-4 relative z-10">
                                    {[
                                        { t: "Bulk Import", d: "대량 특허 데이터 업로드" },
                                        { t: "Preprocessing", d: "텍스트 정제 및 벡터화" },
                                        { t: "Cloud Storage", d: "GPU 전용 스토리지 배정" }
                                    ].map((item, i) => (
                                        <li key={i} className="space-y-0.5">
                                            <div className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">{item.t}</div>
                                            <div className="text-xs font-medium text-zinc-400 leading-snug">{item.d}</div>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div className="p-8 rounded-[2rem] bg-zinc-50 border border-zinc-100 group">
                                <h4 className="text-zinc-900 font-black mb-2 flex items-center gap-2 tracking-tight text-sm">
                                    <Info size={14} className="text-emerald-600" /> 포맷 가이드
                                </h4>
                                <p className="text-zinc-500 text-[11px] font-bold leading-relaxed">
                                    첫 번째 행(Header)에는 'title', 'abstract', 'label' 컬럼이 반드시 포함되어야 합니다.
                                </p>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </>
    );
}

export default dynamic(() => Promise.resolve(ProjectUploadIndex), { ssr: false });