// File: pages/project/new/upload.tsx
import Head from "next/head";
import { useState } from "react";
import { UploadCloud, ChevronRight, CheckCircle2 } from "lucide-react";

type Step = 1 | 2 | 3 | 4 | 5;
type Project = { id: number; name: string; description?: string; task_type: string };

export default function NewProjectUploadPage() {
  const [step, setStep] = useState<Step>(1);
  const [creating, setCreating] = useState(false);
  const [project, setProject] = useState<Project | null>(null);

  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [taskType, setTaskType] = useState("classification");

//   const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";
  const API_BASE = "http://192.168.1.20:8000"

  async function createProject() {
    if (!name.trim()) {
      alert("프로젝트 이름을 입력하세요.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch(`${API_BASE}/api/project`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_name: name,
          project_description: desc,
          source_type: "upload",
          task_type: taskType,
        }),
      });
      if (!res.ok) throw new Error("create failed");
      const data = await res.json();
      setProject(data);
      setStep(2);
    } catch (e: any) {
      alert("프로젝트 생성 실패: " + e.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <Head>
        <title>파일 업로드로 새 프로젝트 | IPFORCE</title>
        <meta name="robots" content="noindex" />
      </Head>

      <main className="min-h-[calc(100vh-64px)] w-full px-4 py-6">
        <div className="mx-auto w-full max-w-5xl">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-zinc-900">프로젝트 생성</h1>
          <p className="mt-2 text-sm md:text-base text-zinc-500">파일 업로드 기반으로 프로젝트를 만듭니다.</p>

          <Stepper step={step} />

          <div className="mt-6">
            {step === 1 && (
              <Step1Basic
                name={name}
                setName={setName}
                desc={desc}
                setDesc={setDesc}
                taskType={taskType}
                setTaskType={setTaskType}
                onNext={createProject}
                loading={creating}
              />
            )}

            {/* {step === 2 && project && (
              <Step2Upload project={project} apiBase={API_BASE} onNext={() => setStep(3)} />
            )}

            {step === 3 && project && (
              <Step3Preview project={project} apiBase={API_BASE} onNext={() => setStep(4)} />
            )}

            {step === 4 && project && (
              <Step4Labels project={project} apiBase={API_BASE} onNext={() => setStep(5)} />
            )}

            {step === 5 && project && <Step5Train project={project} apiBase={API_BASE} />} */}
          </div>
        </div>
      </main>
    </>
  );
}

/* ---------- UI bits ---------- */

function Stepper({ step }: { step: Step }) {
  const items = ["기본정보", "데이터 업로드", "미리보기", "라벨/클래스", "학습 설정"];
  return (
    <ol className="mt-6 flex flex-wrap items-center gap-3 text-sm">
      {items.map((t, i) => {
        const idx = (i + 1) as Step;
        const active = idx === step;
        const passed = idx < step;
        return (
          <li key={t} className="flex items-center gap-3">
            <div
              className={[
                "flex h-8 w-8 items-center justify-center rounded-full ring-1",
                passed
                  ? "bg-green-50 ring-green-300 text-green-700"
                  : active
                  ? "bg-blue-600 ring-blue-600 text-white"
                  : "bg-white ring-zinc-300 text-zinc-500",
              ].join(" ")}
            >
              {passed ? <CheckCircle2 className="h-5 w-5" /> : idx}
            </div>
            <span className={active ? "font-medium text-zinc-900" : "text-zinc-500"}>{t}</span>
            {i < items.length - 1 && <ChevronRight className="h-4 w-4 text-zinc-300" />}
          </li>
        );
      })}
    </ol>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-zinc-700">{label}</label>
      {children}
    </div>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm
                 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  );
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm
                 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm
                 focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  );
}

function Button({
  children,
  variant = "primary",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "outline" }) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm transition-all focus:outline-none focus:ring-2";
  const styles =
    variant === "primary"
      ? "bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 focus:ring-blue-500"
      : "border border-zinc-300 text-zinc-700 hover:bg-zinc-50 focus:ring-zinc-400";
  return (
    <button {...rest} className={[base, styles, rest.className || ""].join(" ")}>
      {children}
    </button>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">{children}</div>;
}

/* ---------- Steps ---------- */

function Step1Basic(props: {
  name: string;
  setName: (v: string) => void;
  desc: string;
  setDesc: (v: string) => void;
  taskType: string;
  setTaskType: (v: string) => void;
  onNext: () => void;
  loading: boolean;
}) {
  return (
    <Card>
      <div className="grid gap-4">
        <Field label="프로젝트 이름">
          <TextInput
            value={props.name}
            onChange={(e) => props.setName(e.target.value)}
            placeholder="예) 반도체 공정 분류기"
          />
        </Field>
        <Field label="설명">
          <TextArea
            rows={4}
            value={props.desc}
            onChange={(e) => props.setDesc(e.target.value)}
            placeholder="간단한 설명을 적어주세요."
          />
        </Field>
        <Field label="Task">
          <Select value={props.taskType} onChange={(e) => props.setTaskType(e.target.value)}>
            <option value="classification">단일 분류</option>
            <option value="multilabel">멀티라벨 분류</option>
            <option value="regression">회귀</option>
          </Select>
        </Field>

        <div className="mt-2 flex items-center justify-end">
          <Button onClick={props.onNext} disabled={props.loading}>
            {props.loading ? "생성 중..." : "다음"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function Step2Upload({ project, apiBase, onNext }: { project: Project; apiBase: string; onNext: () => void }) {
  const [uploading, setUploading] = useState(false);

  async function uploadFile(f: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("f", f);
      const res = await fetch(`${apiBase}/api/project/${project.id}/source/upload`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) throw new Error("upload failed");
      onNext();
    } catch (e: any) {
      alert(e.message || "upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card>
      <Field label="파일 선택 (.xlsx / .csv)">
        <input
          className="block w-full cursor-pointer rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm
                     file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm hover:file:bg-zinc-200"
          type="file"
          accept=".xlsx,.csv"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) uploadFile(f);
          }}
        />
      </Field>
      {uploading && <div className="text-sm text-zinc-500 mt-2">업로드/매칭 중...</div>}
    </Card>
  );
}

/* Step3Preview, Step4Labels, Step5Train 은 search.tsx 코드 재사용 */
