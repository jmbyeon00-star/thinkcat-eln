// frontend/components/project/SearchComponent.tsx

import React, { useState, useCallback } from "react";
import { Upload, FileText, Loader2, XCircle, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
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
    // 🎯 현재 페이지에 표시할 데이터만 슬라이싱
    const currentData = data.slice(startIndex, endIndex);

    const goToPage = useCallback((page: number) => {
        if (page > 0 && page <= totalPages) {
            setCurrentPage(page);
        }
    }, [totalPages]);

    // 데이터 편집 핸들러
    const handleEdit = (index: number, field: keyof ProjectData, value: string) => {
        // 전체 data 배열에서 실제 인덱스를 계산해야 합니다.
        const realIndex = startIndex + index;

        setData(prev => prev.map((item, i) =>
            i === realIndex ? { ...item, [field]: value } : item
        ));
    };

    // 데이터 제거 핸들러
    const handleRemove = (index: number) => {
        const realIndex = startIndex + index;

        setData(prev => {
            const newData = prev.filter((_, i) => i !== realIndex);

            // 항목 제거 후, 현재 페이지가 비거나 총 페이지 수를 초과하면 페이지를 조정합니다.
            const newTotalPages = Math.ceil(newData.length / ITEMS_PER_PAGE);
            if (currentPage > newTotalPages && newTotalPages > 0) {
                setCurrentPage(newTotalPages);
            } else if (newData.length === 0) {
                setCurrentPage(1);
            }

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
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase w-1/4">Title</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase w-1/4">Abstract</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase w-1/5">Label</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"></th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {currentData.map((item, index) => (
                            <tr key={item.id || index} className="hover:bg-indigo-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{startIndex + index + 1}</td>

                                {/* Title 필드 편집 */}
                                <td className="px-6 py-4 text-sm text-gray-900 w-1/4">
                                    <input
                                        type="text"
                                        value={item.title || ''}
                                        onChange={(e) => handleEdit(index, 'title', e.target.value)}
                                        className="w-full border rounded p-1 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                                    />
                                </td>

                                {/* Abstract 필드 편집 */}
                                <td className="px-6 py-4 text-sm text-gray-900 w-1/4">
                                    <input
                                        type="text"
                                        value={item.abstract || ''}
                                        onChange={(e) => handleEdit(index, 'abstract', e.target.value)}
                                        className="w-full border rounded p-1 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                                    />
                                </td>

                                {/* Label 필드 편집 */}
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 w-1/5">
                                    <input
                                        type="text"
                                        value={item.label || ''}
                                        onChange={(e) => handleEdit(index, 'label', e.target.value)}
                                        className="w-full border rounded p-1 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                                    />
                                </td>

                                {/* 삭제 버튼 */}
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button
                                        onClick={() => handleRemove(index)}
                                        className="text-red-600 hover:text-red-900 transition-colors p-1"
                                        title="행 제거"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </td>
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
}
export default function UploadComponent({ onTrainingDataUpdate }: UploadComponentProps) {
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    // 🎯 [수정] itemCount 대신 parsedData의 길이를 사용합니다.
    // const [itemCount, setItemCount] = useState(0);
    const [parsedData, setParsedData] = useState<ProjectData[]>([]);

    // 🎯 [핵심] 파일 파싱 및 데이터 생성 (이 부분에 실제 파일 처리 로직이 들어갑니다)
    const handleFileUpload = useCallback(async (uploadedFile: File) => {
        setUploading(true);
        // setItemCount(0);

        try {
            const reader = new FileReader();

            // 파일 읽기가 완료된 후 실행될 로직
            reader.onload = (e) => {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];

                // 시트를 JSON 배열로 변환 (헤더는 첫 번째 행 사용)
                const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet);

                // 🎯 1. 데이터 추출 및 ProjectDataItem 구조로 변환
                const fileCollectionName = uploadedFile.name.split('.')[0] || '업로드_데이터';
                const extractedItems: ProjectData[] = rawJson.map((row, index) => {
                    // key가 소문자로 추출될 수 있으므로, 대소문자를 확인하거나 일치시켜야 합니다.
                    const title = row.title || row.Title || '';
                    const abstract = row.abstract || row.Abstract || '';
                    const label = row.label || row.Label || '';

                    if (!title || !abstract || !label) {
                        // 필수 컬럼 누락 시 경고 처리
                        console.warn(`Row ${index + 1} skipped: Missing required columns.`);
                    }

                    return {
                        // id: `${uploadedFile.name}_${index}_${Date.now()}`, // 고유 ID 생성
                        id: `upload_${index}`, // 고유 ID 생성
                        sourceId: `${uploadedFile.name}`,
                        title: title,
                        abstract: abstract,
                        label: label,
                        collection_name: fileCollectionName,
                    };
                }).filter(item => item.title && item.abstract && item.label); // 필수 항목 있는 것만 필터링

                if (extractedItems.length === 0) {
                    alert("파일에서 유효한 [title, abstract, label] 데이터를 추출하지 못했습니다.");
                    setUploading(false);
                    return;
                }

                // 🎯 2. 소스 정보 구성
                const sourceInfo: DataSourceInfo = {
                    name: uploadedFile.name,
                    count: extractedItems.length,
                    type: 'upload',
                    sourceId: uploadedFile.name,
                };

                // 🎯 [수정] onTrainingDataUpdate 호출 대신, parsedData 상태에 저장
                setParsedData(extractedItems);
                setFile(uploadedFile);
                // setItemCount(extractedItems.length);
                setUploading(false);
                // 💡 여기서 onTrainingDataUpdate 호출하지 않고, 아래 "등록 버튼"에서 호출
                // 🎯 3. 상위 컴포넌트로 데이터 항목과 소스 정보 전달
                // onTrainingDataUpdate(extractedItems, sourceInfo);

            };

            // 파일 읽기 시작
            reader.readAsArrayBuffer(uploadedFile);

        } catch (error) {
            console.error("파일 처리 중 오류 발생:", error);
            alert("파일을 처리하는 중 오류가 발생했습니다. 형식을 확인해 주세요.");
            setUploading(false);
        }
        // }, [onTrainingDataUpdate]); // 의존성 제거; onTrainingDataUpdate 등록버튼에서 사용(수정)
    }, []);

    // 🎯 [추가] 최종 등록 버튼 핸들러
    // 최종 등록 버튼 핸들러
    const handleFinalUpload = () => {
        if (parsedData.length === 0) {
            alert("편집할 데이터가 없습니다.");
            return;
        }

        // 1. 소스 정보 구성 (최종 개수를 사용)
        const sourceInfo: DataSourceInfo = {
            name: file!.name,
            count: parsedData.length, // 현재 편집된 데이터의 개수
            type: 'upload',
            sourceId: file!.name,
        };

        // 2. 상위 컴포넌트로 최종 데이터 전달
        onTrainingDataUpdate(parsedData, sourceInfo);

        // 3. 로컬 상태 초기화 
        setFile(null);
        setParsedData([]);
        alert(`총 ${sourceInfo.count}개 항목이 학습 데이터에 추가되었습니다.`);
    }
    // 파일 제거 핸들러 (TrainingDataItems에서 제거하는 로직은 Step1Content의 handleRemoveFile에 위임되어야 합니다.)
    // const handleRemove = () => {
    //     // [TODO] Step1Content의 handleRemoveFile 함수 호출 로직 추가 (필요 시)
    //     // 현재는 onTrainingDataUpdate를 통해 직접 제거할 방법이 없으므로, onRemove 콜백이 필요합니다.
    //     setFile(null);
    //     setItemCount(0);
    // }

    // 파일 제거 핸들러 수정
    const handleRemove = () => {
        if (window.confirm("현재 업로드된 파일과 편집된 데이터를 모두 삭제하시겠습니까?")) {
            setFile(null);
            setParsedData([]);
            // setItemCount(0);
            // 💡 [TODO] 상위 컴포넌트의 TrainingDataItems에서 제거하는 로직은 Step1Content의 handleRemoveFile이 필요합니다.
        }
    }

    // 드래그앤드롭 핸들러
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileUpload(e.dataTransfer.files[0]);
        }
    };

    // 파일 선택 핸들러
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            handleFileUpload(e.target.files[0]);
        }
    };


    return (
        <div className="space-y-4">
            {/* 1. 파일 선택 및 드래그앤드롭 영역 */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center bg-gray-50">
                {uploading ? (
                    // 로딩 UI
                    <div className="flex flex-col items-center justify-center h-24">
                        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                        <p className="mt-2 text-indigo-600 font-medium">파일을 파싱하고 있습니다...</p>
                    </div>
                ) : parsedData.length === 0 ? (
                    // 드래그앤드롭 UI (파일이 없을 때)
                    <div
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={handleDrop}
                        className="cursor-pointer"
                        onClick={() => document.getElementById('file-input')?.click()}
                    >
                        <Upload className="w-8 h-8 mx-auto text-gray-400" />
                        <p className="mt-2 text-sm text-gray-600">파일을 드래그하거나 클릭하여 선택하세요.</p>
                        <p className="text-xs text-gray-400">(XLSX, CSV, JSON 지원)</p>
                        <input
                            id="file-input"
                            type="file"
                            accept=".xlsx,.csv,.json"
                            className="hidden"
                            onChange={handleFileSelect}
                        />
                    </div>
                ) : (
                    // 파일 정보 요약 (데이터가 있을 때)
                    <div className="flex items-center justify-between bg-white border border-indigo-200 rounded-lg p-3 shadow-md">
                        <div className="flex items-center">
                            <FileText className="w-5 h-5 text-indigo-500 mr-3" />
                            <div>
                                <p className="text-sm font-medium text-gray-800 truncate">{file!.name}</p>
                                <p className="text-xs text-gray-500">{formatBytes(file!.size)} - 현재 **{parsedData.length}** 항목 편집 중</p>
                            </div>
                        </div>
                        <button onClick={handleRemove} className="text-red-500 hover:text-red-700 ml-4">
                            <XCircle className="w-5 h-5" />
                        </button>
                    </div>
                )}
            </div>

            {/* 2. 모니터링 및 편집 테이블 */}
            {parsedData.length > 0 && (
                <>
                    <p className="text-sm text-gray-600">
                        데이터를 확인 및 수정하고, 등록 버튼을 눌러 학습 데이터에 추가하세요.
                    </p>
                    {/* 🎯 페이지네이션 적용된 테이블 컴포넌트 렌더링 */}
                    <UploadDataTable data={parsedData} setData={setParsedData} />

                    {/* 3. 최종 등록 버튼 */}
                    <div className="flex justify-end mt-4">
                        <button
                            onClick={handleFinalUpload}
                            className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg shadow-md hover:bg-indigo-700 transition-colors disabled:opacity-50"
                            disabled={parsedData.length === 0}
                        >
                            {/* <Upload size={20} className="mr-2 inline-block" /> {parsedData.length} 항목 등록하기 */}
                            <Upload size={20} className="mr-2 inline-block" /> 등록하기
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}