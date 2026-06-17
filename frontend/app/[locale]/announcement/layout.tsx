import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'R&D공고검색 | ThinkCat',
    description: '정부·공공기관의 R&D 과제 공고 통합 검색 서비스',
};

export default function AnnouncementLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
