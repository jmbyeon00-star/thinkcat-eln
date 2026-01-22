import { useState, FormEvent } from 'react';

type Props = {
  defaultCategory?: string;
  loading?: boolean;
  onSearch: (params: { keyword: string; category: string }) => void;
};

const CPC_SECTIONS = [
  { value: 'A', label: 'A - 생활필수품' },
  { value: 'B', label: 'B - 처리/운수' },
  { value: 'C', label: 'C - 화학/야금' },
  { value: 'D', label: 'D - 섬유/지류' },
  { value: 'E', label: 'E - 건설' },
  { value: 'F', label: 'F - 기계/조명/난방' },
  { value: 'G', label: 'G - 물리' },
  { value: 'H', label: 'H - 전기' },
  { value: 'Y', label: 'Y - 범용 신기술' },
];

export default function SearchBar({ defaultCategory = 'A', loading, onSearch }: Props) {
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState(defaultCategory);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!keyword.trim()) return;
    onSearch({ keyword: keyword.trim(), category });
  };

  return (
    <form onSubmit={submit} style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: '2rem', flexWrap: 'wrap' }}>
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        style={{
          padding: '0.75rem 1rem',
          border: '2px solid #1e5aa8',
          borderRadius: 9999,
          minWidth: 220,
          fontSize: '1rem'
        }}
      >
        {CPC_SECTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>

      <div style={{ display: 'flex' }}>
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="검색어를 입력하세요..."
          style={{
            width: 360,
            padding: '0.75rem 1rem',
            border: '2px solid #1e5aa8',
            borderRight: 'none',
            borderRadius: '9999px 0 0 9999px',
            outline: 'none',
            fontSize: '1rem'
          }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '0.75rem 1.25rem',
            border: '2px solid #1e5aa8',
            borderLeft: 'none',
            background: '#1e5aa8',
            color: '#fff',
            fontWeight: 700,
            borderRadius: '0 9999px 9999px 0',
            cursor: 'pointer',
            fontSize: '1rem',
            opacity: loading ? 0.7 : 1
          }}
        >
          {loading ? '검색중…' : '검색'}
        </button>
      </div>
    </form>
  );
}
