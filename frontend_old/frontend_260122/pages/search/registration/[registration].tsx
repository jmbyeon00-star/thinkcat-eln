import { useState } from "react";
import { fetchAPI } from "@lib/api";

import { withMessages } from '@/lib/i18n/withMessages';
export const getServerSideProps = withMessages();

export default function RegistrationSearchPage() {
  const [regNo, setRegNo] = useState("");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const search = async () => {
    if (!regNo) return alert("등록번호를 입력하세요.");
    setLoading(true);
    fetchAPI(`/search/by-registration/${regNo}`)
      .then(setData)
      .catch((err) => alert(err.message))
      .finally(() => setLoading(false));
  };

  return (
    <div className="max-w-2xl mx-auto py-10">
      <h1 className="text-2xl font-bold text-center mb-4">📘 등록번호 검색</h1>
      <div className="flex justify-center gap-2 mb-6">
        <input
          type="text"
          value={regNo}
          onChange={(e) => setRegNo(e.target.value)}
          placeholder="등록번호 입력"
          className="border px-4 py-2 rounded-lg w-80"
        />
        <button
          onClick={search}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg"
        >
          검색
        </button>
      </div>

      {loading && <div className="text-center text-gray-500">검색 중...</div>}

      {data && (
        <div className="border rounded-lg p-4 bg-white shadow-sm">
          <p><b>등록번호:</b> {data.reg_number}</p>
          <p><b>출원번호:</b> {data.application_number}</p>
          <p><b>출원일자:</b> {data.filing_date}</p>
          <p><b>발명의 명칭:</b> {data.title}</p>
          <p><b>요약:</b> {data.abstract}</p>
          <p><b>IPC코드:</b> {data.ipc_code}</p>
        </div>
      )}
    </div>
  );
}
