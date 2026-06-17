import { Metadata } from 'next';

export const metadata: Metadata = {
    title: '검색 | ThinkCat',
    description: 'ThinkCat 지능형 특허 검색 서비스',
    robots: 'noindex',
};

export default function SearchLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
