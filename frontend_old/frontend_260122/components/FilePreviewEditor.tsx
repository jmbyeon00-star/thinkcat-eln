import { useState } from "react";
import * as XLSX from "xlsx";
import {
  ChevronUp,
  ChevronDown,
  FileBarChart2,
  X,
  Plus
} from "lucide-react";

type FilePreviewEditorProps = {
  onDataParsed: (data: any[]) => void;
};

export default function FilePreviewEditor({ onDataParsed }: FilePreviewEditorProps) {
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [showTable, setShowTable] = useState(true);
  const [editingCell, setEditingCell] = useState<{ rowIdx: number; colKey: string } | null>(null);
  const [editValue, setEditValue] = useState("");

  const totalPages = Math.ceil(rows.length / itemsPerPage);
  const pagedRows = rows.slice((page - 1) * itemsPerPage, page * itemsPerPage);

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
        const jsonData = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: "" }) as any[][];
        let h: string[] = [];
        let dataRows: any[] = [];

        if (jsonData.length > 0) {
          const firstRow = jsonData[0] as any[];
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

  const handleCellEdit = (rowIdx: number, colKey: string, currentValue: any) => {
    setEditingCell({ rowIdx, colKey });
    setEditValue(String(currentValue));
  };

  const handleCellSave = () => {
    if (!editingCell) return;

    const globalIdx = (page - 1) * itemsPerPage + editingCell.rowIdx;
    const updatedRows = rows.map((row, i) =>
      i === globalIdx ? { ...row, [editingCell.colKey]: editValue } : row
    );

    setRows(updatedRows);
    onDataParsed(updatedRows);
    setEditingCell(null);
    setEditValue("");
  };

  const handleCellCancel = () => {
    setEditingCell(null);
    setEditValue("");
  };

  const handleRowDelete = (rowIdx: number) => {
    const globalIdx = (page - 1) * itemsPerPage + rowIdx;
    const updatedRows = rows.filter((_, idx) => idx !== globalIdx);
    setRows(updatedRows);
    onDataParsed(updatedRows);

    // 마지막 페이지에서 마지막 항목 삭제 시 이전 페이지로
    if (updatedRows.length > 0 && globalIdx === rows.length - 1) {
      const newTotalPages = Math.ceil(updatedRows.length / itemsPerPage);
      if (page > newTotalPages) {
        setPage(newTotalPages);
      }
    }
  };

  const handleRowAdd = () => {
    if (headers.length === 0) return;

    const newRow: Record<string, any> = {};
    headers.forEach(key => {
      newRow[key] = "";
    });

    const updatedRows = [...rows, newRow];
    setRows(updatedRows);
    onDataParsed(updatedRows);

    // 마지막 페이지로 이동
    const newTotalPages = Math.ceil(updatedRows.length / itemsPerPage);
    setPage(newTotalPages);
  };

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
        <div
          className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden"
        >
          <div
            className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 cursor-pointer"
            onClick={() => setShowTable((prev) => !prev)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {showTable ? (
                  <ChevronUp className="h-5 w-5 text-white" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-white" />
                )}
                <FileBarChart2 className="h-6 w-6 text-white" />
                <h2 className="text-xl font-bold text-white">업로드된 데이터</h2>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-white text-sm">
                  {rows.length}건
                </span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setPage(1);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="px-3 py-1 rounded-lg text-sm bg-white/20 text-white border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50"
                >
                  <option value="10" className="text-black">10개씩</option>
                  <option value="20" className="text-black">20개씩</option>
                  <option value="50" className="text-black">50개씩</option>
                  <option value="100" className="text-black">100개씩</option>
                </select>
              </div>
            </div>
          </div>

          {showTable && (
            <>
              {/* 편집 도구 */}
              <div className="px-6 py-4 bg-zinc-50 border-b border-zinc-200">
                <button
                  onClick={handleRowAdd}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  행 추가
                </button>
              </div>

              {/* 테이블 */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50 text-zinc-600 border-b border-zinc-200">
                    <tr>
                      <th className="px-6 py-3 text-left font-semibold w-12">#</th>
                      {headers.map((header) => (
                        <th
                          key={header}
                          className="px-6 py-3 text-left font-semibold"
                        >
                          {header}
                        </th>
                      ))}
                      <th className="px-6 py-3 text-center font-semibold w-24">작업</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedRows.map((row, idx) => {
                      const globalIndex = (page - 1) * itemsPerPage + idx + 1;

                      return (
                        <tr
                          key={idx}
                          className="border-b border-zinc-100 hover:bg-blue-50/40 transition-colors"
                        >
                          <td className="px-6 py-3 text-zinc-500 font-medium">
                            {globalIndex}
                          </td>
                          {headers.map((header) => (
                            <td key={header} className="px-6 py-3 text-zinc-700">
                              {editingCell?.rowIdx === idx && editingCell?.colKey === header ? (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleCellSave();
                                      if (e.key === 'Escape') handleCellCancel();
                                    }}
                                    className="px-2 py-1 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
                                    autoFocus
                                  />
                                  <button
                                    onClick={handleCellSave}
                                    className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs whitespace-nowrap"
                                  >
                                    저장
                                  </button>
                                  <button
                                    onClick={handleCellCancel}
                                    className="px-2 py-1 bg-zinc-400 text-white rounded hover:bg-zinc-500 text-xs whitespace-nowrap"
                                  >
                                    취소
                                  </button>
                                </div>
                              ) : (
                                <div
                                  onClick={() => handleCellEdit(idx, header, row[header])}
                                  className="cursor-pointer hover:bg-blue-100 px-2 py-1 rounded min-h-[28px]"
                                  title="클릭하여 편집"
                                >
                                  {String(row[header]) || <span className="text-zinc-400 italic">비어있음</span>}
                                </div>
                              )}
                            </td>
                          ))}
                          <td className="px-6 py-3 text-center">
                            <button
                              onClick={() => {
                                if (confirm('이 행을 삭제하시겠습니까?')) {
                                  handleRowDelete(idx);
                                }
                              }}
                              className="p-1.5 rounded-md hover:bg-red-100 text-red-600 transition-colors"
                              title="행 삭제"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* 페이지네이션 */}
              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-zinc-200 bg-zinc-50">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-zinc-600">
                      {(page - 1) * itemsPerPage + 1} - {Math.min(page * itemsPerPage, rows.length)} / {rows.length}건
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPage(1)}
                        disabled={page === 1}
                        className="px-3 py-2 border-2 border-zinc-300 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-100 transition-all text-sm font-medium"
                      >
                        ««
                      </button>
                      <button
                        onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                        disabled={page === 1}
                        className="px-3 py-2 border-2 border-zinc-300 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-100 transition-all text-sm font-medium"
                      >
                        이전
                      </button>

                      {/* 페이지 번호 버튼 */}
                      {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                        let pageNum: number;

                        if (totalPages <= 7) {
                          pageNum = i + 1;
                        } else if (page <= 4) {
                          pageNum = i + 1;
                        } else if (page >= totalPages - 3) {
                          pageNum = totalPages - 6 + i;
                        } else {
                          pageNum = page - 3 + i;
                        }

                        return (
                          <button
                            key={pageNum}
                            onClick={() => setPage(pageNum)}
                            className={`px-3 py-2 border-2 rounded-lg transition-all text-sm font-medium ${page === pageNum
                              ? "bg-blue-600 text-white border-blue-600"
                              : "border-zinc-300 hover:bg-zinc-100"
                              }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}

                      <button
                        onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                        disabled={page === totalPages}
                        className="px-3 py-2 border-2 border-zinc-300 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-100 transition-all text-sm font-medium"
                      >
                        다음
                      </button>
                      <button
                        onClick={() => setPage(totalPages)}
                        disabled={page === totalPages}
                        className="px-3 py-2 border-2 border-zinc-300 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-100 transition-all text-sm font-medium"
                      >
                        »»
                      </button>
                    </div>

                    <div className="text-sm text-zinc-600">
                      페이지 {page} / {totalPages}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}