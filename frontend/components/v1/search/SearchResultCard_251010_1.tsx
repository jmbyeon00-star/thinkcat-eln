type PatentResult = {
    application_number: string;
    applicant_name?: string;
    filing_date?: string;
    title?: string;
    abstract?: string;
    claim?: string;
    ipc_code?: string;
  };
  
  type Props = {
    data: PatentResult | null;
  };
  
  export default function SearchResultCard({ data }: Props) {
    if (!data) return null;
  
    return (
      <div className="max-w-3xl mx-auto mt-10 p-6 bg-white shadow rounded-xl border border-gray-200">
        <h2 className="text-xl font-bold text-blue-700 mb-2">{data.title || "(제목 없음)"}</h2>
        <p className="text-gray-700 mb-4">{data.abstract || "요약 정보 없음"}</p>
        <div className="text-sm text-gray-600 space-y-1">
          <p><strong>📄 출원번호:</strong> {data.application_number}</p>
          {data.applicant_name && <p><strong>👤 출원인:</strong> {data.applicant_name}</p>}
          {data.filing_date && <p><strong>📅 출원일:</strong> {data.filing_date}</p>}
          {data.ipc_code && <p><strong>🏷️ IPC 코드:</strong> {data.ipc_code}</p>}
          {data.claim && <p><strong>💬 청구항:</strong> {data.claim}</p>}
        </div>
      </div>
    );
  }
  