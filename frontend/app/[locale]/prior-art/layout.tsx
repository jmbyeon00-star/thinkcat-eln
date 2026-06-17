import { Metadata } from 'next';

export const metadata: Metadata = {
    title: '선행기술조사 | ThinkCat',
    description: '출원 전 유사 특허·선행기술 조사 서비스',
};

export default function PriorArtLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
