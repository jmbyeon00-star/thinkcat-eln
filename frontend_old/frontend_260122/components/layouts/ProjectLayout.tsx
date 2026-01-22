// components/layouts/ProjectLayout.tsx
import Link from "next/link";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { Calendar, Plus, Pencil, Check, X } from "lucide-react";
import { useState, useEffect } from "react";
import { setDatetimeToDate, authHeader } from "@/utils/common";
import { api } from "@/lib/apiClient";

// Layout이 내부에서 불러올 핵심 데이터 타입 정의
interface InternalProjectDetail {
  project_name?: string;
  project_description?: string;
  task_type?: string;
  source_type?: string;
  collection_num?: number;
  created_datetime: string;
  updated_datetime: string;
}

// 1. Props 인터페이스 정의 (TypeScript에서 타입 검사를 위해 필요)
interface ProjectLayoutProps {
  projectNo?: string | number;
  projectName?: string;
  projectDesc?: string;

  taskType?: string;
  sourceType?: string;
  collectionNum?: number;

  CreatedDatetime?: string;
  UpdatedDatetime?: string;
  onFunction?: () => void;
  isLoading?: boolean; // ✅ isLoading prop 추가
  // 🔑 내부 Fetching을 위한 필수 props 추가
  token?: string;
  API_BASE?: string;
  children: React.ReactNode;
}

