type Props = {
    title: string;
    abstract: string;
    application_number: string;
    filing_date?: string;
    grant_date?: string;
  };
  
  export function SearchResultCard({ title, abstract, application_number, filing_date, grant_date }: Props) {
    return (
      <div className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm hover:shadow-md transition">
        <h3 className="font-semibold text-blue-600 text-lg mb-1">{title || "제목 없음"}</h3>
        <p className="text-sm text-gray-600 line-clamp-3">{abstract || "요약 없음"}</p>
  
        <div className="mt-2 text-xs text-gray-500 flex justify-between">
          <span>출원번호: {application_number}</span>
          {filing_date && <span>출원일: {filing_date}</span>}
          {grant_date && <span>등록일: {grant_date}</span>}
        </div>
      </div>
    );
  }
  