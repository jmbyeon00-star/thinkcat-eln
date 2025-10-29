import { useState } from "react";
import { useRouter } from "next/router";
import { FileText, ChevronLeft, ChevronRight } from "lucide-react";

type PatentItem = {
    application_number: string;
    applicant_name: string;
    ipc_code: string;
    end_status: string;
    filing_date?: string;
};

type PatentTableProps = {
    title : string;
    description : string;
    data : PatentItem[] | undefined;
    color: "blue" | "yellow" | "green";
};


const colorClasses = {
    blue: {
        gradient: "from-blue-600 to-blue-500",
        badge: "bg-blue-100 text-blue-700",
        hover: "hover:bg-blue-50",
    },
    yellow: {
        gradient: "from-yellow-600 to-yellow-500",
        badge: "bg-yellow-100 text-yellow-700",
        hover: "hover:bg-yellow-50",
    },
    green: {
        gradient: "from-green-600 to-green-500",
        badge: "bg-green-100 text-green-700",
        hover: "hover:bg-green-50",
    },
};

export default function PatentTable({
    title,
    description,
    data = [],
    color,
}: PatentTableProps) {
    const router = useRouter();
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5;

    const totalPages = Math.ceil(data.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedData = data.slice(startIndex, startIndex + itemsPerPage);

    const handleRowClick = (appNum: string) => {
        router.push(`/search/applicationNum/${appNum}`);
    };
    const colors = colorClasses[color];

return (
    <div className="bg-white rounded-xl shadow-lg border border-zinc-200 overflow-hidden">
      <div className={`bg-gradient-to-r ${colors.gradient} px-6 py-4`}>
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <FileText size={20} />
          {title}
        </h3>
        <p className="text-sm text-white/80 mt-1">{description}</p>
      </div>

      <div className="p-6">
        {data.length > 0 ? (
          <>
            <div className={`mb-4 px-4 py-2 ${colors.badge} rounded-lg inline-block`}>
              <span className="text-sm font-semibold">
                총 {data.length}건
              </span>
            </div>

            <div className="overflow-x-auto rounded-lg border border-zinc-200">
              <table className="min-w-full divide-y divide-zinc-200">
                <thead className="bg-zinc-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-700 uppercase">
                      출원번호
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-700 uppercase">
                      출원자 이름
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-700 uppercase">
                      IPC코드
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-700 uppercase">
                      상태구분
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-zinc-100">
                  {paginatedData.map((item, index) => (
                    <tr
                      key={index}
                      onClick={() => handleRowClick(item.application_number)}
                      className={`cursor-pointer ${colors.hover} transition-colors`}
                    >
                      <td className="px-4 py-3 text-sm text-blue-600 hover:underline">
                        {item.application_number}
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-900">
                        {item.applicant_name}
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-700 font-mono">
                        {item.ipc_code?.length > 10
                          ? `${item.ipc_code.slice(0, 9)}...`
                          : item.ipc_code}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className="px-2 py-1 bg-zinc-100 text-zinc-700 rounded text-xs font-medium">
                          {item.end_status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-4">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg border border-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-50"
                >
                  <ChevronLeft size={20} />
                </button>

                <span className="text-sm text-zinc-600">
                  {currentPage} / {totalPages}
                </span>

                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg border border-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-50"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12 text-zinc-500">
            <FileText size={48} className="mx-auto mb-4 text-zinc-300" />
            <p>검색 데이터가 없습니다.</p>
          </div>
        )}
      </div>
    </div>
  );
}