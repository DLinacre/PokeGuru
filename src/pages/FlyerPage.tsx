import { Link } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Droplets,
  Info,
  Printer,
  QrCode,
  Ruler,
  ScanLine,
  Sparkles,
} from "lucide-react";
import { usePageMeta } from "../hooks/usePageMeta";
import FlyerActions from "../components/Flyer/FlyerActions";
import FlyerPreview from "../components/Flyer/FlyerPreview";
import { FLYER_MM, FLYER_PT } from "../services/flyer/scene";
import { FLYER_FILE_NAME } from "../services/flyer/qr";

const STEPS = [
  {
    icon: Ruler,
    title: "Pick 5 × 6 in photo paper",
    copy: "The PDF page box is exactly 127 × 152.4 mm. In the print dialogue choose 5 × 6 in (or “Borderless photo 127 × 152 mm”) — not A4 and not “fit to page”.",
  },
  {
    icon: Printer,
    title: "Print at 100% / actual size",
    copy: "Turn off “scale to fit”, “shrink oversized pages” and any auto-enlarge setting. 100% keeps the QR modules square, which is what makes it scan first time.",
  },
  {
    icon: Droplets,
    title: "Glossy or matte both work",
    copy: "The artwork is dark with one white QR panel, so gloss shows colours best while matte avoids fingerprints at a venue. Leave the sheet to dry before handling.",
  },
];

const CHECKLIST = [
  "One page, vector artwork — no bitmaps to go soft at photo-paper size.",
  "A QR code that always encodes the live production address, generated in your browser.",
  "A printed host line under the QR, so the flyer still works if someone cannot scan it.",
  "Generous margins: nothing important sits within 6 mm of the trim, so borderless printing cannot clip it.",
  "Official-unaffiliated wording at the foot, so shops can display it without ambiguity.",
];

export default function FlyerPage() {
  usePageMeta({
    title: "Printable 5 × 6 in flyer",
    description:
      "Download or print the PokeGuru promotional flyer: one vector page, exactly 5 × 6 in (127 × 152.4 mm) for photo paper, with a QR code to the live site.",
    path: "/flyer",
  });

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-6 sm:py-8 md:px-6">
      <Link to="/about" className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--muted)] no-underline hover:text-[var(--text)]">
        <ArrowLeft size={13} aria-hidden="true" />
        Back to about
      </Link>

      <header className="mb-6 max-w-3xl">
        <p className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-soft)] px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-[var(--accent-text)]">
          <Sparkles size={11} aria-hidden="true" />
          Free to print and share
        </p>
        <h1 className="text-2xl font-black uppercase tracking-tight sm:text-3xl">The PokeGuru flyer</h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          One page for card-shop counters, league-night tables and trade binders. It is printed at{" "}
          <strong className="text-[var(--text-soft)]">exactly 5 × 6 in (127 × 152.4 mm)</strong> on standard photo paper, and the
          QR code points at the live site.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:items-start">
        <section aria-labelledby="flyer-preview-heading" className="surface p-4 sm:p-5">
          <h2 id="flyer-preview-heading" className="mb-3 text-[11px] font-black uppercase tracking-widest text-[var(--muted)]">
            Live preview
          </h2>
          <FlyerPreview className="mx-auto w-full max-w-[360px]" />
          <p className="mt-3 text-center text-[11px] text-[var(--muted)]">
            {FLYER_PT.width / 72} × {FLYER_PT.height / 72} in ·{" "}
            {FLYER_MM.width} × {FLYER_MM.height} mm · {FLYER_PT.width} × {FLYER_PT.height} pt
          </p>
          <p className="mt-1 text-center text-[10px] text-[var(--muted-dim)]">{FLYER_FILE_NAME}</p>
          <FlyerActions className="mt-4" />
        </section>

        <div className="space-y-4">
          <section aria-labelledby="flyer-steps-heading" className="surface p-5">
            <h2 id="flyer-steps-heading" className="text-sm font-black uppercase tracking-tight">
              Printing it on 5 × 6 photo paper
            </h2>
            <ol className="mt-3 space-y-3">
              {STEPS.map(({ icon: Icon, title, copy }, index) => (
                <li key={title} className="flex gap-3">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-soft)] text-[var(--accent-text)]">
                    <Icon size={14} aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-xs font-bold text-[var(--text)]">
                      {index + 1}. {title}
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-[var(--muted)]">{copy}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="flyer-contents-heading" className="surface p-5">
            <h2 id="flyer-contents-heading" className="flex items-center gap-2 text-sm font-black uppercase tracking-tight">
              <QrCode size={15} aria-hidden="true" className="text-[var(--accent-text)]" />
              What is on it
            </h2>
            <ul className="mt-3 space-y-2">
              {CHECKLIST.map((item) => (
                <li key={item} className="flex gap-2 text-xs leading-relaxed text-[var(--muted)]">
                  <CheckCircle2 size={13} aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--success)]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="flyer-test-heading" className="surface p-5">
            <h2 id="flyer-test-heading" className="flex items-center gap-2 text-sm font-black uppercase tracking-tight">
              <ScanLine size={15} aria-hidden="true" className="text-[var(--accent-text)]" />
              Does the QR scan?
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
              Point a phone camera at the preview above before you print. It should offer to open the live PokeGuru address. If it
              does not, check that you are viewing this page on the deployed site (the QR is deliberately never generated for a
              localhost or preview host, so nothing broken gets printed).
            </p>
            <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-[var(--muted-dim)]">
              <Info size={12} aria-hidden="true" className="mt-0.5 shrink-0" />
              <span>
                The PDF is generated in your browser each time, so it always carries the current design and the live site address.
                Nothing is uploaded and no account is needed.
              </span>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
