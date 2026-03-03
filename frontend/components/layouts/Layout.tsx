// components/layouts/Layout.tsx
// import LanguageSwitcher from '@/components/LanguageSwitcher';
import Header from './AgentHeader';
import Footer from './Footer';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      {/* <LanguageSwitcher /> */}
      {children}
      <Footer />
    </>
  );
}
