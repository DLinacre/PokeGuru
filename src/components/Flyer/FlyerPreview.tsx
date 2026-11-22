import { useEffect, useState } from "react";
import { cn } from "../../utils/cn";
import { buildFlyerSvg, resolveFlyerOrigin } from "../../services/flyer";

interface FlyerPreviewProps {
  className?: string;
  /** Alt text for the rasterised preview. */
  label?: string;
}

/**
 * Live vector preview of the printable flyer, rendered from exactly the same
 * scene as the PDF so what visitors see is what the printer gets.
 */
export default function FlyerPreview({ className, label = "Preview of the printable PokeGuru 5 × 6 in flyer" }: FlyerPreviewProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!resolveFlyerOrigin().origin) {
      setFailed(true);
      return;
    }
    buildFlyerSvg()
      .then((svg) => {
        if (cancelled) return;
        setSrc(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      className={cn(
        "relative aspect-[5/6] w-full overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-inset)]",
        className
      )}
    >
      {src ? (
        <img src={src} alt={label} className="h-full w-full object-cover" loading="lazy" decoding="async" />
      ) : (
        <div className="flex h-full w-full items-center justify-center p-4 text-center text-[11px] leading-relaxed text-[var(--muted-dim)]">
          {failed ? "Flyer preview needs a live site address (VITE_PUBLIC_SITE_URL)." : "Rendering flyer preview…"}
        </div>
      )}
    </div>
  );
}
