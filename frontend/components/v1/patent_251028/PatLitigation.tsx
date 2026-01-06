import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, AlertTriangle, CheckCircle, XCircle } from "lucide-react";

type NpeItem = {
  RGSTNO: string;
  RGT_TRNSF_SEQ: number;
  RGTR_SEQ: number;
  RGTR_CD: string;
  RGTR_NM: string;
  npe_prob: number;
};

type PatLitigationProps = {
  applicationNumber: string;
};

export default function PatLitigation({ applicationNumber }: PatLitigationProps) {
  const [npeData, setNpeData] = useState<NpeItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!applicationNumber) return;
    setIsLoading(true);

    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
    fetch(`${API_BASE}/api/patent/npecheck?appNumber=${applicationNumber}`)
      .then((res) => res.json())
      .then((data) => setNpeData(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [applicationNumber]);

  const handleClick = (code?: string) => {
    if (code) router.push(`/company/${code}`);
  };

  const groupByRGT_TRNSF_SEQ = (data: NpeItem[]) => {
    const grouped: Record<string, NpeItem[]> = {};
    data.forEach((item) => {
      const key = item.RGT_TRNSF_SEQ.toString();
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item);
    });
    return Object.values(grouped);
  };

  const groupedData = groupByRGT_TRNSF_SEQ(npeData);

  const getColor = (prob: number) => {
    if (prob === 0) return { color: "#6b7280", label: "데이터 없음", icon: <XCircle size={20} /> };
    if (prob >= 0.99933) return { color: "#dc2626", label: "매우 높음", icon: <AlertCircle size={20} /> };
    if (prob >= 0.99924) return { color: "#f97316", label: "높음", icon: <AlertTriangle size={20} /> };
    if (prob >= 0.69892) return { color: "#fbbf24", label: "중간", icon: <AlertTriangle size={20} /> };
    return { color: "#16a34a", label: "낮음", icon: <CheckCircle size={20} /> };
  };

  // 통계 계산
  const highRiskCount = npeData.filter(item => item.npe_prob >= 0.99933).length;
  const mediumRiskCount = npeData.filter(item => item.npe_prob >= 0.69892 && item.npe_prob < 0.99933).length;
  const lowRiskCount = npeData.filter(item => item.npe_prob > 0 && item.npe_prob < 0.69892).length;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white p-8">
        <div className="max-w-5xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-zinc-100 overflow-hidden animate-pulse">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6">
              <div className="h-6 bg-blue-400 rounded w-32 mb-2"></div>
              <div className="h-4 bg-blue-300 rounded w-48"></div>
            </div>
            <div className="p-8">
              <div className="grid grid-cols-3 gap-6 mb-8">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-24 bg-zinc-100 rounded-xl"></div>
                ))}
              </div>
              <div className="h-96 bg-zinc-100 rounded-xl"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-zinc-900 mb-2">
            권리자 이전 분석
          </h1>
          <p className="text-zinc-600">
            NPE(Non-Practicing Entity) 위험도 평가
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-zinc-100 overflow-hidden">
          {/* Card Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6">
            <h2 className="text-xl font-semibold text-white mb-2">
              권리자 이전 내역
            </h2>
            <p className="text-blue-100 text-sm">
              Rights Holder Transfer History & NPE Risk Assessment
            </p>
          </div>

          {npeData.length > 0 ? (
            <>
              {/* Stats Summary */}
              <div className="grid grid-cols-3 gap-6 px-8 py-6 bg-zinc-50 border-b border-zinc-100">
                <div className="bg-white rounded-xl p-4 shadow-sm border border-red-100">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle size={16} className="text-red-500" />
                    <span className="text-sm font-medium text-zinc-700">고위험</span>
                  </div>
                  <div className="text-2xl font-bold text-red-600">
                    {highRiskCount}건
                  </div>
                  <div className="text-xs text-zinc-500 mt-1">NPE 가능성 매우 높음</div>
                </div>

                <div className="bg-white rounded-xl p-4 shadow-sm border border-yellow-100">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle size={16} className="text-yellow-600" />
                    <span className="text-sm font-medium text-zinc-700">중위험</span>
                  </div>
                  <div className="text-2xl font-bold text-yellow-600">
                    {mediumRiskCount}건
                  </div>
                  <div className="text-xs text-zinc-500 mt-1">주의 필요</div>
                </div>

                <div className="bg-white rounded-xl p-4 shadow-sm border border-green-100">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle size={16} className="text-green-500" />
                    <span className="text-sm font-medium text-zinc-700">저위험</span>
                  </div>
                  <div className="text-2xl font-bold text-green-600">
                    {lowRiskCount}건
                  </div>
                  <div className="text-xs text-zinc-500 mt-1">안전 수준</div>
                </div>
              </div>

              {/* Table */}
              <div className="p-8">
                <h3 className="text-lg font-semibold text-zinc-900 mb-6 flex items-center gap-2">
                  <div className="w-1 h-5 bg-gradient-to-b from-blue-600 to-indigo-600 rounded-full" />
                  상세 이전 내역
                </h3>

                <div className="overflow-x-auto rounded-xl border border-zinc-200">
                  <table className="min-w-full divide-y divide-zinc-200">
                    <thead className="bg-zinc-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-700 uppercase tracking-wider">
                          이전번호
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-700 uppercase tracking-wider">
                          권리자번호
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-700 uppercase tracking-wider">
                          출원번호
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-700 uppercase tracking-wider">
                          등록번호
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-700 uppercase tracking-wider">
                          권리자이름
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-700 uppercase tracking-wider">
                          권리자코드
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-zinc-700 uppercase tracking-wider">
                          NPE 위험도
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-zinc-100">
                      {groupedData.map((group, gIdx) =>
                        group.map((item, iIdx) => {
                          const key = `${gIdx}-${iIdx}`;
                          const colorData = getColor(item.npe_prob);
                          return (
                            <tr
                              key={key}
                              className={`${hoveredRow === key
                                  ? "bg-blue-50"
                                  : gIdx % 2 === 0
                                    ? "bg-white"
                                    : "bg-zinc-50"
                                } hover:bg-blue-50 transition-colors`}
                              onMouseEnter={() => setHoveredRow(key)}
                              onMouseLeave={() => setHoveredRow(null)}
                            >
                              {iIdx === 0 && (
                                <td
                                  rowSpan={group.length}
                                  className="px-4 py-3 text-sm font-medium text-blue-600 cursor-pointer hover:underline"
                                  onClick={() => handleClick(item.RGTR_CD)}
                                >
                                  {item.RGT_TRNSF_SEQ}
                                </td>
                              )}
                              <td
                                className="px-4 py-3 text-sm text-blue-600 cursor-pointer hover:underline"
                                onClick={() => handleClick(item.RGTR_CD)}
                              >
                                {item.RGTR_SEQ}
                              </td>
                              <td className="px-4 py-3 text-sm text-zinc-700">
                                {applicationNumber}
                              </td>
                              <td className="px-4 py-3 text-sm text-zinc-700">
                                {item.RGSTNO}
                              </td>
                              <td className="px-4 py-3 text-sm font-medium text-zinc-900">
                                {item.RGTR_NM}
                              </td>
                              <td
                                className="px-4 py-3 text-sm text-blue-600 cursor-pointer hover:underline"
                                onClick={() => handleClick(item.RGTR_CD)}
                              >
                                {item.RGTR_CD || "N/A"}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center justify-center gap-2">
                                  <div style={{ color: colorData.color }}>
                                    {colorData.icon}
                                  </div>
                                  <span
                                    className="text-xs font-semibold px-2 py-1 rounded-full"
                                    style={{
                                      color: colorData.color,
                                      backgroundColor: `${colorData.color}20`
                                    }}
                                  >
                                    {colorData.label}
                                  </span>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Risk Legend */}
                <div className="mt-6 bg-gradient-to-r from-zinc-50 to-blue-50 rounded-xl p-5 border border-zinc-200">
                  <h4 className="text-sm font-semibold text-zinc-700 mb-3">NPE 위험도 범례</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="flex items-center gap-2">
                      <AlertCircle size={18} className="text-red-500" />
                      <span className="text-xs text-zinc-600">매우 높음 (≥0.99933)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={18} className="text-orange-500" />
                      <span className="text-xs text-zinc-600">높음 (≥0.99924)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={18} className="text-yellow-500" />
                      <span className="text-xs text-zinc-600">중간 (≥0.69892)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle size={18} className="text-green-500" />
                      <span className="text-xs text-zinc-600">낮음 (&lt;0.69892)</span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="p-8">
              <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-12 text-center">
                <XCircle size={48} className="text-zinc-400 mx-auto mb-4" />
                <p className="text-zinc-500 text-lg">권리자 이전 데이터가 없습니다.</p>
              </div>
            </div>
          )}

          {/* Footer Note */}
          {npeData.length > 0 && (
            <div className="px-8 py-4 bg-zinc-50 border-t border-zinc-100">
              <p className="text-xs text-zinc-500">
                💡 권리자 코드를 클릭하면 해당 기업의 상세 정보를 확인할 수 있습니다.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}