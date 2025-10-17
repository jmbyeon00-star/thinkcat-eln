"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { UploadCloud, FileSpreadsheet, Save, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";

type Project = {
  id: number;
  project_name: string;
  project_description?: string;
  source_type: string;
  task_type: string;
  created_datetime?: string;
};

const taskMapper: Record<string, string> = {
  classification: "단일 분류",
  "multi-label": "다중 분류",
  regression: "회귀",
  etc: "기타",
};

function ProjectUploadPage() {
  const router = useRouter();
  const { project_id } = router.query;
  const API_BASE = "http://192.168.1.20:8000";

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  // 프로젝트 정보 불러오기
  useEffect(() => {
    if (!project_id) return;
    async function loadProject() {
      try {
        const res = await fetch(`${API_BASE}/api/project/${project_id}`);
        const data = await res.json();
        setProject(data);
      } catch {
        alert("프로젝트 정보를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    }
    loadProject();
  }, [project_id]);

  // 파일 읽기 (프론트 메모리)
  async function handleFileUpload(f: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(firstSheet);
      setRows(jsonData as any[]);
    };
    reader.readAsArrayBuffer(f);
  }

  // 개별 셀 수정
  function updateCell(index: number, key: string, value: string) {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, [key]: value } : r))
    );
  }

  // 백엔드로 전송
  async function handleSave() {
    if (rows.length === 0) {
      alert("업로드된 데이터가 없습니다.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/project/${project_id}/source/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: rows }),
      });
      if (!res.ok) throw new Error("저장 실패");
      alert("✅ 저장 완료!");
    } catch (e: any) {
      alert(e.message || "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-zinc-500">
        <Loader2 className="h-5 w-5 animate-spin mr-2 text-blue-800" />
        불러오는 중...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-5xl mx-auto p-8 space-y-8">
        {/* Header Section */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-1 h-8 bg-gradient-to-b from-blue-700 to-blue-900 rounded-full" />
            <h1 className="text-3xl font-bold text-zinc-900">파일 업로드</h1>
          </div>
          <p className="text-zinc-600 ml-4">
            업로드 후 데이터를 검토 및 수정한 뒤 저장할 수 있습니다.
          </p>
        </div>

        {/* Project Info */}
        {project && (
          <div className="rounded-2xl overflow-hidden border border-zinc-100 shadow-lg">
            <div className="bg-gradient-to-r from-blue-700 to-blue-900 px-8 py-6">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="w-6 h-6 text-white" />
                <h2 className="text-xl font-semibold text-white">프로젝트 정보</h2>
              </div>
              <p className="text-blue-100 text-sm mt-2">
                {project.project_name} / {taskMapper[project.task_type]}
              </p>
            </div>
            <div className="p-6 bg-white text-sm text-zinc-600">
              {project.project_description || "-"}
            </div>
          </div>
        )}

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
              accept=".xlsx,.csv"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileUpload(f);
              }}
            />
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
                셀을 클릭하여 직접 수정할 수 있습니다.
              </p>
            </div>

            <div className="p-6 bg-white overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-blue-50 text-blue-800">
                  <tr>
                    {Object.keys(rows[0]).map((key) => (
                      <th key={key} className="px-3 py-2 text-left font-semibold">
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr
                      key={i}
                      className="border-t border-zinc-200 hover:bg-blue-50 transition-colors"
                    >
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Save Button */}
            <div className="flex justify-end p-6 bg-zinc-50 border-t">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2 bg-blue-700 hover:bg-blue-800 text-white font-medium rounded-lg shadow-md disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    저장 중...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    저장하기
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default dynamic(() => Promise.resolve(ProjectUploadPage), { ssr: false });
