"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { UploadCloud, FileSpreadsheet, Save, Loader2, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import * as XLSX from "xlsx";
import { useSession } from "next-auth/react";
import { Session } from "next-auth";

type Project = {
  id: number;
  project_code: string;
  project_name: string;
  project_description?: string;
  source_type: string;
  task_type: string;
  created_datetime?: string;
};

const taskMapper: Record<string, string> = {
  classification: "특허 분류",
  "multi-label": "다중 분류",
  regression: "회귀",
  etc: "기타",
};

function ProjectUploadPage() {
  const router = useRouter();
  const { project_id } = router.query;
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "https://ipforce.co.kr";

  const { data: session, status } = useSession() as {
    data: (Session & { access_token?: string }) | null;
    status: "loading" | "authenticated" | "unauthenticated";
  };
  const token = session?.access_token;

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [hasEdited, setHasEdited] = useState(false);


  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;
  const totalPages = Math.ceil(rows.length / rowsPerPage);
  const currentRows = rows.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  // 프로젝트 정보 불러오기
  useEffect(() => {
    if (!project_id) return;
    async function loadProject() {
      try {
        const res = await fetch(`${API_BASE}/api/project/${project_id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
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
    setUploading(true);
    setOriginalFile(f); // 원본 파일 저장

    const reader = new FileReader();
    reader.onload = (e) => {
      try {

        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);
        setRows(jsonData as any[]);
        setCurrentPage(1);
        setHasEdited(false); // 새 파일 올리면 수정 상태 리셋

      } catch (e) {
        alert("파일을 읽는 중 오류가 발생했습니다.");
      } finally {
        setUploading(false);
      }
    };
    reader.readAsArrayBuffer(f);
    setUploading(false);
  }

  // 개별 셀 수정
  function updateCell(index: number, key: string, value: string) {
    setHasEdited(true); // 수정 플래그 활성화
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, [key]: value } : r))
    );
  }

  // 행 삭제
  function handleDelete(index: number) {
    const globalIndex = (currentPage - 1) * rowsPerPage + index;
    setRows((prev) => prev.filter((_, i) => i !== globalIndex));
  }

  // 백엔드로 전송
  async function handleSave() {
    if (!originalFile) {
      alert("파일이 없습니다.");
      return;
    }
    setSaving(true);
    try {
      const formData = new FormData();

      if (hasEdited) {
        // ✅ 수정된 경우: rows → 새 엑셀 파일 생성
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

        const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
        const blob = new Blob([wbout], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const newFile = new File([blob], "edited_" + originalFile.name, {
          type: blob.type,
        });
        formData.append("file", newFile);
      } else {
        // ✅ 수정이 없는 경우: 원본 파일 그대로 전송
        formData.append("file", originalFile);
      }

      // ✅ 공통 메타데이터
      const projectInfo = {
        source_type: project?.source_type || "search",
        project_code: project?.project_code || "",
        project_name: project?.project_name || "",
        project_desc: project?.project_description || "",
        // application_numbers: cart.map((r) => r.application_number),
        // title: cart.map((r) => r.title),
        // abstract: cart.map((r) => r.abstract),
        // collection_name: cart.map((r) => r.collection_name),
      };
      formData.append("project_id", String(project_id));
      formData.append("user_email", String(session?.user?.email || ""));
      // formData.append("source_type", "upload");
      formData.append("project_info", JSON.stringify(projectInfo));

      // console.log("*:", Array.from(formData.entries()));

      const res = await fetch(`${API_BASE}/api/project/${project_id}/source/upload`, {
        method: "POST",
        headers: {
          // "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        // body: JSON.stringify({ items: rows }),
        body: formData,
      });

      if (!res.ok) throw new Error("저장 실패");
      alert(hasEdited ? "✅ 수정 후 저장 완료!" : "✅ 원본 파일 저장 완료!");
      setHasEdited(false);
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
              disabled={uploading}
            />

            {/* 업로드 로딩 표시 */}
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
                셀을 클릭하여 직접 수정할 수 있습니다.
              </p>
            </div>

            <div className="p-6 bg-white overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-blue-50 text-blue-800">
                  <tr>

                    <th className="px-3 py-2 text-left font-semibold w-[60px]">#</th>
                    {Object.keys(rows[0]).map((key) => (
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

                      {/* ✅ 번호 컬럼 */}
                      <td className="px-3 py-1 text-zinc-500 text-center">
                        {(currentPage - 1) * rowsPerPage + i + 1}
                      </td>

                      {/* ✅ 데이터 셀 */}
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

                      {/* ✅ 삭제 버튼 */}
                      <td className="px-3 py-1 text-center">
                        <button
                          onClick={() => handleDelete(i)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="w-4 h-4 inline" />
                        </button>
                      </td>

                    </tr>
                  ))}
                </tbody>
              </table>

              {/* 페이지네이션 */}
              <div className="flex justify-between items-center mt-4 text-sm text-zinc-700">
                <div>
                  총 {rows.length}건 중 {(currentPage - 1) * rowsPerPage + 1}–
                  {Math.min(currentPage * rowsPerPage, rows.length)} 표시
                </div>
                <div className="flex items-center gap-2">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="p-2 rounded-md border border-zinc-200 hover:bg-zinc-100 disabled:opacity-50"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span>
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="p-2 rounded-md border border-zinc-200 hover:bg-zinc-100 disabled:opacity-50"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
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
    </div >
  );
}

export default dynamic(() => Promise.resolve(ProjectUploadPage), { ssr: false });
