import { useMemo } from "react";
import { Link } from "react-router-dom";
import { PackageOpen, Sparkles } from "lucide-react";
import { usePackCatalogue } from "../../hooks/usePacks";
import PackArt from "./PackArt";

/**
 * Homepage teaser for the simulator. Loaded lazily so the pack catalogue
 * (one request per TCGdex series) never delays the first paint.
 */
export default function HomePackTeaser() {
  const { packs } = usePackCatalogue();

  const featured = useMemo(() => {
    const wanted = ["base1", "swsh4.5", "sv06.5", "sv03.5", "me01"];
    const picked = wanted
      .map((id) => packs.find((pack) => pack.setId === id))
      .filter((pack): pack is (typeof packs)[number] => Boolean(pack));
    if (picked.length >= 3) return picked.slice(0, 3);
    const merged = new Map([...picked, ...packs.slice(0, 3)].map((pack) => [pack.setId, pack]));
    return [...merged.values()].slice(0, 3);
  }, [packs]);

  return (
    <section
      aria-labelledby="packs-home-heading"
      className="relative mb-14 overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--bg-card)] p-5 sm:p-7"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(245,165,36,0.16),transparent_70%)]"
      />
      <div className="relative grid gap-6 lg:grid-cols-[1.25fr_1fr] lg:items-center">
        <div>
          <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent-2)]">
            <Sparkles size={12} aria-hidden="true" /> PokeGuru Pack Simulator
          </p>
          <h2 id="packs-home-heading" className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
            Tear open a booster from any era
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--muted)]">
            From Base Set to the newest Scarlet &amp; Violet expansion. Real card pools, era-specific pack structures,
            transparent odds and no limits — with every pull kept separate from your real collection.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to="/packs" className="btn btn-primary no-underline hover:no-underline">
              <PackageOpen size={15} aria-hidden="true" />
              Open packs
            </Link>
            <Link to="/packs/collection" className="btn btn-secondary no-underline hover:no-underline">
              Simulated collection
            </Link>
          </div>
          <p className="mt-3 text-[11px] text-[var(--muted-dim)]">
            Free and unlimited · no ads, virtual currency or purchases · simulated pulls are not yours to sell.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {featured.length
            ? featured.map((pack) => (
                <Link
                  key={pack.setId}
                  to={`/packs/${pack.setId}`}
                  className="block no-underline transition-transform hover:-translate-y-1"
                >
                  <PackArt
                    setName={pack.setName}
                    seriesId={pack.seriesId}
                    seriesName={pack.seriesName}
                    logo={pack.logo}
                    year={pack.releaseDate ? new Date(pack.releaseDate).getUTCFullYear().toString() : undefined}
                  />
                  <p className="mt-1.5 truncate text-[10px] font-bold text-[var(--text)]">{pack.setName}</p>
                </Link>
              ))
            : [0, 1, 2].map((index) => (
                <div key={index} className="aspect-[3/5] animate-shimmer rounded-[16px] border border-[var(--border)]" />
              ))}
        </div>
      </div>
    </section>
  );
}
