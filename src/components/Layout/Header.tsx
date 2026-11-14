import { NavLink, useNavigate } from "react-router-dom";
import { Book, Camera, Layers, Search, Shuffle, Wallet, X } from "lucide-react";
import { useState, type FormEvent, useEffect, useRef } from "react";
import { useDebouncedValue } from "../../hooks/useApi";
import { getRandomCard, searchCards } from "../../services/tcgdex";
import type { TcgCard } from "../../types/pokemon";
import BuyMeAPack from "../UI/BuyMeAPack";
import Brand from "./Brand";
import { cn } from "../../utils/cn";

const NAV_ITEMS = [
  { to: "/search", label: "Search", icon: Search },
  { to: "/sets", label: "Sets", icon: Layers },
  { to: "/wiki", label: "Wiki", icon: Book },
  { to: "/collection", label: "Vault", icon: Wallet },
  { to: "/scanner", label: "Scan", icon: Camera },
];

export default function Header() {
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<TcgCard[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [searching, setSearching] = useState(false);
  const [randomLoading, setRandomLoading] = useState(false);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebouncedValue(searchQuery, 300);

  useEffect(() => {
    const query = debouncedQuery.trim();
    if (query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      setSearching(false);
      return;
    }

    const controller = new AbortController();
    let active = true;
    setSearching(true);

    searchCards(
      { query, category: "", rarity: "", setId: "", sort: "name", page: 1, pageSize: 6 },
      { signal: controller.signal }
    )
      .then((result) => {
        if (!active) return;
        setSuggestions(result.cards);
        setShowSuggestions(result.cards.length > 0);
        setSelectedIndex(-1);
        setSearching(false);
      })
      .catch(() => {
        if (!active) return;
        setSuggestions([]);
        setSearching(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [debouncedQuery]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        inputRef.current &&
        !inputRef.current.contains(target)
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const tag = (document.activeElement?.tagName ?? "").toLowerCase();
      const typing = tag === "input" || tag === "textarea" || tag === "select";
      if (event.key === "/" && !typing) {
        event.preventDefault();
        inputRef.current?.focus();
      }
      if (event.key === "Escape" && showSuggestions) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [showSuggestions]);

  const closeSuggestions = () => {
    setShowSuggestions(false);
    setSuggestions([]);
    setSearchQuery("");
  };

  const handleSearch = (event: FormEvent) => {
    event.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;
    closeSuggestions();
    navigate(`/search?q=${encodeURIComponent(query)}`);
  };

  const selectSuggestion = (card: TcgCard) => {
    closeSuggestions();
    navigate(`/card/${card.id}`);
  };

  const handleRandom = async () => {
    setRandomLoading(true);
    try {
      const card = await getRandomCard();
      closeSuggestions();
      navigate(`/card/${card.id}`);
    } catch {
      navigate("/search");
    } finally {
      setRandomLoading(false);
    }
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
    } else if (event.key === "Enter" && selectedIndex >= 0) {
      event.preventDefault();
      selectSuggestion(suggestions[selectedIndex]);
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[rgba(8,9,13,0.82)] px-3 py-2.5 backdrop-blur-xl md:px-6">
      <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-x-3 gap-y-2">
        <Brand className="order-1" />

        <form onSubmit={handleSearch} className="relative order-3 w-full min-w-0 flex-1 sm:order-2 sm:w-auto sm:max-w-[520px]">
          <div className="flex w-full overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-inset)] transition-all focus-within:border-[var(--border-accent)] focus-within:ring-2 focus-within:ring-[rgba(240,68,82,0.15)]">
            <label htmlFor="global-search" className="sr-only">
              Search Pokémon cards
            </label>
            <input
              ref={inputRef}
              id="global-search"
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onFocus={() => {
                if (suggestions.length > 0) setShowSuggestions(true);
              }}
              placeholder="Search cards…  (press /)"
              className="min-w-0 flex-1 border-none bg-transparent px-3.5 py-2 text-sm text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
              onKeyDown={handleInputKeyDown}
              autoComplete="off"
              role="combobox"
              aria-expanded={showSuggestions}
              aria-controls="search-suggestions"
              aria-autocomplete="list"
            />
            <button
              type="submit"
              className="border-none bg-transparent px-3.5 text-[var(--muted)] transition-colors hover:text-[var(--accent)] active:scale-90"
              aria-label="Submit search"
            >
              <Search size={18} aria-hidden="true" />
            </button>
          </div>

          {showSuggestions && suggestions.length > 0 && (
            <div
              ref={dropdownRef}
              id="search-suggestions"
              role="listbox"
              aria-label="Card suggestions"
              className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-card)] shadow-2xl"
            >
              {suggestions.map((card, index) => (
                <button
                  key={card.id}
                  type="button"
                  role="option"
                  aria-selected={index === selectedIndex}
                  onClick={() => selectSuggestion(card)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={cn(
                    "flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors",
                    index === selectedIndex ? "bg-[var(--accent)]/10 text-[var(--text)]" : "text-[var(--muted)] hover:bg-[var(--bg-soft)]"
                  )}
                >
                  {card.images.small ? (
                    <img
                      src={card.images.small}
                      alt=""
                      width={32}
                      height={44}
                      loading="lazy"
                      className="h-11 w-8 shrink-0 rounded object-contain"
                    />
                  ) : (
                    <span className="h-11 w-8 shrink-0 rounded bg-[var(--bg-soft)]" aria-hidden="true" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-[var(--text)]">{card.name}</span>
                    <span className="block truncate text-[11px] text-[var(--muted)]">
                      {card.set?.name || "Set not listed"} · #{card.localId}
                    </span>
                  </span>
                </button>
              ))}
              <div className="border-t border-[var(--border)] px-3 py-2 text-[11px] text-[var(--muted)]">
                {searching ? "Searching…" : "Press Enter to search all cards"}
              </div>
            </div>
          )}

          {searching && !showSuggestions && (
            <span className="sr-only" role="status">
              Searching cards
            </span>
          )}
        </form>

        <nav aria-label="Primary" className="order-2 hidden items-center gap-1 md:order-3 md:flex">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-bold uppercase tracking-[0.12em] no-underline transition-colors hover:bg-white/5 hover:text-[var(--text)] hover:no-underline",
                  isActive ? "bg-white/[0.06] text-[var(--text)]" : "text-[var(--muted)]"
                )
              }
            >
              <Icon size={15} aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="order-4 ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={handleRandom}
            disabled={randomLoading}
            className="hidden items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-soft)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-tight text-[var(--muted)] transition-all hover:border-[var(--accent)] hover:text-[var(--text)] disabled:opacity-50 sm:flex"
            title="Open a random card"
          >
            <Shuffle size={12} aria-hidden="true" />
            <span>{randomLoading ? "…" : "Random"}</span>
          </button>
          <BuyMeAPack variant="icon" className="hidden sm:inline-flex lg:hidden" />
          <BuyMeAPack variant="compact" className="hidden lg:inline-flex" />
          <button
            type="button"
            onClick={() => {
              closeSuggestions();
              inputRef.current?.focus();
            }}
            className="rounded-lg border border-[var(--border)] bg-[var(--bg-soft)] p-2 text-[var(--muted)] transition-colors hover:text-[var(--text)] md:hidden"
            aria-label="Open search"
          >
            <Search size={16} aria-hidden="true" />
          </button>
          {showSuggestions && (
            <button
              type="button"
              className="sr-only"
              onClick={() => setShowSuggestions(false)}
              aria-label="Close suggestions"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
