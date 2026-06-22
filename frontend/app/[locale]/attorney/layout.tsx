import { Metadata } from 'next';

export const metadata: Metadata = {
    title: '변리사 | ThinkCat',
    description: '특허·법률 변리사 검색 및 매칭 서비스',
};

export default function AttorneyLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
