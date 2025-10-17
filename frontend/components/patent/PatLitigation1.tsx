"use client";

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

    const base = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
    fetch(`${base}/api/patent/npecheck?appNumber=${applicationNumber}`)
      .then((res) => res.json())
      .then((data) => setNpeData(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [applicationNumber]);

  const handleClick = (code?: string) => {
    if (code) router.push(`/company/${code}`);
  };

  // 🔹 그룹화
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
    const baseStyle = "inline-flex items-center justify-center w-6 h-6 border-2 rounded-md";
    if (prob === 0)
      return { color: "#6c757d", icon: <XCircle className={`${baseStyle}`} color="#6c757d" /> };
    if (prob >= 0.99933)
      return { color: "#dc3545", icon: <AlertCircle className={`${baseStyle}`} color="#dc3545" /> };
    if (prob >= 0.99924 && prob < 0.99933)
      return { color: "#fc9c0c", icon: <AlertTriangle className={`${baseStyle}`} color="#fc9c0c" /> };
    if (prob >= 0.69892 && prob < 0.99924)
      return { color: "#ffc107", icon: <AlertTriangle className={`${baseStyle}`} color="#ffc107" /> };
    return { color: "#28a745", icon: <CheckCircle className={`${baseStyle}`} color="#28a745" /> };
  };

    return (
        <section className="max-w-5xl mx-auto bg-white border border-zinc-200 rounded-xl shadow-sm p-8 mt-6">
            <h1 className="text-xl font-semibold text-zinc-900 mb-6 border-b border-zinc-200 pb-3">
                권리자 이전
            </h1>
            <div className="w-full">
                {isLoading ? (
                    <div className="flex justify-center items-center h-60 text-zinc-500">
                        <div className="animate-spin border-4 border-t-blue-500 border-gray-300 rounded-full h-8 w-8"></div>
                        <span className="ml-3">데이터 불러오는 중...</span>
                    </div>
                ) : npeData.length > 0 ? (
                    <div className="overflow-x-auto border rounded-lg shadow-sm">
                    <table className="min-w-full text-sm text-center border-collapse">
                        <thead className="bg-gray-100 text-gray-700 font-semibold">
                        <tr>
                            <th className="p-2 border">이전번호</th>
                            <th className="p-2 border">권리자번호</th>
                            <th className="p-2 border">출원번호</th>
                            <th className="p-2 border">등록번호</th>
                            <th className="p-2 border">권리자이름</th>
                            <th className="p-2 border">권리자코드</th>
                            <th className="p-2 border">NPE예측</th>
                        </tr>
                        </thead>
                        <tbody>
                        {groupedData.map((group, gIdx) =>
                            group.map((item, iIdx) => {
                            const key = `${gIdx}-${iIdx}`;
                            const colorData = getColor(item.npe_prob);
                            return (
                                <tr
                                key={key}
                                className={`${
                                    hoveredRow === key ? "bg-gray-100" : gIdx % 2 === 0 ? "bg-white" : "bg-gray-50"
                                } hover:bg-gray-200 transition`}
                                onMouseEnter={() => setHoveredRow(key)}
                                onMouseLeave={() => setHoveredRow(null)}
                                >
                                {iIdx === 0 && (
                                    <td
                                    rowSpan={group.length}
                                    className="p-2 border cursor-pointer text-blue-600 hover:underline"
                                    onClick={() => handleClick(item.RGTR_CD)}
                                    >
                                    {item.RGT_TRNSF_SEQ}
                                    </td>
                                )}
                                <td
                                    className="p-2 border cursor-pointer text-blue-600 hover:underline"
                                    onClick={() => handleClick(item.RGTR_CD)}
                                >
                                    {item.RGTR_SEQ}
                                </td>
                                <td className="p-2 border">{applicationNumber}</td>
                                <td className="p-2 border">{item.RGSTNO}</td>
                                <td className="p-2 border">{item.RGTR_NM}</td>
                                <td
                                    className="p-2 border cursor-pointer text-blue-600 hover:underline"
                                    onClick={() => handleClick(item.RGTR_CD)}
                                >
                                    {item.RGTR_CD || "N/A"}
                                </td>
                                <td className="p-2 border">{colorData.icon}</td>
                                </tr>
                            );
                            })
                        )}
                        </tbody>
                    </table>
                    </div>
                ) : (
                    <p className="text-center text-gray-500 py-8">권리자 이전 데이터가 없습니다.</p>
                )}
            </div>
        </section>
    );
}
