// frontend/components/project/UploadComponent.tsx
import React, { useState, useCallback, useMemo } from "react";
import { Upload, FileText, Loader2, XCircle, CheckCircle2 } from 'lucide-react';
import { DataSourceInfo, ProjectData, ProjectInfo } from "@/types/project";
import * as XLSX from 'xlsx';
import { CollectionInfo } from "@/types/collection";
import SmartDataTable from "@/components/project/SmartDataTable";

interface ColumnConfig {
    header: string;
    key?: string;
    width?: string;
    render?: (item: any) => React.ReactNode;
}

interface UploadComponentProps {
    workstationItems: ProjectData[];
    setWorkstationItems: React.Dispatch<React.SetStateAction<ProjectData[]>>;
    onAdd: (correctItems: any[], counterItems: any[], sourceInfo?: DataSourceInfo) => void;
}

export default function UploadComponent({ workstationItems, setWorkstationItems, onAdd }: UploadComponentProps) {
    const [uploading, setUploading] = useState(false);
    const [file, setFile] = useState<File | null>(null);

    const handleFileUpload = useCallback(async (uploadedFile: File) => {
        setUploading(true);
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const workbook = XLSX.read(e.target?.result, { type: 'array' });
                const rawJson: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

                const extracted: ProjectData[] = rawJson.map((row, index) => {
                    const appNumStr = String(row.application_number || row.출원번호 || "").trim();
                    const appNum = appNumStr ? Number(appNumStr) : undefined;

                    return {
                        id: `up_${Date.now()}_${index}`,
                        application_number: isNaN(appNum as number) ? undefined : appNum,
                        title: row.title || row.제목 || '',
                        abstract: row.abstract || row.요약 || '',
                        collection_name: row.label || row.Label || row.레이블 || "Unlabeled",
                        used: 1,
                        data_status: 'NEW',
                    }

                }).filter(item => item.title);

                if (extracted.length > 0) {
                    // 🎯 [핵심] 파싱 끝나자마자 부모의 handleAddDataFromSource 호출!
                    onAdd(extracted, [], {
                        name: uploadedFile.name,
                        count: extracted.length,
                        type: 'upload',
                        sourceId: uploadedFile.name
                    });
                } else {
                    alert("추출된 데이터가 없습니다.");
                }
            } catch (err) {
                console.log(err)
                alert("파일 읽기 오류");
            } finally {
                setUploading(false);
            }
        };
        reader.readAsArrayBuffer(uploadedFile);
    }, [onAdd]);

    return (
        <div className="space-y-4">
            <div
                // className={`border-4 border-dashed rounded-[3rem] p-12 text-center transition-all ${workstationItems.length > 0 ? 'border-blue-200 bg-blue-50/10 py-8' : 'border-zinc-100 bg-zinc-50 hover:border-blue-400 cursor-pointer'}`}
                className={`border-4 border-dashed rounded-[3rem] p-12 text-center transition-all border-zinc-100 bg-zinc-50 hover:border-blue-400 hover:bg-blue-50/30 cursor-pointer group`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); handleFileUpload(e.dataTransfer.files[0]); }}
                onClick={() => document.getElementById('file-input')?.click()}
            >
                {/* <input id="file-input" type="file" accept=".xlsx,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])} /> */}
                <input
                    id="file-input"
                    type="file"
                    accept=".xlsx,.csv"
                    className="hidden"
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                            handleFileUpload(file);
                            e.target.value = '';
                        }
                    }}
                />

                {uploading ? (
                    <div className="flex flex-col items-center animate-in fade-in">
                        <Loader2 className="animate-spin text-blue-600 mb-4" size={48} />
                        <p className="font-black text-zinc-900 uppercase tracking-widest">Importing Data...</p>
                    </div>
                ) :
                    workstationItems.length === 0 ? (
                        <div className="space-y-4">
                            <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mx-auto shadow-xl text-zinc-300 group-hover:text-blue-600 group-hover:scale-110 transition-all">
                                <Upload size={40} />
                            </div>
                            <div>
                                <p className="text-xl font-black text-zinc-900 uppercase tracking-tighter">Drop Excel File to Start</p>
                                <p className="text-sm text-zinc-400 font-bold mt-1">파일을 놓으면 즉시 검토 바구니에 담깁니다.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between px-6">
                            <div className="flex items-center gap-4 text-left">
                                <FileText className="text-blue-600" />
                                <div><p className="font-black text-zinc-900">{file?.name}</p><p className="text-xs text-zinc-400">{workstationItems.length} records</p></div>
                            </div>
                            <button onClick={() => { setWorkstationItems([]); setFile(null); }}><XCircle className="text-zinc-300 hover:text-red-500" /></button>
                        </div>

                    )}
            </div>
        </div>
    );
}