export default function ProjectLayout({
  projectNo,
  projectName,
  projectDesc,
  sourceType,
  taskType,
  collectionNum,
  CreatedDatetime,
  UpdatedDatetime,
  onFunction, // onFunction은 현재 사용되지 않으므로 필요 시 삭제 가능합니다.
  isLoading,  // ✅ isLoading prop 받기
  token,      // 🔑 ProjectHomePage로부터 토큰 수신
  API_BASE,   // 🔑 ProjectHomePage로부터 API_BASE 수신
  children,
}: ProjectLayoutProps) {
  const router = useRouter();
  const pathname = router.asPath.replace(/^\/(en|ko)/, "");

  const { data: session } = useSession() as any;
  const internalToken = session?.access_token; // 프로젝트 설정에 맞는 토큰 필드명 확인

  // 1. 내부 데이터 상태 및 로딩 상태 정의
  // const [internalData, setInternalData] = useState<InternalProjectDetail>({});
  const [internalData, setInternalData] = useState<InternalProjectDetail | null>(null);
  const [internalLoading, setInternalLoading] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [currentName, setCurrentName] = useState("");
  const [editValue, setEditValue] = useState("");

  // 초기 이름 설정 및 Prop 변경 시 동기화
  useEffect(() => {
    if (projectName) {
      setCurrentName(projectName);
      setEditValue(projectName);
    }
  }, [projectName]);

  // 2. 내부 데이터 Fetching 로직
  useEffect(() => {
    // 🚨 조건: projectNo와 token이 있고, projectName이 Prop으로 전달되지 않았을 때만 Fetch
    const shouldFetch = projectNo && token && API_BASE && !projectName;

    if (shouldFetch) {
      setInternalLoading(true);
      async function fetchProjectDetails() {
        try {
          const res = await fetch(`${API_BASE}/api/project/${projectNo}/detail`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) throw new Error("Layout 데이터 불러오기 실패");
          const data = await res.json();
          console.log("project layout:", data)

          // 내부 데이터 상태 업데이트
          setInternalData({
            project_name: data.project_info.project_name,
            project_description: data.project_info.project_description,
            task_type: data.project_info.task_type,
            source_type: data.project_info.source_type,
            collection_num: data.project_info.collection_num,
            created_datetime: data.project_info.created_datetime,
            updated_datetime: data.project_info.updated_datetime,
          });
        } catch (e) {
          console.error("Layout Fetch Error:", e);
        } finally {
          setInternalLoading(false);
        }
      }
      fetchProjectDetails();
    }
  }, [projectNo, token, API_BASE]);

  // 🟢 내부 이름 수정 API 호출 함수
  const handleRename = async () => {
    if (!internalToken) return;

    if (!editValue.trim() || editValue === currentName) {
      setIsEditing(false);
      return;
    }

    try {
      // API 호출
      await api.patch(`/api/project/${projectNo}/rename`,
        { project_name: editValue },
        { headers: authHeader(internalToken) }
      );

      // ✅ 성공 시 내부 상태만 즉시 업데이트 (부모를 건드리지 않음)
      setCurrentName(editValue);
      setIsEditing(false);
    } catch (e) {
      console.error("이름 수정 실패:", e);
      alert("이름 수정 중 오류가 발생했습니다.");
      setEditValue(currentName);
    }
  };

  // 3. 최종 데이터 결정: Prop으로 받은 데이터가 우선 (Prop ?? Internal Data)
  // const finalProjectName = projectName ?? internalData?.project_name;
  const finalProjectName = currentName || projectName || internalData?.project_name;
  const finalProjectDesc = projectDesc ?? internalData?.project_description;
  const finalTaskType = taskType ?? internalData?.task_type;
  const finalSourceType = sourceType ?? internalData?.source_type;
  const finalCollectionNum = collectionNum ?? internalData?.collection_num;
  const finalCreatedDateTime = CreatedDatetime ?? internalData?.created_datetime;
  const finalUpdatedDateTime = UpdatedDatetime ?? internalData?.updated_datetime;

  // 4. 최종 로딩 상태 결정: 외부 로딩 중이거나 내부 로딩 중일 때 로딩 상태 유지
  const finalLoading = isLoading || internalLoading;

  // 5. 로딩 중이거나 프로젝트 번호가 없을 때 스켈레톤 렌더링
  if (finalLoading || !projectNo) {
    return <ProjectSkeleton />;
  }

  // 메인 탭
  const tabs = [
    { id: "home", label: "홈", href: `/project/${projectNo}` },
    // { id: "data", label: "학습 데이터", href: `/project/${projectNo}/data/${finalSourceType?.toLowerCase()}` },
    { id: "data", label: "데이터", href: `/project/${projectNo}/collection` },
    { id: "models", label: "모델", href: `/project/${projectNo}/models` },
    { id: "result", label: "분류 결과", href: `/project/${projectNo}/result` },
  ];

  const collectionDetailMatch = pathname.match(new RegExp(`^/project/${projectNo}/collection/(\\d+)`));
  const currentCollectionId = collectionDetailMatch ? collectionDetailMatch[1] : null;
  const isAnalysisPage = pathname.includes("/collection/analysis");
  const dataSubTabs = [
    // { id: "stats", label: "통계", href: `/project/${projectNo}/stats` },
    // { id: "preview", label: "편집", href: `/project/${projectNo}/preview` },
    {
      id: "collection",
      // 우선순위: 분석 페이지 > 상세 페이지 > 목록 페이지
      label: isAnalysisPage
        ? "컬렉션 분석"
        : currentCollectionId
          ? `컬렉션 상세`
          : "컬렉션 목록",
      href: isAnalysisPage
        ? `/project/${projectNo}/collection/analysis`
        : currentCollectionId
          ? `/project/${projectNo}/collection/${currentCollectionId}`
          : `/project/${projectNo}/collection`
    },
    // { id: "setting", label: "컬렉션 관리", href: `/project/${projectNo}/collection/setting` },
    // { id: "data", label: "데이터 추가", href: `/project/${projectNo}/data/${finalSourceType?.toLowerCase()}` },
  ];

  const collectionDetailTabs = (collectionId: string) => [
    { id: "view", label: "상세보기", href: `/project/${projectNo}/collection/${collectionId}` },
  ];

  // 현재 활성화된 메인 탭 확인
  const getActiveTab = () => {
    if (!pathname) return "home";
    if (!pathname || pathname === `/project/${projectNo}`) return "home";
    if (pathname.includes("/models")) return "models";
    if (pathname.includes("/result")) return "result";
    if (pathname.includes("/data") || pathname.includes("/preview") || pathname.includes("/stats") || pathname.includes("/collection")) {
      return "data";
    }
    return "home";
  };

  // 현재 활성화된 데이터 서브 탭 확인
  const getActiveDataSubTab = () => {
    if (pathname?.includes("/collection/setting")) return "setting";
    if (pathname?.includes("/collection")) return "collection";

    if (pathname?.includes("/data")) return "data";
    if (pathname?.includes("/preview")) return "preview";
    if (pathname?.includes("/stats")) return "stats";


    return "collection";
  };

  const activeTab = getActiveTab();
  const activeDataSubTab = getActiveDataSubTab();
  const showDataSubTabs = activeTab === "data";

  // -------------------------------------------------------------
  // 🟢 로딩 완료 시: 실제 ProjectLayout UI 렌더링
  // -------------------------------------------------------------
  return (
    <div className="w-full bg-white min-h-screen">

      {/* 프로필 섹션 */}
      <div className="bg-white">
        <div className="mx-auto w-full max-w-6xl px-5">
          <div className="flex flex-col md:flex-row items-start md:items-end gap-4 md:gap-6 m-3 md:mt-5 pb-6">
            {/* 프로필 이미지 */}
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-2xl md:text-3xl border-4 border-white shadow-lg flex-shrink-0">
              {finalProjectName ? finalProjectName.charAt(0).toUpperCase() : ""}
            </div>

            {/* 프로젝트 정보 */}
            <div className="flex-grow pb-2 w-full">
              <div className="flex items-center min-h-[40px]">
                {isEditing ? (
                  <div className="flex items-center gap-2 w-full max-w-md">
                    <input
                      autoFocus
                      className="text-2xl md:text-3xl font-bold text-zinc-900 border-b-2 border-blue-500 outline-none bg-transparent flex-grow"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRename();
                        if (e.key === 'Escape') setIsEditing(false);
                      }}
                    />
                    <button onClick={handleRename} className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors">
                      <Check size={24} />
                    </button>
                    <button onClick={() => setIsEditing(false)} className="p-1 text-zinc-400 hover:bg-zinc-50 rounded transition-colors">
                      <X size={24} />
                    </button>
                  </div>
                ) : (
                  <div
                    className="flex items-center group cursor-pointer"
                    onClick={() => {
                      setIsEditing(true);
                      setEditValue(finalProjectName || "");
                    }}
                  >
                    <h1 className="text-2xl md:text-3xl font-bold text-zinc-900 pr-3 group-hover:text-blue-600 transition-colors">
                      {finalProjectName || ""}
                    </h1>
                    <Pencil size={18} className="text-zinc-400 opacity-0 group-hover:opacity-100 transition-all" />
                  </div>
                )}

                <div className="ml-auto md:ml-4">
                  <Link href={`/project/${projectNo}/models/new?collection_num=${finalCollectionNum}&task_type=${finalTaskType}&source_type=${finalSourceType}`} className="group flex items-center justify-center w-10 h-10 rounded-full bg-white text-blue-600 border border-blue-200 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all shadow-md overflow-hidden hover:w-32 hover:rounded-3xl">
                    <div className="absolute flex items-center justify-center group-hover:opacity-0 transition-opacity">
                      <Plus className="h-5 w-5" />
                    </div>
                    <span className="opacity-0 group-hover:opacity-100 text-sm font-medium whitespace-nowrap transition-opacity">
                      모델 만들기
                    </span>
                  </Link>
                </div>
              </div>

              {/* 하단 메타 정보 */}
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-zinc-600">
                {projectNo && <span>프로젝트 #{projectNo} • </span>}
                <span className="uppercase">{sourceType || internalData?.source_type}</span>
              </div>
              <p className="mt-2 text-sm text-zinc-600">{finalProjectDesc || internalData?.project_description || "설명 없음"}</p>
              <p className="flex mt-2 text-sm text-zinc-600 items-center">
                <Calendar className="h-4 w-4 mr-1" />
                {setDatetimeToDate(CreatedDatetime || internalData?.created_datetime || "")}
              </p>

            </div>
          </div>
        </div>
      </div>

      {/* 고정 세션 */}
      <div className="sticky top-[64px] z-[40] bg-white border-b border-zinc-200">

        {/* 메인 탭 네비게이션 */}
        <div className="bg-white border-b border-zinc-200">
          <div className="mx-auto w-full max-w-6xl px-5">
            <nav className="flex gap-8">
              {tabs.map((tab) => (
                <Link
                  key={tab.id}
                  href={tab.href}
                  className={`py-3 border-b-2 font-medium text-sm transition-colors ${activeTab === tab.id
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-zinc-600 hover:text-zinc-900"
                    }`}
                >
                  {tab.label}
                </Link>
              ))}
            </nav>
          </div>

        </div>


        {/* 데이터 서브 탭 (데이터 탭이 활성화되었을 때만 표시) */}
        {/* {showDataSubTabs && (
          <div className="bg-zinc-50 border-b border-zinc-200">
            <div className="mx-auto w-full max-w-6xl px-5 py-4">
              <div className="inline-flex rounded-lg border border-zinc-200 p-1 bg-white">
                {dataSubTabs.map((tab) => (
                  <Link
                    key={tab.id}
                    href={tab.href}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeDataSubTab === tab.id
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50"
                      }`}
                  >
                    {tab.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )} */}

      </div>

      {/* 본문 컨텐츠 */}
      <div className="mx-auto w-full max-w-7xl px-5 py-8">
        {children}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// ProjectSkeleton 컴포넌트
// ------------------------------------------------------------------
function ProjectSkeleton() {
  return (
    <div className="w-full bg-white min-h-screen animate-pulse">
      {/* 프로필 섹션 스켈레톤 */}
      <div className="bg-white">
        <div className="mx-auto w-full max-w-6xl px-5">
          <div className="flex flex-col md:flex-row items-start md:items-end gap-4 md:gap-6 m-3 md:mt-5 pb-6">
            {/* 원형 이미지 스켈레톤 */}
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-zinc-200 border-4 border-white shadow-lg flex-shrink-0" />
            {/* 텍스트 정보 스켈레톤 */}
            <div className="flex-grow pb-2 w-full">
              <div className="flex items-center mb-3">
                <div className="h-8 w-48 bg-zinc-200 rounded-md" />
                <div className="h-10 w-10 bg-zinc-200 rounded-full ml-3" />
              </div>
              <div className="mt-1 flex items-center gap-2 mb-3">
                <div className="h-4 w-24 bg-zinc-200 rounded-md" />
                <div className="h-4 w-16 bg-zinc-200 rounded-md" />
              </div>
              <div className="h-4 w-full max-w-md bg-zinc-200 rounded-md" />
            </div>
          </div>
        </div>
      </div>

      {/* 탭 네비게이션 스켈레톤 */}
      <div className="bg-white border-b border-zinc-200">
        <div className="mx-auto w-full max-w-6xl px-5">
          <div className="flex gap-8">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="py-3">
                <div className="h-5 w-20 bg-zinc-200 rounded-md" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 본문 컨텐츠 영역 스켈레톤 */}
      <div className="mx-auto w-full max-w-7xl px-5 py-8">
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="h-24 bg-zinc-200 rounded-lg" />
            <div className="h-24 bg-zinc-200 rounded-lg" />
            <div className="h-24 bg-zinc-200 rounded-lg" />
          </div>
          <div className="h-48 w-full bg-zinc-200 rounded-lg" />
          <div className="h-48 w-full bg-zinc-200 rounded-lg" />
        </div>
      </div>
    </div>
  );
}