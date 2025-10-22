import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import ProjectLayout from "@/components/layouts/ProjectLayout";
import { Settings, Play, ArrowLeft, Loader2, Info, Zap } from "lucide-react";
import { useSession } from "next-auth/react";
import { Session } from "next-auth";

import { useUserTaskStore } from '@/lib/store/useUserTaskStore';

type ProjectInfo = {
    collection_num: number;
    task_type: string;
    source_type: string;
};

export default function ProjectTrainPage() {
    const router = useRouter();
    const { setState } = useUserTaskStore()

    const [status, setStatus] = useState(false);
    const { project_id, collection_num, task_type, source_type } = router.query;
    const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null);
    const [loading, setLoading] = useState(false);
    const API_BASE = "http://192.168.1.20:8000";

    const [modelName, setModelName] = useState('');
    const [modelDesc, setModelDesc] = useState('');
    const [epoch, setEpoch] = useState(10);
    const [batchSize, setBatchSize] = useState(32);
    const [learningRate, setLearningRate] = useState(1e-5);
    const [maxLength, setMaxLength] = useState(128);
    const [shuffle, setShuffle] = useState(true);

    const { data: session } = useSession() as {
        data: (Session & { access_token?: string }) | null;
        status: "loading" | "authenticated" | "unauthenticated";
    };
    const token = session?.access_token;

    useEffect(() => {
        if (!project_id) return;
        if (collection_num) {
            setProjectInfo({
                collection_num: Number(collection_num),
                task_type: String(task_type),
                source_type: String(source_type),
            });
            return;
        }
        setLoading(true);
        fetch(`${API_BASE}/api/project/${project_id}/stats`)
            .then((res) => res.json())
            .then((data) => {
                const collectionNumber = data?.project_info?.collection_num ?? 0;
                const taskType = data?.project_info?.task_type ?? 0;
                const sourceType = data?.project_info?.source_type ?? 0;
                setProjectInfo({ collection_num: collectionNumber, source_type: sourceType, task_type: taskType });
            })
            .catch((err) => console.error("통계 불러오기 실패:", err))
            .finally(() => setLoading(false));
    }, [project_id, collection_num]);

    const handleSubmit = () => {
        if (!project_id || !modelName.trim()) {
            alert("모델명을 입력해주세요.");
            return;
        }

        setState({ isBusy: true, status: 'RUNNING', progress: 0 })
        setLoading(true);

        fetch(`${API_BASE}/api/ai/train/classification/project/${project_id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            credentials: "include",
            body: JSON.stringify({
                epoch,
                model_name: modelName,
                model_desc: modelDesc,
                batch_size: batchSize,
                learning_rate: learningRate,
                max_length: maxLength,
                shuffle: shuffle,
                data_scope: 'project',
                collection_num: projectInfo?.collection_num,
                task_type: projectInfo?.task_type,
                source_type: projectInfo?.source_type,
            }),
        })
            .then((res) => res.json())
            .then(() => {
                setLoading(false);
                setStatus(true);
                alert("학습이 시작되었습니다!");
                router.push(`/ai`);
            })
            .catch((err) => {
                console.error("학습 요청 실패:", err);
                setState({ isBusy: false, status: 'IDLE' })
                setLoading(false);
                alert("학습 시작 실패");
            });
    };

    return (
        <ProjectLayout step={5}>
            <div className="min-h-screen bg-white p-8">
                <div className="max-w-4xl mx-auto space-y-6">
                    {/* Header */}
                    <div className="mb-8">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-1 h-8 bg-gradient-to-b from-blue-600 to-indigo-600 rounded-full" />
                            <h1 className="text-3xl font-bold text-zinc-900">학습 설정</h1>
                        </div>
                        <p className="text-zinc-600 ml-4">
                            모델 학습을 위한 하이퍼파라미터를 설정하세요
                        </p>
                    </div>

                    {/* Main Card */}
                    <div className="bg-white rounded-2xl shadow-xl border border-zinc-100 overflow-hidden">
                        {/* Card Header */}
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6">
                            <div className="flex items-center gap-3">
                                <Settings className="w-6 h-6 text-white" />
                                <h2 className="text-xl font-semibold text-white">학습 파라미터</h2>
                            </div>
                            <p className="text-blue-100 text-sm mt-2">
                                프로젝트 #{project_id}
                            </p>
                        </div>

                        {/* Form Content */}
                        <div className="p-8 space-y-6">
                            {/* Info Box */}
                            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-4">
                                <div className="flex items-start gap-3">
                                    <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <p className="text-sm font-semibold text-blue-900 mb-1">학습 안내</p>
                                        <p className="text-xs text-blue-800 leading-relaxed">
                                            학습 시작 후 모델 관리 페이지에서 진행 상황을 확인할 수 있습니다.
                                            적절한 하이퍼파라미터 설정은 모델 성능에 큰 영향을 미칩니다.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Model Info Section */}
                            <div className="space-y-4">
                                <h3 className="text-lg font-semibold text-zinc-900 flex items-center gap-2">
                                    <div className="w-1 h-5 bg-gradient-to-b from-blue-600 to-indigo-600 rounded-full" />
                                    모델 정보
                                </h3>

                                <div className="grid gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-zinc-700 mb-2">
                                            모델명 *
                                        </label>
                                        <input
                                            type="text"
                                            value={modelName}
                                            onChange={(e) => setModelName(e.target.value)}
                                            placeholder="예) 특허분류모델_v1"
                                            className="w-full px-4 py-3 border-2 border-zinc-200 rounded-xl 
                                                focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100
                                                transition-all shadow-sm hover:shadow-md"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-zinc-700 mb-2">
                                            모델 설명
                                        </label>
                                        <textarea
                                            value={modelDesc}
                                            onChange={(e) => setModelDesc(e.target.value)}
                                            placeholder="모델에 대한 간단한 설명을 입력하세요"
                                            rows={3}
                                            className="w-full px-4 py-3 border-2 border-zinc-200 rounded-xl 
                                                focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100
                                                transition-all shadow-sm hover:shadow-md resize-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Hyperparameters Section */}
                            <div className="space-y-4">
                                <h3 className="text-lg font-semibold text-zinc-900 flex items-center gap-2">
                                    <div className="w-1 h-5 bg-gradient-to-b from-blue-600 to-indigo-600 rounded-full" />
                                    하이퍼파라미터
                                </h3>

                                <div className="grid md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-zinc-700 mb-2">
                                            Epoch
                                        </label>
                                        <input
                                            type="number"
                                            value={epoch}
                                            onChange={(e) => setEpoch(Number(e.target.value))}
                                            className="w-full px-4 py-3 border-2 border-zinc-200 rounded-xl 
                                                focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100
                                                transition-all shadow-sm hover:shadow-md"
                                        />
                                        <p className="text-xs text-zinc-500 mt-1">학습 반복 횟수</p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-zinc-700 mb-2">
                                            Batch Size
                                        </label>
                                        <input
                                            type="number"
                                            value={batchSize}
                                            onChange={(e) => setBatchSize(Number(e.target.value))}
                                            className="w-full px-4 py-3 border-2 border-zinc-200 rounded-xl 
                                                focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100
                                                transition-all shadow-sm hover:shadow-md"
                                        />
                                        <p className="text-xs text-zinc-500 mt-1">배치 크기</p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-zinc-700 mb-2">
                                            Learning Rate
                                        </label>
                                        <input
                                            type="number"
                                            step="0.00001"
                                            value={learningRate}
                                            onChange={(e) => setLearningRate(Number(e.target.value))}
                                            className="w-full px-4 py-3 border-2 border-zinc-200 rounded-xl 
                                                focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100
                                                transition-all shadow-sm hover:shadow-md"
                                        />
                                        <p className="text-xs text-zinc-500 mt-1">학습률</p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-zinc-700 mb-2">
                                            Max Length
                                        </label>
                                        <input
                                            type="number"
                                            value={maxLength}
                                            onChange={(e) => setMaxLength(Number(e.target.value))}
                                            className="w-full px-4 py-3 border-2 border-zinc-200 rounded-xl 
                                                focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100
                                                transition-all shadow-sm hover:shadow-md"
                                        />
                                        <p className="text-xs text-zinc-500 mt-1">최대 토큰 길이</p>
                                    </div>
                                </div>
                            </div>

                            {/* Data Options Section */}
                            <div className="space-y-4">
                                <h3 className="text-lg font-semibold text-zinc-900 flex items-center gap-2">
                                    <div className="w-1 h-5 bg-gradient-to-b from-blue-600 to-indigo-600 rounded-full" />
                                    데이터 옵션
                                </h3>

                                <div>
                                    <label className="block text-sm font-semibold text-zinc-700 mb-3">
                                        데이터 섞기 (Shuffle)
                                    </label>
                                    <div className="flex gap-4">
                                        <label className="flex items-center gap-3 px-6 py-3 border-2 rounded-xl cursor-pointer transition-all hover:bg-blue-50"
                                            style={{
                                                borderColor: shuffle ? '#3b82f6' : '#e4e4e7',
                                                backgroundColor: shuffle ? '#eff6ff' : 'white'
                                            }}
                                        >
                                            <input
                                                type="radio"
                                                name="shuffle"
                                                checked={shuffle === true}
                                                onChange={() => setShuffle(true)}
                                                className="w-4 h-4 text-blue-600"
                                            />
                                            <span className="font-medium text-zinc-900">활성화</span>
                                        </label>
                                        <label className="flex items-center gap-3 px-6 py-3 border-2 rounded-xl cursor-pointer transition-all hover:bg-zinc-50"
                                            style={{
                                                borderColor: !shuffle ? '#3b82f6' : '#e4e4e7',
                                                backgroundColor: !shuffle ? '#eff6ff' : 'white'
                                            }}
                                        >
                                            <input
                                                type="radio"
                                                name="shuffle"
                                                checked={shuffle === false}
                                                onChange={() => setShuffle(false)}
                                                className="w-4 h-4 text-blue-600"
                                            />
                                            <span className="font-medium text-zinc-900">비활성화</span>
                                        </label>
                                    </div>
                                    <p className="text-xs text-zinc-500 mt-2">학습 데이터를 무작위로 섞어 학습 성능을 향상시킵니다</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-between items-center">
                        <button
                            onClick={() => router.push(`/project/stats/${project_id}`)}
                            disabled={loading || status}
                            className="px-6 py-3 bg-zinc-200 text-zinc-700 rounded-xl hover:bg-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-all flex items-center gap-2"
                        >
                            <ArrowLeft size={18} />
                            이전 단계
                        </button>

                        <button
                            onClick={handleSubmit}
                            disabled={loading || status || !modelName.trim()}
                            className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl 
                                hover:from-blue-700 hover:to-indigo-700
                                disabled:from-zinc-300 disabled:to-zinc-400 disabled:cursor-not-allowed
                                transition-all shadow-lg hover:shadow-xl
                                flex items-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <Loader2 size={20} className="animate-spin" />
                                    <span>학습 시작 중...</span>
                                </>
                            ) : (
                                <>
                                    <Zap size={20} />
                                    <span>학습 시작</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </ProjectLayout>
    );
}