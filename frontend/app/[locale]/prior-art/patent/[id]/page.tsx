'use client';

import { useEffect, useState } from "react";
import { useRouter } from "@/routing";
import { useParams, useSearchParams } from "next/navigation";
import {
  invalGetPatentInfo,
  invalGetElements,
  invalGetSessionOverrides,
  InvalPatentSearchResult,
  InvalElementResponse,
} from "@/lib/invalidation_api";

export default function InvalidationPatentDetail() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const id = decodeURIComponent((params.id as string) ?? "");
  const baseId = searchParams.get("base") ?? id;
  const similarity = searchParams.get("similarity") ?? undefined;
  const avgSimilarity = searchParams.get("avgSimilarity") ?? undefined;
  const sessionId = searchParams.get("session_id") ?? undefined;
  const model = searchParams.get("model") || "claude";

  const [patent, setPatent] = useState<InvalPatentSearchResult | null>(null);
  const [elements, setElements] = useState<InvalElementResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overriddenIds, setOverriddenIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!id) return;
    Promise.all([
      invalGetPatentInfo(id),
      invalGetElements(id, baseId, model, sessionId ?? "").catch(() => []),
    ])
      .then(async ([info, els]) => {
        setPatent(info);
        if (sessionId && els.length > 0) {
          const overrides = await invalGetSessionOverrides(sessionId, baseId).catch((): Record<string, Partial<InvalElementResponse>> => ({}));
          setOverriddenIds(new Set(Object.keys(overrides)));
          setElements(els.map(el => {
            const ov = overrides[String(el.id)];
            return ov ? { ...el, ...ov } : el;
          }));
        } else {
          setElements(els);
        }
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id, sessionId]);

  const simVal = similarity ? parseFloat(similarity) : null;
  const avgSimVal = avgSimilarity ? parseFloat(avgSimilarity) : null;
  const simColor = simVal !== null ? (simVal >= 0.85 ? "#dc2626" : simVal >= 0.75 ? "#d97706" : "#16a34a") : "#64748b";
  const simBg = simVal !== null ? (simVal >= 0.85 ? "#fef2f2" : simVal >= 0.75 ? "#fffbeb" : "#f0fdf4") : "#fff";
  const simBorder = simVal !== null ? (simVal >= 0.85 ? "#fecaca" : simVal >= 0.75 ? "#fde68a" : "#bbf7d0") : "#e2e8f0";

  return (
    <>
      <div style={{ fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif", background: "#f8fafc", minHeight: "100vh", color: "#0f172a" }}>

        <div style={{ maxWidth: 860, margin: "0 auto", padding: "48px 40px" }}>

          {loading && (
            <div style={{ textAlign: "center", padding: "80px 0", color: "#94a3b8" }}>로딩 중...</div>
          )}
          {error && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: "16px 20px", color: "#dc2626" }}>❌ {error}</div>
          )}

          {patent && (
            <>
              {/* 뒤로가기 + 다운로드 */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <button onClick={() => router.push(`/prior-art/analysis?base=${encodeURIComponent(baseId)}&cached=true&phase=done&model=${model}`)}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer" }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M9 2L4 7L9 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  뒤로가기
                </button>
                <button
                  onClick={() => {
                    const data = {
                      application_number: patent.application_number,
                      title: patent.title,
                      filing_date: patent.filing_date,
                      applicant_name: patent.applicant_name,
                      base_app_number: baseId,
                      similarity: simVal,
                      avg_similarity: avgSimVal,
                      elements,
                    };
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(blob);
                    a.download = `patent_${patent.application_number}.json`;
                    a.click();
                    URL.revokeObjectURL(a.href);
                  }}
                  style={{ padding: "8px 18px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, cursor: "pointer", color: "#374151", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                  ↓ 결과 다운로드 (JSON)
                </button>
              </div>

              {/* 정보 그리드 */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div style={{ background: "#fff", borderRadius: 12, padding: "20px 24px", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ color: "#6366f1" }}>#</span> 출원번호
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>{patent.application_number}</div>
                </div>
                <div style={{ background: "#fff", borderRadius: 12, padding: "20px 24px", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ color: "#6366f1" }}>📅</span> 출원일
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>{patent.filing_date ?? "-"}</div>
                </div>
                <div style={{ background: "#fff", borderRadius: 12, padding: "20px 24px", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ color: "#6366f1" }}>📋</span> 구성요소 수
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>{elements.length}개</div>
                </div>
                <div style={{ background: simBg, borderRadius: 12, padding: "20px 24px", border: `1px solid ${simBorder}` }}>
                  <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                    <span>⚠️</span> 기준특허와의 유사도
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontSize: 18, fontWeight: 800, color: simColor }}>
                      최고 {simVal !== null ? `${(simVal * 100).toFixed(1)}%` : "-"}
                    </span>
                    {avgSimVal !== null && (
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#64748b" }}>
                        / 평균 {(avgSimVal * 100).toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* IPC 코드 */}
              <div style={{ background: "#fff", borderRadius: 12, padding: "20px 24px", border: "1px solid #e2e8f0", marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ color: "#6366f1" }}>🌐</span> IPC 코드
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#64748b" }}>{patent.ipc_code ?? "-"}</div>
              </div>

              {/* 특허명 */}
              <div style={{ background: "#fff", borderRadius: 12, padding: "20px 24px", border: "1px solid #e2e8f0", marginBottom: 24 }}>
                <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 10 }}>● 특허명 (Title)</div>
                <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.5 }}>{patent.title}</div>
              </div>

              {/* 구성요소 목록 */}
              {elements.length > 0 && (
                <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: "24px 28px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                  <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 20 }}>● 청구항 (Claims)</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {elements.map((el, i) => {
                      const isOverridden = overriddenIds.has(String(el.id));
                      return (
                        <div key={el.id} style={{ border: `1px solid ${isOverridden ? "#c4b5fd" : "#f1f5f9"}`, borderRadius: 12, overflow: "hidden" }}>
                          <div style={{ background: isOverridden ? "#faf5ff" : "#f8fafc", padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${isOverridden ? "#e9d5ff" : "#f1f5f9"}` }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <span style={{ width: 22, height: 22, background: "#1e40af", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
                                {i + 1}
                              </span>
                              <span style={{ fontSize: 14, fontWeight: 700 }}>{el.name}</span>
                              {isOverridden && (
                                <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 100, background: "#ede9fe", color: "#7c3aed", fontWeight: 600, marginLeft: 4 }}>수정됨</span>
                              )}
                            </div>
                            {el.criticality != null && (
                              <div style={{ textAlign: "right" }}>
                                <div style={{ fontSize: 11, color: "#94a3b8" }}>중요도</div>
                                <div style={{ fontWeight: 800, fontSize: 14, color: el.criticality >= 4 ? "#dc2626" : el.criticality >= 3 ? "#d97706" : "#94a3b8" }}>
                                  {el.criticality}
                                </div>
                              </div>
                            )}
                          </div>
                          <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
                            {el.function && (
                              <div>
                                <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, marginBottom: 6, letterSpacing: "0.05em" }}>기능</div>
                                <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.7 }}>{el.function}</div>
                              </div>
                            )}
                            {el.raw_text && (
                              <div>
                                <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, marginBottom: 6, letterSpacing: "0.05em" }}>청구항 원문</div>
                                <div style={{ background: "#f8fafc", borderRadius: 8, padding: "12px 16px", fontSize: 13, color: "#374151", lineHeight: 1.8, border: "1px solid #f1f5f9" }}>
                                  {el.source_claim && (
                                    <div style={{ fontSize: 12, color: "#1e40af", fontWeight: 600, marginBottom: 6 }}>
                                      청구항 {el.source_claim} 참조
                                    </div>
                                  )}
                                  {el.raw_text}
                                </div>
                              </div>
                            )}
                            {!el.raw_text && el.embedding_text && (
                              <div>
                                <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, marginBottom: 6, letterSpacing: "0.05em" }}>유사도 분석 기준 텍스트</div>
                                <div style={{ background: "#f0f9ff", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#374151", lineHeight: 1.8, border: "1px solid #bae6fd" }}>
                                  {el.embedding_text}
                                </div>
                              </div>
                            )}
                            {el.correspondence && (
                              <div>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                                  <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, letterSpacing: "0.05em" }}>기준특허 대응</div>
                                  {el.base_element_id && el.base_element_id !== "없음" && (
                                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 100, background: "#dbeafe", color: "#1e40af", fontWeight: 600 }}>
                                      구성요소 {el.base_element_id.replace(/E/g, "").replace(/,\s*/g, ", ")}
                                    </span>
                                  )}
                                </div>
                                <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.7 }}>{el.correspondence}</div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {elements.length === 0 && (
                <div style={{ textAlign: "center", padding: "40px 0", color: "#94a3b8", fontSize: 14 }}>
                  구성요소가 없습니다
                </div>
              )}
            </>
          )}
        </div>

        {/* FOOTER */}
        <footer style={{ borderTop: "1px solid #e2e8f0", padding: "28px 40px", marginTop: 40, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 22, height: 22, background: "#1e40af", borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "#fff", fontSize: 11, fontWeight: 800 }}>씽</span>
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#1e40af" }}>씽캣</span>
          </div>
          <div style={{ fontSize: 13, color: "#94a3b8" }}>© 2026 THINKCAT-ELN. All rights reserved.</div>
        </footer>
      </div>
    </>
  );
}
