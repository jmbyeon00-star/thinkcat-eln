// utils/colorMapping.ts (새 파일 생성)
export const FALLBACK_COLORS = [
  '#0088FE',  '#00C49F',  '#FFBB28',  '#FF8042',
  '#8884D8',  '#82CA9D',  '#FFC658',  '#FF6B9D',
];

export const CPC_COLORS: { [key: string]: string } = {
  'A': '#FF6B6B',  'B': '#4ECDC4',  'C': '#FFD93D',  'D': '#95E1D3',
  'E': '#6C5CE7',  'F': '#FD79A8',  'G': '#0984E3',  'H': '#00B894',
};

export const getCategoryColor = (category: string, allCategories: string[]): string => {
  // CPC 색상이 있으면 우선 사용
  if (CPC_COLORS[category]) {
    return CPC_COLORS[category];
  }
  
  // 없으면 정렬된 카테고리 목록에서 인덱스 찾기
  const sortedCategories = [...allCategories].sort();
  const idx = sortedCategories.indexOf(category);
  return FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
};