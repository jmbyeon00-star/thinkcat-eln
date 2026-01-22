// frontend/components/project/SearchComponent.tsx

import React, { useState, useCallback } from "react";
import { Upload, FileText, Loader2, XCircle, Trash2, ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { DataSourceInfo, ProjectData, ProjectInfo } from "@/types/project";
import * as XLSX from 'xlsx'; // 엑셀 파싱 라이브러리 임포트
import { CollectionInfo } from "@/types/collection";

// 페이지네이션 설정
const ITEMS_PER_PAGE = 10;

// 파일 크기 포맷팅 유틸리티
const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}


// ----------------------------------------------------------------------
// 🎯 UploadDataTable 컴포넌트 (페이지네이션 로직 포함)
// ----------------------------------------------------------------------
interface UploadTableProps {
    data: ProjectData[];
    setData: React.Dispatch<React.SetStateAction<ProjectData[]>>;
}

const UploadDataTable: React.FC<UploadTableProps> = ({ data, setData }) => {
    const [currentPage, setCurrentPage] = useState(1);
    const totalPages = Math.ceil(data.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const currentData = data.slice(startIndex, endIndex);

    const goToPage = useCallback((page: number) => {
        if (page > 0 && page <= totalPages) {
            setCurrentPage(page);
        }
    }, [totalPages]);

    const handleEdit = (index: number, field: keyof ProjectData, value: string) => {
        const realIndex = startIndex + index;
        setData(prev => prev.map((item, i) => i === realIndex ? { ...item, [field]: value } : item));
    };

    const handleRemove = (index: number) => {
        const realIndex = startIndex + index;
        setData(prev => {
            const newData = prev.filter((_, i) => i !== realIndex);
            const newTotalPages = Math.ceil(newData.length / ITEMS_PER_PAGE);
            if (currentPage > newTotalPages && newTotalPages > 0) setCurrentPage(newTotalPages);
            return newData;
        });
    };

    // 페이지네이션 컨트롤 렌더링
    const renderPaginationControls = () => {
        if (data.length === 0) return null;

        // 페이지 번호 버튼 리스트 (간소화)
        const getPageNumbers = () => {
            const pages = [];
            // 현재 페이지 주변 2개 페이지까지만 표시
            for (let i = Math.max(1, currentPage - 2); i <= Math.min(totalPages, currentPage + 2); i++) {
                pages.push(i);
            }
            return pages;
        };

        return (
            <div className="flex justify-between items-center px-4 py-3 bg-gray-50 border-t border-gray-200 sm:px-6">
                <div className="text-sm text-gray-700">
                    총 <span className="font-medium">{data.length}</span>개 항목 중
                    <span className="font-medium"> {startIndex + 1}</span> ~
                    <span className="font-medium"> {Math.min(endIndex, data.length)}</span> 표시
                </div>

                {totalPages > 1 && (
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                        <button
                            onClick={() => goToPage(currentPage - 1)}
                            disabled={currentPage === 1}
                            className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                        >
                            <ChevronLeft size={16} />
                        </button>

                        {getPageNumbers().map(page => (
                            <button
                                key={page}
                                onClick={() => goToPage(page)}
                                className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${page === currentPage
                                    ? 'z-10 bg-indigo-50 border-indigo-500 text-indigo-600'
                                    : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                                    }`}
                            >
                                {page}
                            </button>
                        ))}

                        <button
                            onClick={() => goToPage(currentPage + 1)}
                            disabled={currentPage === totalPages}
                            className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </nav>
                )}
            </div>
        );
    };

    return (
        <div className="mt-4">
            <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-md">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr className="text-[11px] font-black text-zinc-400 uppercase tracking-widest">
                            <th className="px-6 py-4 text-left">#</th>
                            <th className="px-6 py-4 text-left">Title</th>
                            <th className="px-6 py-4 text-left">Abstract</th>
                            <th className="px-6 py-4 text-left">Label</th>
                            <th className="px-6 py-4 text-left">Action</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {currentData.map((item, index) => (
                            <tr key={item.id || index} className="hover:bg-indigo-50/30 transition-colors">
                                <td className="px-6 py-4 text-zinc-400 font-mono">{startIndex + index + 1}</td>
                                <td className="px-6 py-4"><input type="text" value={item.title || ''} onChange={(e) => handleEdit(index, 'title', e.target.value)} className="w-full border-none bg-transparent p-0 focus:ring-0 font-bold text-zinc-800" /></td>
                                <td className="px-6 py-4"><textarea rows={1} value={item.abstract || ''} onChange={(e) => handleEdit(index, 'abstract', e.target.value)} className="w-full border-none bg-transparent p-0 focus:ring-0 text-zinc-500 resize-none text-xs" /></td>
                                <td className="px-6 py-4"><span className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded-lg font-bold text-[11px]">{item.label}</span></td>
                                <td className="px-6 py-4 text-right"><button onClick={() => handleRemove(index)} className="text-zinc-300 hover:text-red-500"><Trash2 size={16} /></button></td>
                            </tr>
                        ))}
                        {currentData.length === 0 && (
                            <tr><td colSpan={5} className="py-8 text-center text-gray-500">현재 페이지에 표시할 데이터가 없습니다.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
            {renderPaginationControls()}
        </div>
    );
};
// --- 테이블 컴포넌트 끝 ---

// ----------------------------------------------------------------------
// 🎯 UploadComponent
// ----------------------------------------------------------------------
interface UploadComponentProps {
    // onTrainingDataUpdate Step1Content의 handleDataAddition과 동일한 시그니처를 가집니다.
    project: ProjectInfo;
    collections: CollectionInfo[];
    token: string;
    onTrainingDataUpdate: (newItems: ProjectData[], sourceInfo: DataSourceInfo) => void;
    fixedCollectionName?: string;
}
export default function UploadComponent({ project, token, collections, onTrainingDataUpdate, fixedCollectionName }: UploadComponentProps) {
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [parsedData, setParsedData] = useState<ProjectData[]>([]);

    const handleFileUpload = useCallback(async (uploadedFile: File) => {
        setUploading(true);
        try {
            const reader = new FileReader();
            reader.onload = (e) => {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet);

                const fileCollectionName = uploadedFile.name.split('.')[0] || '업로드_데이터';
                const extractedItems: ProjectData[] = rawJson.map((row, index) => {
                    const title = row.title || row.Title || '';
                    const abstract = row.abstract || row.Abstract || '';
                    const label = fixedCollectionName || row.label || row.Label || row.class_name || row.collection_name || '';

                    if (!title || !abstract || !label) {
                        console.warn(`Row ${index + 1} skipped: Missing required columns.`);
                    }

                    return {
                        id: `upload_${index}_${Date.now()}`,
                        sourceId: `${uploadedFile.name}`,
                        title: title,
                        abstract: abstract,
                        label: label,
                        collection_name: label,
                        application_number: row.application_number || row.application_no || null,
                        used: 1
                    };
                }).filter(item => item.title && item.abstract && item.label); // 필수 항목 있는 것만 필터링

                if (extractedItems.length === 0) {
                    alert("유효한 데이터를 추출하지 못했습니다.");
                    setUploading(false);
                    return;
                }

                setParsedData(extractedItems);
                setFile(uploadedFile);
                setUploading(false);

            };

            reader.readAsArrayBuffer(uploadedFile);

        } catch (error) {
            alert("파일 처리 중 오류가 발생했습니다.");
            setUploading(false);
        }
    }, [fixedCollectionName]);

    const handleFinalUpload = async () => {
        if (parsedData.length === 0) return;

        const sourceInfo: DataSourceInfo = {
            name: file!.name,
            count: parsedData.length,
            type: 'upload',
            sourceId: file!.name,
        };

        try {
            if (fixedCollectionName) {
                const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

                // 백엔드 insert_project_data 함수가 기대하는 items 구조로 매핑
                const payload = {
                    items: parsedData.map(item => ({
                        ...item,
                        collection_name: fixedCollectionName,
                        used: 1
                    })),
                    n_items: []
                };

                const res = await fetch(`${API_BASE}/api/project/${project.id}/data/add`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify(payload),
                });

                if (res.ok) {
                    alert(`'${fixedCollectionName}' 컬렉션에 ${parsedData.length}개의 데이터가 즉시 저장되었습니다.`);
                    // 부모의 previewItems 테이블 갱신을 위해 콜백 호출
                    onTrainingDataUpdate(parsedData, sourceInfo);
                } else {
                    const errorData = await res.json();
                    throw new Error(errorData.detail || "저장 실패");
                }
            } else {
                onTrainingDataUpdate(parsedData, sourceInfo);
                alert(`${sourceInfo.count}개 항목이 학습 대기열에 추가되었습니다.`);
            }

            setFile(null);
            setParsedData([]);
            // alert(`${sourceInfo.count}개 항목이 ${fixedCollectionName ? `'${fixedCollectionName}'에 ` : ""}추가되었습니다.`);
        } catch (e: any) {
            console.error("Upload Save Error:", e);
            alert(e.message || "등록 중 오류가 발생했습니다.");
        }
    };

    // 드래그앤드롭 핸들러
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileUpload(e.dataTransfer.files[0]);
        }
    };


    return (
        <div className="space-y-4">

            {/* 특정 컬렉션 편집 모드 안내 */}
            {fixedCollectionName && (
                <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex items-center gap-3">
                    <Info className="text-emerald-600" size={20} />
                    <p className="text-sm font-bold text-emerald-900">
                        '{fixedCollectionName}' 컬렉션 데이터 보충 모드
                        <span className="block text-[11px] font-medium text-emerald-600 mt-0.5">
                            업로드하는 모든 행의 Label이 자동으로 '{fixedCollectionName}'으로 고정됩니다.
                        </span>
                    </p>
                </div>
            )}


            <div className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all 
                ${parsedData.length > 0 ? 'border-emerald-200 bg-emerald-50/30' : 'border-zinc-200 bg-zinc-50'
                }`}>
                {uploading ? (
                    <div className="flex flex-col items-center py-4"><Loader2 className="animate-spin text-emerald-500 mb-2" /><p className="text-sm font-bold">파싱 중...</p></div>
                ) : parsedData.length === 0 ? (
                    <div onDragOver={(e) => e.preventDefault()} onDrop={handleDrop} className="cursor-pointer" onClick={() => document.getElementById('file-input')?.click()}>
                        <Upload className="mx-auto text-zinc-300 mb-2" size={32} />
                        <p className="text-sm font-bold text-zinc-500">파일을 드래그하거나 클릭하여 선택하세요.</p>
                        <p className="text-xs text-gray-400">(XLSX, CSV, JSON 지원)</p>
                        <input id="file-input" type="file" accept=".xlsx,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])} />
                    </div>
                ) : (
                    <div className="flex items-center justify-between text-left">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white rounded-lg shadow-sm">
                                <FileText className="text-emerald-500" size={20} />
                            </div>
                            <div>
                                <p className="text-sm font-black text-zinc-800">{file?.name}</p>
                                <p className="text-xs text-zinc-400">{`${parsedData.length} ( ${formatBytes(file!.size)} )`}</p>
                            </div>
                        </div>
                        <button onClick={() => { setFile(null); setParsedData([]); }} className="text-zinc-400 hover:text-red-500"><XCircle size={20} /></button>
                    </div>
                )}
            </div>

            {/* 2. 모니터링 및 편집 테이블 */}
            {parsedData.length > 0 && (
                <div className="animate-in slide-in-from-top-2">
                    <UploadDataTable data={parsedData} setData={setParsedData} />
                    <div className="flex justify-end mt-4">
                        <button
                            onClick={handleFinalUpload}
                            // className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg shadow-md hover:bg-indigo-700 transition-colors disabled:opacity-50"
                            className="bg-indigo-600 text-white px-10 py-3 rounded-2xl font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 flex items-center gap-2 transition-all"
                            disabled={parsedData.length === 0}
                        >
                            <Upload size={20} className="mr-2 inline-block" /> 담기
                        </button>
                    </div>
                </div>
            )}

        </div>
    );
}