"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "@/routing";
import { SearchX } from "lucide-react";
import { getAgentDetail } from "@/lib/api";

interface Props {
    agentCode: string;
    onClose: () => void;
}

export default function AgentDetailModal({ agentCode, onClose }: Props) {
    const [loading, setLoading] = useState(true);
    const [detail, setDetail] = useState<any>(null);

    useEffect(() => {
        async function fetchDetail() {
            try {
                setLoading(true);
                const result = await getAgentDetail(agentCode);
                setDetail(result);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
        fetchDetail();
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = 'unset'; };
    }, [agentCode]);

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
                {/* 헤더 섹션 */}
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="text-xl font-bold text-slate-900">변리사 상세 정보</h3>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-200 rounded-full text-slate-400 transition-colors"
                    >
                        <SearchX className="w-6 h-6" />
                    </button>
                </div>

                {/* 본문 섹션 */}
                <div className="p-8">
                    {loading ? (
                        <div className="flex flex-col items-center py-12 gap-4">
                            <div className="w-10 h-10 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin" />
                            <p className="text-sm text-slate-400 font-medium">정보를 불러오고 있습니다</p>
                        </div>
                    ) : detail ? (
                        <div className="space-y-5">
                            {/* 임시 인물 사진 260226 */}
                            <div className="flex flex-col items-center mb-6">
                                <div className="w-32 h-32 rounded-3xl overflow-hidden shadow-lg border-4 border-white bg-slate-100 flex items-center justify-center">
                                    <img
                                        src={`/attorney_photos/${agentCode}_${detail.name}.jpg`}
                                        alt={detail.name}
                                        className="w-full h-full object-cover"
                                        onError={(e: any) => {
                                            e.target.src = "/default-profile.png";
                                        }}
                                    />
                                </div>
                            </div>
                            <div className="flex justify-between items-center border-b border-slate-50 pb-3">
                                <span className="text-slate-500 text-sm font-medium">성명</span>
                                <span className="font-bold text-slate-900 text-lg">{detail.name}</span>
                            </div>
                            <div className="flex justify-between items-center border-b border-slate-50 pb-3">
                                <span className="text-slate-500 text-sm font-medium">자격 구분</span>
                                <span className="text-slate-700 font-medium">{detail.qualification_type}</span>
                            </div>
                            <div className="flex justify-between items-center border-b border-slate-50 pb-3">
                                <span className="text-slate-500 text-sm font-medium">등록일</span>
                                <span className="text-slate-700 font-medium tabular-nums">{detail.registration_date}</span>
                            </div>
                            <div className="flex justify-between items-center border-b border-slate-50 pb-3">
                                <span className="text-slate-500 text-sm font-medium">이메일</span>
                                <span className="text-blue-600 font-semibold">{detail.email}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-500 text-sm font-medium">상태</span>
                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${detail.status?.includes('휴업') ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
                                    }`}>
                                    {detail.status}
                                </span>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-10 space-y-2">
                            <SearchX className="w-12 h-12 text-slate-200 mx-auto" />
                            <p className="text-slate-500">데이터를 찾을 수 없습니다.</p>
                        </div>
                    )}
                </div>

                {/* 푸터 섹션 */}
                <div className="p-6 bg-slate-50 border-t border-slate-100">
                    <button
                        onClick={onClose}
                        className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all active:scale-[0.98]"
                    >
                        확인
                    </button>
                </div>
            </div>
        </div>
    );
}