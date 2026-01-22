import { useEffect, useState } from "react";
// import { useParams } from "next/navigation"; // app router
import { useRouter } from "next/router"; // page router
import { searchByApplication } from "@/lib/api";
import { SearchResultCard } from "@/components/search/SearchResultCard";

import { withMessages } from '@/lib/i18n/withMessages';
export const getServerSideProps = withMessages();

export default function ApplicationSearchDetail() {
  // app router
  // const params = useParams();
  // const appNo = decodeURIComponent(params?.application as string);

  // page router
  const router = useRouter();
  const { application } = router.query;
  const appNo =
    typeof application === "string"
      ? decodeURIComponent(application)
      : null;

  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!router.isReady || !appNo) return;
    setIsLoading(true);
    searchByApplication(appNo)
      .then(setData)
      .finally(() => setIsLoading(false));
  }, [router.isReady, appNo]);

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h2 className="text-xl font-semibold text-gray-700 mb-4">
        출원번호 {appNo}
      </h2>

      {isLoading && <p className="text-gray-400">불러오는 중...</p>}
      {data && <SearchResultCard {...data} />}
    </div>
  );
}
