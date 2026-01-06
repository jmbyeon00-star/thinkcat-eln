// components/FileUploadEditor.tsx
"use client";

import { useState } from "react";
import { UploadCloud, Loader2, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import * as XLSX from "xlsx";

type FileUploadEditorProps = {
    onDataChange?: (data: any[]) => void;
    onFileSelect?: (file: File) => void;
    acceptedFormats?: string;
    maxRowsPreview?: number;
};

export default function FileUploadEditor({
    onDataChange,
    onFileSelect,
    acceptedFormats = ".xlsx,.csv",
    maxRowsPreview = 10,
}: FileUploadEditorProps) {
    const [uploading, setUploading] = useState(false);
    const [rows, setRows] = useState<any[]>([]);
    const [originalFile, setOriginalFile] = useState<File | null>(null);
    const [hasEdited, setHasEdited] = useState(false);

    const [currentPage, setCurrentPage] = useState(1);
    const totalPages = Math.ceil(rows.length / maxRowsPreview);
    const currentRows = rows.slice(
        (currentPage - 1) * maxRowsPreview,
        currentPage * maxRowsPreview
    );

    // 파일 읽기
    async function handleFileUpload(file: File) {
        setUploading(true);
        setOriginalFile(file);
        if (onFileSelect) onFileSelect(file);

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: "array" });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(firstSheet);

                setRows(jsonData as any[]);
                setCurrentPage(1);
                setHasEdited(false);

                if (onDataChange) onDataChange(jsonData as any[]);
            } catch (error) {
                alert("파일을 읽는 중 오류가 발생했습니다.");
                console.error(error);
            } finally {
                setUploading(false);
            }
        };
        reader.readAsArrayBuffer(file);
    }

    // 개별 셀 수정
    function updateCell(index: number, key: string, value: string) {
        setHasEdited(true);
        const globalIndex = (currentPage - 1) * maxRowsPreview + index;

        setRows((prev) => {
            const updated = prev.map((r, i) =>
                i === globalIndex ? { ...r, [key]: value } : r
            );
            if (onDataChange) onDataChange(updated);
            return updated;
        });
    }

    // 행 삭제
    function handleDelete(index: number) {
        const globalIndex = (currentPage - 1) * maxRowsPreview + index;
        setHasEdited(true);

        setRows((prev) => {
            const updated = prev.filter((_, i) => i !== globalIndex);
            if (onDataChange) onDataChange(updated);
            return updated;
        });
    }

    // 수정된 파일 생성
    function getModifiedFile(): File | null {
        if (!originalFile) return null;

        if (hasEdited) {
            const ws = XLSX.utils.json_to_sheet(rows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

            const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
            const blob = new Blob([wbout], {
                type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            });

            return new File([blob], "edited_" + originalFile.name, {
                type: blob.type,
            });
        }

        return originalFile;
    }

    return (
        <div className="space-y-4">
            {/* Upload Area */}
            <div className="rounded-2xl overflow-hidden border border-zinc-100 shadow-lg">
                <div className="bg-gradient-to-r from-blue-700 to-blue-900 px-8 py-6">
                    <div className="flex items-center gap-3">
                        <UploadCloud className="w-6 h-6 text-white" />
                        <h2 className="text-xl font-semibold text-white">파일 선택</h2>
                    </div>
                    <p className="text-blue-100 text-sm mt-2">
                        엑셀(.xlsx) 또는 CSV 파일을 선택하세요.
                    </p>
                </div>

                <div className="p-6 bg-white">
                    <input
                        className="block w-full cursor-pointer rounded-xl border-2 border-zinc-200 bg-white px-3 py-2 text-sm
            file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm 
            hover:file:bg-blue-100 focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                        type="file"
                        accept={acceptedFormats}
                        onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleFileUpload(f);
                        }}
                        disabled={uploading}
                    />

                    {uploading && (
                        <div className="flex items-center gap-2 mt-3 text-blue-700 text-sm">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            파일을 처리 중입니다...
                        </div>
                    )}
                </div>
            </div>

            {/* Editable Table */}
            {rows.length > 0 && (
                <div className="rounded-2xl overflow-hidden border border-zinc-100 shadow-lg">
                    <div className="bg-gradient-to-r from-blue-700 to-blue-900 px-8 py-6">
                        <h2 className="text-xl font-semibold text-white">
                            데이터 미리보기 및 편집
                        </h2>
                        <p className="text-blue-100 text-sm mt-2">
                            셀을 클릭하여 직접 수정할 수 있습니다. (총 {rows.length}행)
                        </p>
                    </div>

                    <div className="p-6 bg-white overflow-x-auto">
                        <table className="w-full border-collapse text-sm">
                            <thead className="bg-blue-50 text-blue-800">
                                <tr>
                                    <th className="px-3 py-2 text-left font-semibold w-[60px]">#</th>
                                    {rows[0] && Object.keys(rows[0]).map((key) => (
                                        <th key={key} className="px-3 py-2 text-left font-semibold">
                                            {key}
                                        </th>
                                    ))}
                                    <th className="px-3 py-2 text-center font-semibold w-[80px]">삭제</th>
                                </tr>
                            </thead>
                            <tbody>
                                {currentRows.map((row, i) => (
                                    <tr
                                        key={i}
                                        className="border-t border-zinc-200 hover:bg-blue-50 transition-colors"
                                    >
                                        {/* 번호 */}
                                        <td className="px-3 py-1 text-zinc-500 text-center">
                                            {(currentPage - 1) * maxRowsPreview + i + 1}
                                        </td>

                                        {/* 데이터 셀 */}
                                        {Object.entries(row).map(([key, value]) => (
                                            <td key={key} className="px-3 py-1">
                                                <input
                                                    type="text"
                                                    value={value as string}
                                                    onChange={(e) =>
                                                        updateCell(i, key, e.target.value)
                                                    }
                                                    className="w-full border border-transparent focus:border-blue-400 focus:ring-1 focus:ring-blue-200 rounded-md px-1 text-sm text-zinc-800"
                                                />
                                            </td>
                                        ))}

                                        {/* 삭제 버튼 */}
                                        <td className="px-3 py-1 text-center">
                                            <button
                                                onClick={() => handleDelete(i)}
                                                className="text-red-600 hover:text-red-800"
                                                title="행 삭제"
                                            >
                                                <Trash2 className="w-4 h-4 inline" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* 페이지네이션 */}
                        {totalPages > 1 && (
                            <div className="flex justify-between items-center mt-4 text-sm text-zinc-700">
                                <div>
                                    총 {rows.length}건 중 {(currentPage - 1) * maxRowsPreview + 1}–
                                    {Math.min(currentPage * maxRowsPreview, rows.length)} 표시
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        disabled={currentPage === 1}
                                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                        className="p-2 rounded-md border border-zinc-200 hover:bg-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <span>
                                        {currentPage} / {totalPages}
                                    </span>
                                    <button
                                        disabled={currentPage === totalPages}
                                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                        className="p-2 rounded-md border border-zinc-200 hover:bg-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// 외부에서 사용할 수 있도록 함수도 export
export { FileUploadEditor };