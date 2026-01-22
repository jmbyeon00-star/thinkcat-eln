import dynamic from "next/dynamic";
import { useState } from "react";
import { useRouter } from "next/router";
import { UploadCloud, FileText, Target, ArrowRight, Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { Session } from "next-auth";

import { withMessages } from '@/lib/i18n/withMessages';
export const getServerSideProps = withMessages();

function ProjectUploadIndex() {
    const router = useRouter();
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

    const { data: session, status } = useSession() as {
        data: (Session & { access_token?: string }) | null;
        status: "loading" | "authenticated" | "unauthenticated";
    };
    const token = session?.access_token;

    const [name, setName] = useState("");
    const [desc, setDesc] = useState("");
    const [taskType, setTaskType] = useState("classification");
    const [creating, setCreating] = useState(false);


    async function createProject() {
        if (!name.trim()) {
            alert("프로젝트 이름을 입력하세요.");
            return;
        }
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
        { value: "classification", label: "특허 분류", desc: "하나의 카테고리로 분류" },
        // { value: "classification", label: "단일 분류", desc: "하나의 카테고리로 분류" },
        // { value: "multilabel", label: "멀티라벨 분류", desc: "여러 카테고리로 분류" },
        // { value: "regression", label: "회귀", desc: "연속적인 값 예측" },
    ];

    return (
        <div className="min-h-screen bg-white">
            <div className="max-w-4xl mx-auto p-8">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-1 h-8 bg-gradient-to-b from-emerald-600 to-teal-600 rounded-full" />
                        <h1 className="text-3xl font-bold text-zinc-900">
                            파일 업로드 프로젝트 생성
                        </h1>
                    </div>
                    <p className="text-zinc-600 ml-4">
                        엑셀 또는 CSV 파일을 업로드하여 새로운 프로젝트를 만듭니다
                    </p>
                </div>

                {/* Main Card */}
                <div className="bg-white rounded-2xl shadow-xl border border-zinc-100 overflow-hidden">
                    <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-8 py-6">
                        <div className="flex items-center gap-3">
                            <UploadCloud className="w-6 h-6 text-white" />
                            <h2 className="text-xl font-semibold text-white">프로젝트 기본 정보</h2>
                        </div>
                        <p className="text-emerald-100 text-sm mt-2">
                            프로젝트의 이름, 설명, 작업 유형을 설정하세요
                        </p>
                    </div>

                    <div className="p-8 space-y-6">
                        {/* Project Name */}
                        <div>
                            <label className="block text-sm font-semibold text-zinc-700 mb-3 flex items-center gap-2">
                                <div className="w-1 h-4 bg-gradient-to-b from-emerald-600 to-teal-600 rounded-full" />
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
                                    focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100
                                    text-zinc-900 placeholder-zinc-400
                                    transition-all duration-200
                                    disabled:bg-zinc-50 disabled:cursor-not-allowed
                                    shadow-sm hover:shadow-md"
                            />
                        </div>

                        {/* Description */}
                        <div>
                            <label className="block text-sm font-semibold text-zinc-700 mb-3 flex items-center gap-2">
                                <div className="w-1 h-4 bg-gradient-to-b from-emerald-600 to-teal-600 rounded-full" />
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
                                    focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100
                                    text-zinc-900 placeholder-zinc-400
                                    transition-all duration-200
                                    disabled:bg-zinc-50 disabled:cursor-not-allowed
                                    shadow-sm hover:shadow-md resize-none"
                            />
                        </div>

                        {/* Task Type */}
                        <div>
                            <label className="block text-sm font-semibold text-zinc-700 mb-3 flex items-center gap-2">
                                <div className="w-1 h-4 bg-gradient-to-b from-emerald-600 to-teal-600 rounded-full" />
                                <Target size={16} className="text-zinc-600" />
                                작업 유형 선택
                            </label>
                            <div className="grid gap-3">
                                {taskOptions.map((option) => (
                                    <label
                                        key={option.value}
                                        className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer
                                            transition-all duration-200
                                            ${taskType === option.value
                                                ? "border-emerald-500 bg-emerald-50 shadow-md"
                                                : "border-zinc-200 bg-white hover:border-emerald-300 hover:shadow-sm"}
                                            ${creating ? "cursor-not-allowed opacity-50" : ""}`}
                                    >
                                        <input
                                            type="radio"
                                            name="taskType"
                                            value={option.value}
                                            checked={taskType === option.value}
                                            onChange={(e) => setTaskType(e.target.value)}
                                            disabled={creating}
                                            className="mt-1 w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                                        />
                                        <div className="flex-1">
                                            <div className="font-semibold text-zinc-900">{option.label}</div>
                                            <div className="text-sm text-zinc-600 mt-1">{option.desc}</div>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Buttons */}
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
                                className="px-8 py-3 text-base font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 
                                    hover:from-emerald-700 hover:to-teal-700
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
    );
}

// ⚡ SSR 완전 비활성화 (중복 렌더링 방지)
export default dynamic(() => Promise.resolve(ProjectUploadIndex), { ssr: false });
