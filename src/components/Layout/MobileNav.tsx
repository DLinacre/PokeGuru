import { Link, useLocation } from "react-router-dom";
import { Book, Camera, Layers, Search, Wallet } from "lucide-react";
import { cn } from "../../utils/cn";

const NAV_ITEMS = [
  { to: "/search", icon: Search, label: "Search" },
  { to: "/sets", icon: Layers, label: "Sets" },
  { to: "/collection", icon: Wallet, label: "Vault" },
  { to: "/scanner", icon: Camera, label: "Scan" },
  { to: "/wiki", icon: Book, label: "Wiki" },
];

export default function MobileNav() {
  const location = useLocation();

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-stretch justify-around border-t border-[var(--border)] bg-[rgba(15,17,21,0.92)] px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl sm:hidden"
    >
      {NAV_ITEMS.map(({ to, icon: Icon, label }) => {
        const isActive = location.pathname === to || location.pathname.startsWith(`${to}/`);
        return (
          <Link
            key={to}
            to={to}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "relative flex min-w-[56px] flex-1 flex-col items-center justify-center gap-1 rounded-lg px-1 py-1 text-[10px] font-bold uppercase tracking-tight no-underline transition-colors hover:no-underline active:scale-95",
              isActive ? "text-[var(--accent)]" : "text-[var(--muted)]"
            )}
          >
            {isActive && (
              <span aria-hidden="true" className="absolute left-1/2 top-0 h-0.5 w-8 -translate-x-1/2 rounded-full bg-[var(--accent)]" />
            )}
            <Icon size={20} strokeWidth={isActive ? 2.6 : 2} aria-hidden="true" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
