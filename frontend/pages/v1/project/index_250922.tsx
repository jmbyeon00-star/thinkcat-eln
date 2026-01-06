/* File: /home/yckim/development/ipforce_next/frontend/pages/project/index.tsx */
"use client"; 

import Head from "next/head";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Database, UploadCloud } from "lucide-react";

type Project = {
  id: number;
  project_name: string;
  project_description?: string;
  source_type: "search" | "upload";
  task_type: string;
  created_datetime?: string;
};

const taskMapper: Record<string, string> = {
  classification: "이진분류",
  "multi-label": "다중분류",
  regression: "회귀",
  etc: "기타",
};

export default function ProjectListPage() {
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProjects() {
      try {
        const res = await fetch(`${API_BASE}/api/project`);
        const data = await res.json();
        setProjects(data.items || data); // 백엔드 응답 형식에 따라 items or 그냥 배열
      } catch (e) {
        alert("프로젝트 목록을 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    }
    loadProjects();
  }, []);

  return (
    <>
      <Head>
        <title>프로젝트 관리 | IPFORCE</title>
        <meta name="robots" content="noindex" />
      </Head>

      <main className="min-h-[calc(100vh-64px)] w-full px-4 py-6">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-zinc-900">
            프로젝트 관리
          </h1>
          <p className="mt-2 text-sm md:text-base text-zinc-500">
            등록된 프로젝트 목록입니다.
          </p>

          {loading ? (
            <div className="flex min-h-[200px] items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-blue-600"></div>
              <span className="ml-2 text-sm text-zinc-500">불러오는 중...</span>
            </div>
          ) : projects.length === 0 ? (
            <p className="mt-6 text-sm text-zinc-500">아직 등록된 프로젝트가 없습니다.</p>
          ) : (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {projects.map((p) => (
                <Link
                  key={p.id}
                  href={`/project/${p.source_type}/${p.id}`}
                  className="block rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm hover:shadow-md transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-zinc-50 p-3 ring-1 ring-zinc-200">
                      {p.source_type === "search" ? (
                        <Database className="h-6 w-6 text-zinc-700" />
                      ) : (
                        <UploadCloud className="h-6 w-6 text-zinc-700" />
                      )}
                    </div>
                    <div>
                      <h2 className="text-lg font-medium text-zinc-900">
                        {p.project_name}
                      </h2>
                      <p className="mt-1 text-sm text-zinc-500">
                        {p.project_description || "설명 없음"}
                      </p>
                      <p className="mt-1 text-xs text-zinc-400">
                        {taskMapper[p.task_type] ?? p.task_type} ·{" "}
                        {p.created_datetime
                          ? new Date(p.created_datetime).toLocaleDateString()
                          : "-"}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
