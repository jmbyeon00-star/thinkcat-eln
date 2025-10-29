import { useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { Database, FileText, Target, ArrowRight, Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { Session } from "next-auth";

export default function ProjectSearchIndex() {
    const router = useRouter();
    const [name, setName] = useState("");
    const [desc, setDesc] = useState("");
    const [taskType, setTaskType] = useState("classification");
    const [creating, setCreating] = useState(false);

    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "https://ipforce.co.kr";

    const { data: session, status } = useSession() as {
        data: (Session & { access_token?: string }) | null;
        status: "loading" | "authenticated" | "unauthenticated";
    };
    const token = session?.access_token;

    async function createProject() {
        if (!name.trim()) {
            alert("프로젝트 이름을 입력하세요.");
            return;
        }
        setCreating(true);
        try {
            const res = await fetch(`${API_BASE}/api/project`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                credentials: "include",
                body: JSON.stringify({
                    project_name: name,
                    project_description: desc,
                    source_type: "search",
                    task_type: taskType,
                }),
            });
            if (!res.ok) throw new Error("프로젝트 생성 실패");
            const data = await res.json();
            router.push(`/project/search/${data.id}`);
        } catch (e: any) {
            alert("프로젝트 생성 실패: " + e.message);
        } finally {
            setCreating(false);
        }
    }

    const taskOptions = [
        { value: "classification", label: "특허 분류", desc: "하나의 카테고리로 분류" },
        // { value: "classification", label: "단일 분류", desc: "하나의 카테고리로 분류" },
        // { value: "multilabel", label: "멀티라벨 분류", desc: "여러 카테고리로 분류" },
        // { value: "regression", label: "회귀", desc: "연속적인 값 예측" },
    ];

    return (
        <>
            <Head>
                <title>DB 검색 프로젝트 생성 | IPFORCE</title>
            </Head>

            <div className="min-h-screen bg-white">
                <div className="max-w-4xl mx-auto p-8">
                    {/* Header */}
                    <div className="mb-8">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-1 h-8 bg-gradient-to-b from-blue-600 to-indigo-600 rounded-full" />
                            <h1 className="text-3xl font-bold text-zinc-900">
                                DB 검색 프로젝트 생성
                            </h1>
                        </div>
                        <p className="text-zinc-600 ml-4">
                            데이터베이스에서 검색하여 새로운 프로젝트를 만듭니다
                        </p>
                    </div>

                    {/* Main Card */}
                    <div className="bg-white rounded-2xl shadow-xl border border-zinc-100 overflow-hidden">
                        {/* Card Header */}
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6">
                            <div className="flex items-center gap-3">
                                <Database className="w-6 h-6 text-white" />
                                <h2 className="text-xl font-semibold text-white">
                                    프로젝트 기본 정보
                                </h2>
                            </div>
                            <p className="text-blue-100 text-sm mt-2">
                                프로젝트의 이름, 설명, 작업 유형을 설정하세요
                            </p>
                        </div>

                        {/* Form Content */}
                        <div className="p-8 space-y-6">
                            {/* Project Name */}
                            <div>
                                <label className="block text-sm font-semibold text-zinc-700 mb-3 flex items-center gap-2">
                                    <div className="w-1 h-4 bg-gradient-to-b from-blue-600 to-indigo-600 rounded-full" />
                                    <FileText size={16} className="text-zinc-600" />
                                    프로젝트 이름
                                </label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="예) 반도체 공정 분류기"
                                    disabled={creating}
                                    className="w-full px-4 py-3 bg-white border-2 border-zinc-200 rounded-xl 
                                        focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100
                                        text-zinc-900 placeholder-zinc-400
                                        transition-all duration-200
                                        disabled:bg-zinc-50 disabled:cursor-not-allowed
                                        shadow-sm hover:shadow-md"
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-semibold text-zinc-700 mb-3 flex items-center gap-2">
                                    <div className="w-1 h-4 bg-gradient-to-b from-blue-600 to-indigo-600 rounded-full" />
                                    <FileText size={16} className="text-zinc-600" />
                                    프로젝트 설명
                                </label>
                                <textarea
                                    value={desc}
                                    onChange={(e) => setDesc(e.target.value)}
                                    placeholder="프로젝트에 대한 간단한 설명을 입력하세요..."
                                    disabled={creating}
                                    rows={4}
                                    className="w-full px-4 py-3 bg-white border-2 border-zinc-200 rounded-xl 
                                        focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100
                                        text-zinc-900 placeholder-zinc-400
                                        transition-all duration-200
                                        disabled:bg-zinc-50 disabled:cursor-not-allowed
                                        shadow-sm hover:shadow-md resize-none"
                                />
                            </div>

                            {/* Task Type */}
                            <div>
                                <label className="block text-sm font-semibold text-zinc-700 mb-3 flex items-center gap-2">
                                    <div className="w-1 h-4 bg-gradient-to-b from-blue-600 to-indigo-600 rounded-full" />
                                    <Target size={16} className="text-zinc-600" />
                                    작업 유형 선택
                                </label>
                                <div className="grid gap-3">
                                    {taskOptions.map((option) => (
                                        <label
                                            key={option.value}
                                            className={`
                                                flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer
                                                transition-all duration-200
                                                ${taskType === option.value
                                                    ? 'border-blue-500 bg-blue-50 shadow-md'
                                                    : 'border-zinc-200 bg-white hover:border-blue-300 hover:shadow-sm'
                                                }
                                                ${creating ? 'cursor-not-allowed opacity-50' : ''}
                                            `}
                                        >
                                            <input
                                                type="radio"
                                                name="taskType"
                                                value={option.value}
                                                checked={taskType === option.value}
                                                onChange={(e) => setTaskType(e.target.value)}
                                                disabled={creating}
                                                className="mt-1 w-4 h-4 text-blue-600 focus:ring-blue-500"
                                            />
                                            <div className="flex-1">
                                                <div className="font-semibold text-zinc-900">
                                                    {option.label}
                                                </div>
                                                <div className="text-sm text-zinc-600 mt-1">
                                                    {option.desc}
                                                </div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Info Box */}
                            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-4">
                                <div className="flex items-start gap-3">
                                    <div className="bg-blue-500 text-white rounded-full p-1.5 mt-0.5">
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-semibold text-blue-900 mb-1">
                                            프로젝트 생성 안내
                                        </p>
                                        <p className="text-xs text-blue-800 leading-relaxed">
                                            프로젝트를 생성한 후 데이터베이스에서 원하는 데이터를 검색하여 추가할 수 있습니다.
                                            작업 유형은 나중에 변경할 수 없으니 신중하게 선택해주세요.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center justify-between pt-4">
                                <button
                                    onClick={() => router.back()}
                                    disabled={creating}
                                    className="px-6 py-3 text-sm font-medium text-zinc-700 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    이전으로
                                </button>
                                <button
                                    onClick={createProject}
                                    disabled={creating || !name.trim()}
                                    className="px-8 py-3 text-base font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 
                                        hover:from-blue-700 hover:to-indigo-700
                                        disabled:from-zinc-300 disabled:to-zinc-400 disabled:cursor-not-allowed
                                        rounded-xl shadow-lg hover:shadow-xl
                                        transition-all duration-200
                                        flex items-center gap-2"
                                >
                                    {creating ? (
                                        <>
                                            <Loader2 size={20} className="animate-spin" />
                                            <span>생성 중...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>프로젝트 생성</span>
                                            <ArrowRight size={20} />
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}