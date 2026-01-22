// components/ModelRetrainSection.tsx
import { useEffect, useState } from "react";
import { ChevronUp, ChevronDown, Sparkles, Upload, Database, CheckCircle2 } from "lucide-react";
import ModelProgressSSE from "@/components/ModelProgressSSE";
import FileUploadEditor from "@/components/common/FileUploadEditor";
import type { UserTaskState } from "@/lib/store/useUserTaskStore";

type ModelRetrainSectionProps = {
    model: {
        id: number;
        data_scope: string;
        project_id?: number;
        collection_id?: number;
        updated_count?: number;
        progress?: number;
        collection_num?: number;
        epoch?: number;
        batch_size?: number;
        learning_rate?: number;
        max_length?: number;
        shuffle?: number;
    };
    isBusy: boolean;
    token?: string;
    // storeStatus: string;
    // onStateChange: (state: { isBusy?: boolean; status?: string; progress?: number }) => void;
    storeStatus: UserTaskState["status"];  // RUNNING | INFERRING | AVAILABLE
    onStateChange: (state: Partial<UserTaskState>) => void;
};

export default function ModelRetrainSection({
    model,
    isBusy,
    storeStatus,
    token,
    onStateChange,
}: ModelRetrainSectionProps) {
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
    const [showRetrain, setShowRetrain] = useState(false);
    const [uploadedData, setUploadedData] = useState<any[]>([]);
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);

    // 데이터 그룹 관련 상태
    const [dataGroups, setDataGroups] = useState<Record<string, any[]>>({});
    const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
    const [loadingGroups, setLoadingGroups] = useState(false);

    const [params, setParams] = useState({
        epoch: model.epoch ?? null,
        batch_size: model.batch_size ?? null,
        learning_rate: model.learning_rate ?? null,
        max_length: model.max_length ?? null,
        shuffle: model.shuffle === 1,
    });

    // 데이터 그룹 불러오기
    useEffect(() => {
        const fetchDataGroups = async () => {
            if (!model?.id || !token) return;

            setLoadingGroups(true);
            try {
                const response = await fetch(`${API_BASE}/api/data/groups/${model.id}`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    credentials: "include",
                });

                if (!response.ok) {
                    throw new Error("Failed to fetch data groups");
                }

                const data = await response.json();
                console.log("data groups:", data);
                setDataGroups(data);
            } catch (error) {
                console.error("데이터 그룹 불러오기 실패:", error);
            } finally {
                setLoadingGroups(false);
            }
        };

        if (showRetrain) {
            fetchDataGroups();
        }
    }, [model?.id, token, showRetrain]);

    // 데이터 그룹 체크박스 토글
    const handleGroupToggle = (groupKey: string) => {
        setSelectedGroups(prev => {
            if (prev.includes(groupKey)) {
                return prev.filter(key => key !== groupKey);
            } else {
                return [...prev, groupKey];
            }
        });

        // 데이터 그룹 선택 시 업로드된 파일 초기화
        if (!selectedGroups.includes(groupKey)) {
            setUploadedFile(null);
            setUploadedData([]);
        }
    };

    // 파일 업로드 시 데이터 그룹 선택 해제
    const handleFileSelect = (file: File) => {
        setUploadedFile(file);
        setSelectedGroups([]);
    };

    const handleDataChange = (data: any[]) => {
        setUploadedData(data);
        setSelectedGroups([]);
    };

    // 선택된 데이터 총 개수 계산
    const getTotalSelectedCount = () => {
        return selectedGroups.reduce((total, groupKey) => {
            return total + (dataGroups[groupKey]?.length || 0);
        }, 0);
    };

    const handleReTrain = async () => {
        if (!token) {
            alert("인증 토큰이 없습니다.");
            return;
        }

        // 파일 업로드와 데이터 그룹 선택 둘 다 없으면 경고
        if (uploadedData.length === 0 && selectedGroups.length === 0) {
            alert("파일을 업로드하거나 데이터 그룹을 선택해주세요.");
            return;
        }

        onStateChange({ isBusy: true, status: "RUNNING", progress: 0 });

        try {
            const formData = new FormData();

            // 업로드된 파일이 있으면 파일 추가
            if (uploadedFile && uploadedData.length > 0) {
                formData.append("file", uploadedFile);
                formData.append("use_file", "true");
            }
            // 데이터 그룹 선택이 있으면 그룹 키 추가
            else if (selectedGroups.length > 0) {
                formData.append("selected_groups", JSON.stringify(selectedGroups));
                formData.append("use_file", "false");
            }

            // 학습 파라미터 추가
            formData.append("model_id", String(model.id));
            formData.append("epoch", String(params.epoch));
            formData.append("batch_size", String(params.batch_size));
            formData.append("learning_rate", String(params.learning_rate));
            formData.append("max_length", String(params.max_length));
            formData.append("shuffle", params.shuffle ? "1" : "0");

            const response = await fetch(
                `${API_BASE}/api/ai/retrain/classification/${model.data_scope}/${model.project_id}`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                    credentials: "include",
                    body: formData,
                }
            );

            if (!response.ok) {
                throw new Error("추가 학습 요청 실패");
            }

            alert("추가 학습이 시작되었습니다.");
        } catch (error) {
            console.error("추가 학습 오류:", error);
            alert("추가 학습 요청 중 오류가 발생했습니다.");
            onStateChange({ isBusy: false, status: "AVAILABLE" });
        }
    };

    return (
        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
            <div
                className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 cursor-pointer"
                onClick={() => setShowRetrain((prev) => !prev)}
            >
                <div className="flex items-center gap-2">
                    {showRetrain ? (
                        <ChevronUp className="h-5 w-5 text-white" />
                    ) : (
                        <ChevronDown className="h-5 w-5 text-white" />
                    )}
                    <h2 className="text-lg font-semibold text-white">
                        추가학습 (Fine-Tuning)
                    </h2>
                </div>
            </div>

            {showRetrain && (
                <div className="p-6">
                    {model ? (
                        <>
                            {isBusy && (storeStatus === "RUNNING" || storeStatus === "INFERRING") && model?.id ? (
                                /* ✅ 학습 중일 때 SSE 진행률 표시 */
                                <div>
                                    {storeStatus === "RUNNING" && "신규 데이터 학습"}
                                    {storeStatus === "INFERRING" && "추론"}
                                    <ModelProgressSSE
                                        targetId={model.id}
                                        initialProgress={model.progress ?? 0}
                                        setValue={(progress) => onStateChange({ progress })}
                                    />
                                </div>
                            ) : (
                                <>
                                    {/* 데이터 그룹 선택 섹션 */}
                                    <div className="mb-6">
                                        <div className="rounded-2xl overflow-hidden border border-zinc-100 shadow-lg">
                                            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-8 py-6">
                                                <div className="flex items-center gap-3">
                                                    <Database className="w-6 h-6 text-white" />
                                                    <h2 className="text-xl font-semibold text-white">
                                                        기존 데이터 그룹 선택
                                                    </h2>
                                                </div>
                                                <p className="text-emerald-100 text-sm mt-2">
                                                    여러 데이터 그룹을 선택하여 학습할 수 있습니다.
                                                </p>
                                            </div>

                                            <div className="p-6 bg-white">
                                                {loadingGroups ? (
                                                    <div className="flex items-center gap-2 text-zinc-600">
                                                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-blue-600" />
                                                        데이터 그룹을 불러오는 중...
                                                    </div>
                                                ) : Object.keys(dataGroups).length === 0 ? (
                                                    <div className="text-zinc-500 text-sm">
                                                        사용 가능한 데이터 그룹이 없습니다.
                                                    </div>
                                                ) : (
                                                    <div className="space-y-3">
                                                        {Object.entries(dataGroups).map(([groupKey, groupData]) => {
                                                            const isSelected = selectedGroups.includes(groupKey);
                                                            const displayName = groupKey === "" ? "초기 학습 데이터" : groupKey;

                                                            return (
                                                                <label
                                                                    key={groupKey}
                                                                    className={`flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${isSelected
                                                                        ? "border-emerald-500 bg-emerald-50"
                                                                        : "border-zinc-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/50"
                                                                        }`}
                                                                >
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={isSelected}
                                                                        onChange={() => handleGroupToggle(groupKey)}
                                                                        disabled={uploadedFile !== null}
                                                                        className="w-5 h-5 text-emerald-600 rounded focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                                                    />
                                                                    <div className="flex-1">
                                                                        <div className="font-medium text-zinc-800">
                                                                            {displayName}
                                                                        </div>
                                                                        <div className="text-sm text-zinc-500 mt-1">
                                                                            {groupData.length.toLocaleString()}건의 데이터
                                                                        </div>
                                                                    </div>
                                                                    {isSelected && (
                                                                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                                                                    )}
                                                                </label>
                                                            );
                                                        })}
                                                    </div>
                                                )}

                                                {/* 선택된 데이터 요약 */}
                                                {selectedGroups.length > 0 && (
                                                    <div className="mt-4 p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                                                        <div className="flex items-center gap-2 text-emerald-700 font-medium">
                                                            <CheckCircle2 className="w-4 h-4" />
                                                            <span>
                                                                선택됨: {selectedGroups.length}개 그룹, 총{" "}
                                                                {getTotalSelectedCount().toLocaleString()}건
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* OR 구분선 */}
                                    <div className="relative my-6">
                                        <div className="absolute inset-0 flex items-center">
                                            <div className="w-full border-t border-zinc-300"></div>
                                        </div>
                                        <div className="relative flex justify-center">
                                            <span className="bg-white px-4 text-sm font-medium text-zinc-500">
                                                또는
                                            </span>
                                        </div>
                                    </div>
                                </>
                            )}
                        </>
                    ) : (
                        <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-2xl shadow-sm border border-yellow-200 p-8">
                            <div className="flex items-start gap-4">
                                <div className="rounded-xl bg-yellow-100 p-3">
                                    <Sparkles className="w-6 h-6 text-yellow-600" />
                                </div>
                                <div className="flex-none">
                                    <h3 className="text-lg font-semibold text-zinc-900 mb-2">
                                        해당 모델은 추가 학습이 가능합니다.
                                    </h3>
                                    <p className="text-sm text-zinc-600 leading-relaxed">
                                        이 모델에 사용된 ...
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 학습 파라미터 섹션 */}
                    {!isBusy && (
                        <>
                            {/* 파일 업로드 섹션 */}
                            <div className="mb-6">
                                <FileUploadEditor
                                    onDataChange={handleDataChange}
                                    onFileSelect={handleFileSelect}
                                    acceptedFormats=".xlsx,.csv"
                                    maxRowsPreview={10}
                                />
                                {uploadedFile && (
                                    <div className="mt-3 text-sm text-zinc-600">
                                        ℹ️ 파일이 업로드되어 데이터 그룹 선택이 비활성화되었습니다.
                                    </div>
                                )}
                            </div>
                            <div className="bg-gradient-to-br from-zinc-50 to-zinc-100 rounded-xl p-6 mt-4 border border-zinc-200">
                                <h3 className="text-lg font-semibold text-zinc-900 mb-4 flex items-center gap-2">
                                    <div className="w-1 h-5 bg-gradient-to-b from-blue-600 to-indigo-600 rounded-full" />
                                    학습 파라미터
                                </h3>

                                <div className="grid grid-cols-2 gap-4">
                                    <label className="flex flex-col">
                                        <span className="text-sm font-medium text-zinc-700 mb-2">
                                            Epoch
                                        </span>
                                        <input
                                            type="number"
                                            value={params.epoch ?? ""}
                                            onChange={(e) =>
                                                setParams({ ...params, epoch: Number(e.target.value) })
                                            }
                                            disabled={isBusy}
                                            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-zinc-100 disabled:cursor-not-allowed"
                                        />
                                    </label>
                                    <label className="flex flex-col">
                                        <span className="text-sm font-medium text-zinc-700 mb-2">
                                            Batch Size
                                        </span>
                                        <input
                                            type="number"
                                            value={params.batch_size ?? ""}
                                            onChange={(e) =>
                                                setParams({ ...params, batch_size: Number(e.target.value) })
                                            }
                                            disabled={isBusy}
                                            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-zinc-100 disabled:cursor-not-allowed"
                                        />
                                    </label>
                                    <label className="flex flex-col">
                                        <span className="text-sm font-medium text-zinc-700 mb-2">
                                            Learning Rate
                                        </span>
                                        <input
                                            type="number"
                                            step="0.00001"
                                            value={params.learning_rate ?? ""}
                                            onChange={(e) =>
                                                setParams({
                                                    ...params,
                                                    learning_rate: parseFloat(e.target.value),
                                                })
                                            }
                                            disabled={isBusy}
                                            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-zinc-100 disabled:cursor-not-allowed"
                                        />
                                    </label>
                                    <label className="flex flex-col">
                                        <span className="text-sm font-medium text-zinc-700 mb-2">
                                            Max Length
                                        </span>
                                        <input
                                            type="number"
                                            value={params.max_length ?? ""}
                                            onChange={(e) =>
                                                setParams({ ...params, max_length: Number(e.target.value) })
                                            }
                                            disabled={isBusy}
                                            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-zinc-100 disabled:cursor-not-allowed"
                                        />
                                    </label>
                                </div>

                                <div className="flex items-center gap-6 mt-4">
                                    <span className="text-sm font-medium text-zinc-700">Shuffle</span>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="shuffle"
                                            checked={params.shuffle === true}
                                            onChange={() => setParams({ ...params, shuffle: true })}
                                            disabled={isBusy}
                                            className="w-4 h-4 text-blue-600"
                                        />
                                        <span className="text-sm text-zinc-700">On</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="shuffle"
                                            checked={params.shuffle === false}
                                            onChange={() => setParams({ ...params, shuffle: false })}
                                            disabled={isBusy}
                                            className="w-4 h-4 text-blue-600"
                                        />
                                        <span className="text-sm text-zinc-700">Off</span>
                                    </label>
                                </div>
                            </div>

                            {/* 추가 학습 시작 버튼 */}
                            <button
                                className="w-full flex items-center justify-center mt-4 gap-2 px-6 py-3 border border-blue-600 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                onClick={handleReTrain}
                                disabled={isBusy || (uploadedData.length === 0 && selectedGroups.length === 0)}
                            >
                                {uploadedData.length === 0 && selectedGroups.length === 0 ? (
                                    <>
                                        <Upload className="w-5 h-5" />
                                        <span>파일 업로드 또는 데이터 그룹을 선택해주세요</span>
                                    </>
                                ) : uploadedData.length > 0 ? (
                                    <>
                                        <Sparkles className="w-5 h-5" />
                                        <span>추가 학습 시작 (파일: {uploadedData.length}건)</span>
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-5 h-5" />
                                        <span>
                                            추가 학습 시작 ({selectedGroups.length}개 그룹, {getTotalSelectedCount()}건)
                                        </span>
                                    </>
                                )}
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}