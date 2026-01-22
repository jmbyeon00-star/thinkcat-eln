export type PreviewItem = {
    application_number: string;
    application_number_norm: string;
    title?: string;
    abstract?: string;
    ipc?: string[];
    year?: number;
  };
  
  export default function SearchResultTable({
    items,
    selected,
    onToggle
  }: {
    items: PreviewItem[];
    selected: Record<string, boolean>;
    onToggle: (norm: string, v: boolean) => void;
  }) {
    return (
      <div style={{overflowX:"auto"}}>
        <table className="table table-sm m-0">
          <thead>
            <tr>
              <th style={{width:36}} />
              <th style={{width:220}}>App No</th>
              <th>Title</th>
              <th style={{width:280}}>IPC</th>
              <th style={{width:90}}>Year</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx)=>(
              <tr key={it.application_number_norm + idx}>
                <td>
                  <input
                    type="checkbox"
                    checked={!!selected[it.application_number_norm]}
                    onChange={e => onToggle(it.application_number_norm, e.target.checked)}
                  />
                </td>
                <td><code>{it.application_number}</code></td>
                <td>{it.title || <span className="text-muted">-</span>}</td>
                <td>{it.ipc?.join(", ") || "-"}</td>
                <td>{it.year ?? "-"}</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={5} className="text-center text-muted py-4">검색 결과가 없습니다.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }
  