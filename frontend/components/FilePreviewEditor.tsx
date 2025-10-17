"use client";

import { useState } from "react";
import * as XLSX from "xlsx";

type FilePreviewEditorProps = {
  onDataParsed: (data: any[]) => void;
  rowsPerPage?: number; // 페이지당 행 수 (기본 10)
};

export default function FilePreviewEditor({ onDataParsed, rowsPerPage = 10 }: FilePreviewEditorProps) {
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [page, setPage] = useState(1);

  const totalPages = Math.ceil(rows.length / rowsPerPage);
  const pagedRows = rows.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  const generateDefaultHeaders = (length: number) =>
    Array.from({ length }, (_, i) => `Column ${i + 1}`);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPage(1);

    const reader = new FileReader();
    reader.onload = (event) => {
      if (!event.target?.result) return;

      // XLSX 처리
      if (f.name.endsWith(".xlsx") || f.name.endsWith(".xls")) {
        const data = new Uint8Array(event.target.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: "" }) as any[][]; // ✅ 추가
        let h: string[] = [];
        let dataRows: any[] = [];
      
        if (jsonData.length > 0) {
          const firstRow = jsonData[0] as any[]; // ✅ 캐스팅
          const hasHeader = firstRow.some((cell: any) => isNaN(Number(cell)) && cell !== "");
          
          if (hasHeader) {
            h = firstRow.map((v: any, i: number) => v || `Column ${i + 1}`);
            dataRows = jsonData.slice(1).map((r: any[]) =>
              Object.fromEntries(h.map((key, i) => [key, r[i] ?? ""]))
            );
          } else {
            h = generateDefaultHeaders(firstRow.length);
            dataRows = jsonData.map((r: any[]) =>
              Object.fromEntries(h.map((key, i) => [key, r[i] ?? ""]))
            );
          }
        }

        setHeaders(h);
        setRows(dataRows);
        onDataParsed(dataRows);
      }

      // CSV 처리
      else if (f.name.endsWith(".csv")) {
        const text = event.target.result as string;
        const lines = text.trim().split("\n").map((l) => l.split(","));
        let h: string[] = [];
        let data: any[] = [];

        if (lines.length > 0) {
          const firstRow = lines[0];
          const hasHeader = firstRow.some((cell) => isNaN(Number(cell)) && cell !== "");

          if (hasHeader) {
            h = firstRow.map((v, i) => v || `Column ${i + 1}`);
            data = lines.slice(1).map((r) =>
              Object.fromEntries(h.map((key, i) => [key, r[i] ?? ""]))
            );
          } else {
            h = generateDefaultHeaders(firstRow.length);
            data = lines.map((r) =>
              Object.fromEntries(h.map((key, i) => [key, r[i] ?? ""]))
            );
          }
        }

        setHeaders(h);
        setRows(data);
        onDataParsed(data);
      }

      // JSON 처리
      else if (f.name.endsWith(".json")) {
        try {
          const text = event.target.result as string;
          const jsonData = JSON.parse(text);
          const arr = Array.isArray(jsonData) ? jsonData : [jsonData];
          const h = Object.keys(arr[0] || {});
          setHeaders(h);
          setRows(arr);
          onDataParsed(arr);
        } catch {
          setHeaders([]);
          setRows([]);
        }
      } else {
        alert("지원하지 않는 파일 형식입니다. (csv, json, xlsx만 가능)");
      }
    };

    if (f.name.endsWith(".xlsx") || f.name.endsWith(".xls")) {
      reader.readAsArrayBuffer(f);
    } else {
      reader.readAsText(f);
    }
  };

  const handleCellEdit = (rowIndex: number, key: string, value: string) => {
    setRows((prev) =>
      prev.map((row, i) => (i === rowIndex ? { ...row, [key]: value } : row))
    );
    const updated = rows.map((row, i) => (i === rowIndex ? { ...row, [key]: value } : row));
    onDataParsed(updated);
  };

  const handlePrev = () => setPage((p) => Math.max(1, p - 1));
  const handleNext = () => setPage((p) => Math.min(totalPages, p + 1));

  return (
    <div className="space-y-3">
      <input
        type="file"
        accept=".csv,.json,.xlsx,.xls"
        onChange={handleFileChange}
        className="block w-full text-sm text-zinc-600 file:mr-3 file:py-2 file:px-4 
                   file:rounded-md file:border-0 file:text-sm file:font-semibold 
                   file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
      />

      {rows.length > 0 && (
        <div className="overflow-x-auto border rounded-lg bg-zinc-50 p-2">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-zinc-100 text-zinc-700">
                {headers.map((header) => (
                  <th key={header} className="px-3 py-2 border text-left">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pagedRows.map((row, rowIndex) => (
                <tr key={rowIndex} className="hover:bg-zinc-100">
                  {headers.map((header) => (
                    <td
                      key={header}
                      className="px-3 py-2 border cursor-pointer"
                      contentEditable
                      suppressContentEditableWarning
                      onBlur={(e) =>
                        handleCellEdit(
                          (page - 1) * rowsPerPage + rowIndex,
                          header,
                          e.currentTarget.textContent || ""
                        )
                      }
                    >
                      {row[header]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          {/* 페이지네이션 컨트롤 */}
          <div className="flex items-center justify-between mt-2 text-sm text-zinc-600">
            <span>
              페이지 {page} / {totalPages} ({rows.length}개 항목)
            </span>
            <div className="flex gap-2">
              <button
                onClick={handlePrev}
                disabled={page === 1}
                className="px-2 py-1 border rounded disabled:opacity-50 hover:bg-zinc-100"
              >
                이전
              </button>
              <button
                onClick={handleNext}
                disabled={page === totalPages}
                className="px-2 py-1 border rounded disabled:opacity-50 hover:bg-zinc-100"
              >
                다음
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
