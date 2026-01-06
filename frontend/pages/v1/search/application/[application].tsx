"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { searchByApplication } from "@/lib/api";
import { SearchResultCard } from "@/components/search/SearchResultCard";

export default function ApplicationSearchDetail() {
  const params = useParams();
  const appNo = decodeURIComponent(params?.application as string);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    searchByApplication(appNo).then(setData).finally(() => setLoading(false));
  }, [appNo]);

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h2 className="text-xl font-semibold text-gray-700 mb-4">출원번호 {appNo}</h2>
      {loading && <p className="text-gray-400">불러오는 중...</p>}
      {data && <SearchResultCard {...data} />}
    </div>
  );
}
