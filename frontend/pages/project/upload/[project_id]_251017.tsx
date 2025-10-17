/* File: /home/yckim/development/ipforce_next/frontend/pages/project/new/upload/[project_id].tsx */
import { useRouter } from "next/router";
import Head from "next/head";
import { useEffect, useState } from "react";

type Project = {
  id: number;
  project_name: string;
  project_description?: string;
  source_type: string;
  task_type: string;
  created_datetime?: string;
};

const taskMapper: Record<string, string> = {
  classification: "이진분류",
  "multi-label": "다중분류",
  regression: "회귀",
  etc: "기타",
};

export default function ProjectUploadPage() {
  const router = useRouter();
  const { project_id } = router.query;

//   const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";
  const API_BASE = "http://192.168.1.20:8000"

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<any[]>([]);

  // 프로젝트 정보 불러오기
  useEffect(() => {
    if (!project_id) return;
    async function loadProject() {
      try {
        const res = await fetch(`${API_BASE}/api/project/${project_id}`);
        const data = await res.json();
        setProject(data);
      } catch (e) {
        alert("프로젝트 정보를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    }
    loadProject();
  }, [project_id]);

  // 파일 업로드
  async function uploadFile(f: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("f", f);
      const res = await fetch(`${API_BASE}/api/project/${project_id}/source/upload`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) throw new Error("업로드 실패");
      const data = await res.json();
      setResults(data.items || []);
    } catch (e: any) {
      alert(e.message || "업로드 실패");
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-blue-600"></div>
        <span className="ml-2 text-sm text-zinc-500">불러오는 중...</span>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>프로젝트 #{project_id} | 파일 업로드 | IPFORCE</title>
        <meta name="robots" content="noindex" />
      </Head>

      <main className="min-h-[calc(100vh-64px)] w-full px-4 py-6">
        <div className="mx-auto max-w-5xl space-y-6">
          {/* 프로젝트 정보 */}
          {project && (
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <h1 className="text-xl font-semibold text-zinc-900">
                {project.project_name}
              </h1>
              <p className="mt-1 text-sm text-zinc-600">
                {project.project_description || "-"}
              </p>
              <div className="mt-2 text-xs text-zinc-500">
                과제: {taskMapper[project.task_type] ?? project.task_type} · 생성일:{" "}
                {project.created_datetime
                  ? new Date(project.created_datetime).toLocaleString()
                  : "-"}
              </div>
            </div>
          )}

          {/* 파일 업로드 영역 */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-medium text-zinc-900">
              특허 파일 업로드
            </h2>
            <input
              className="block w-full cursor-pointer rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm hover:file:bg-zinc-200"
              type="file"
              accept=".xlsx,.csv"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadFile(f);
              }}
            />
            {uploading && (
              <p className="mt-2 text-sm text-zinc-500">업로드/매칭 중...</p>
            )}
          </div>

          {/* 업로드 결과 미리보기 */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-lg font-medium text-zinc-900">
              업로드 결과 미리보기
            </h2>
            <div className="overflow-hidden rounded-2xl border border-zinc-200">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-zinc-50 text-zinc-600">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">#</th>
                    <th className="px-3 py-2 text-left font-medium">application_number</th>
                    <th className="px-3 py-2 text-left font-medium">label</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => (
                    <tr key={r.id || i} className="border-t border-zinc-200 hover:bg-zinc-50">
                      <td className="px-3 py-2">{i + 1}</td>
                      <td className="px-3 py-2 font-mono text-[13px]">
                        {r.application_number_norm || r.application_number}
                      </td>
                      <td className="px-3 py-2">{r.label || "-"}</td>
                    </tr>
                  ))}
                  {results.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-3 py-8 text-center text-zinc-500">
                        업로드된 데이터가 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
