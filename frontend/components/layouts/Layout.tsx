// components/layouts/Layout.tsx
// import LanguageSwitcher from '@/components/LanguageSwitcher';
import Header from './Header';
import Footer from './Footer';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      {/* <LanguageSwitcher /> */}
      <main style={{ minHeight: 'calc(100vh - 200px)' }}>
        {children}
      </main>
      <Footer />
    </>
  );
}
