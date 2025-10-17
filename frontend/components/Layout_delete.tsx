// /frontend/components/Layout.tsx
import { useRouter } from "next/router";
import Header from "./Header";
import Footer from "./Footer";
import ProjectStepper from "./ProjectStepper";

export default function Layout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const stepItems = ["기본정보", "데이터 소스", "매칭/미리보기", "라벨/클래스", "학습 설정"];

    let step = 0;
    if (router.pathname.startsWith("/project/upload")) step = 1;
    if (router.pathname.startsWith("/project/search")) step = 1;
    if (router.pathname.startsWith("/project/preview")) step = 2;
    if (router.pathname.startsWith("/project/label")) step = 4;
    if (router.pathname.startsWith("/project/train")) step = 5;

    const showStepper = step > 0;
    console.log("showStepper:", showStepper)

    return (
        <>
            <Header />

            <main style={{ minHeight: 'calc(100vh - 200px)' }}>
                {showStepper && (
                    <div className="max-w-5xl mx-auto mb-6">
                        <ProjectStepper step={step} items={stepItems} />
                    </div>
                )}
                {children}
            </main>

            <Footer />
        </>
    );
}
