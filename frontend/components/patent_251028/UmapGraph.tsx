import React from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ZAxis
} from 'recharts';

// 컬렉션별 고정 색상
const FALLBACK = [
  '#0088FE',  // 파랑
  '#00C49F',  // 초록
  '#FFBB28',  // 노랑
  '#FF8042',  // 주황
  '#8884D8',  // 보라
  '#82CA9D',  // 연두
  '#FFC658',  // 골드
  '#FF6B9D',  // 핑크
];

// CPC/IPC 섹션별 색상 (단일 컬렉션용)
const CPC_COLORS: { [key: string]: string } = {
  'A': '#FF6B6B',  // 빨강
  'B': '#4ECDC4',  // 청록
  'C': '#FFD93D',  // 노랑
  'D': '#95E1D3',  // 민트
  'E': '#6C5CE7',  // 보라
  'F': '#FD79A8',  // 핑크
  'G': '#0984E3',  // 파랑
  'H': '#00B894',  // 초록
};

interface UmapPoint {
  UMAP1: number;
  UMAP2: number;
  category: string;  // 컬렉션 이름 또는 CPC 코드
  label: string;
  application_number: string;
  collection_name: string;
  ipc_code: string;
}

interface Props {
  data: UmapPoint[];
  loading?: boolean;
  height?: number;
}

const UmapGraph: React.FC<Props> = ({ data, loading = false, height = 600 }) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return <p className="text-gray-500 text-center py-8">UMAP 데이터가 없습니다.</p>;
  }

  // x, y 좌표 추가
  const dataWithXY = data.map(point => ({
    ...point,
    x: point.UMAP1,
    y: point.UMAP2
  }));

  // category별로 그룹화 (범례용)
  const grouped: { [key: string]: any[] } = {};
  dataWithXY.forEach(point => {
    const cat = point.category;
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(point);
  });

  // 카테고리별 색상 매핑
  const categories = Object.keys(grouped);
  const colorMap: { [key: string]: string } = {};
  categories.forEach((cat, idx) => {
    colorMap[cat] = CPC_COLORS[cat] || FALLBACK[idx % FALLBACK.length];
  });

  // 각 점에 색상 추가
  const dataWithColors = dataWithXY.map(point => ({
    ...point,
    fill: colorMap[point.category]
  }));



  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" dataKey="x" name="UMAP1" tick={{ fill: '#6B7280' }} />
        <YAxis type="number" dataKey="y" name="UMAP2" tick={{ fill: '#6B7280' }} />
        <ZAxis range={[60, 60]} />
        <Tooltip 
          cursor={{ strokeDasharray: '3 3' }}
          content={({ active, payload }: any) => {
            if (!active || !payload?.[0]?.payload) return null;
            const p = payload[0].payload;
            
            return (
              <div style={{ 
                backgroundColor: '#fff', 
                border: `2px solid ${p.fill}`,
                borderRadius: '8px',
                padding: '10px'
              }}>
                <p style={{ margin: '4px 0', fontSize: '14px', fontWeight: 'bold', color: p.fill }}>
                  {p.category}
                </p>
                <p style={{ margin: '4px 0', fontSize: '14px' }}>
                  <strong>출원번호:</strong> {p.application_number}
                </p>
                <p style={{ margin: '4px 0', fontSize: '14px' }}>
                  <strong>컬렉션:</strong> {p.collection_name}
                </p>
                <p style={{ margin: '4px 0', fontSize: '14px' }}>
                  <strong>IPC 코드:</strong> {p.ipc_code}
                </p>
                <p style={{ margin: '4px 0', fontSize: '14px', color: '#6B7280' }}>
                  위치: ({p.x?.toFixed(2)}, {p.y?.toFixed(2)})
                </p>
              </div>
            );
          }}
        />
        
        {/* 모든 데이터를 하나의 Scatter로 표시 */}
        <Scatter
          data={dataWithColors}
          fillOpacity={0.6}
        />
      </ScatterChart>
    </ResponsiveContainer>
  );
};

export default UmapGraph;