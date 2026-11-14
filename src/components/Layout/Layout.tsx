import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import { WifiOff } from "lucide-react";
import Header from "./Header";
import Footer from "./Footer";
import MobileNav from "./MobileNav";
import ScrollToTop from "../UI/ScrollToTop";
import BackToTop from "../UI/BackToTop";
import PageSkeleton from "../UI/PageSkeleton";
import UpdatePrompt from "../UI/UpdatePrompt";
import { useOnlineStatus } from "../../hooks/useOnline";

export default function Layout() {
  const online = useOnlineStatus();

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-[var(--accent)] focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>
      <ScrollToTop />
      <Header />
      {!online && (
        <p
          role="status"
          className="flex items-center justify-center gap-2 border-b border-[var(--accent-2)]/30 bg-[var(--accent-2)]/10 px-4 py-2 text-center text-xs font-semibold text-[var(--accent-2)]"
        >
          <WifiOff size={13} aria-hidden="true" />
          You&apos;re offline — PokeGuru is showing previously cached data where available.
        </p>
      )}
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-[1180px] flex-1 px-4 py-6 pb-24 outline-none animate-fade-in md:px-6 sm:pb-8"
      >
        <Suspense fallback={<PageSkeleton title="Loading page" />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
      <MobileNav />
      <BackToTop />
      <UpdatePrompt />
    </div>
  );
}
