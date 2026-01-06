export default function ProjectStepper({ step }: { step: 1|2|3 }) {
    const items = ["프로젝트 생성", "검색 조건", "결과 선택/저장"];
    return (
      <ol style={{display:"flex", gap:12, listStyle:"none", padding:0, margin:"12px 0 24px"}}>
        {items.map((t, i) => {
          const idx = (i+1) as 1|2|3;
          const active = idx === step;
          return (
            <li key={t} style={{
              padding:"6px 12px",
              borderRadius: 999,
              border: "1px solid #ccc",
              background: active ? "#0d6efd" : "transparent",
              color: active ? "#fff" : "#222",
              fontWeight: active ? 700 : 400
            }}>
              {idx}. {t}
            </li>
          );
        })}
      </ol>
    );
  }
  