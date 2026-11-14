import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Loader2,
  RotateCcw,
  ScanLine,
  Search,
  ShieldQuestion,
  Upload,
} from "lucide-react";
import { usePageMeta } from "../hooks/usePageMeta";
import { OcrUnavailableError, recogniseCard, type OcrCandidateMatch, type OcrProgress } from "../services/ocr";

type ScanState = "idle" | "working" | "results" | "no-text" | "error";

const STATUS_COPY: Record<string, string> = {
  "loading-engine": "Loading the OCR engine (first run downloads ~4 MB, then it is cached)…",
  recognising: "Reading the card text on your device…",
  matching: "Matching the text against the card database…",
};

export default function ScannerPage() {
  usePageMeta({
    title: "Card scanner",
    description:
      "Scan a Pokémon card with on-device OCR. Text recognition runs in your browser and matches names against the live card database.",
    path: "/scanner",
  });

  const [image, setImage] = useState<string | null>(null);
  const [state, setState] = useState<ScanState>("idle");
  const [progress, setProgress] = useState<OcrProgress | null>(null);
  const [matches, setMatches] = useState<OcrCandidateMatch[]>([]);
  const [names, setNames] = useState<string[]>([]);
  const [ocrText, setOcrText] = useState("");
  const [confidence, setConfidence] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imageWarning, setImageWarning] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const workerRef = useRef<{ terminate: () => Promise<unknown> } | null>(null);
  const navigate = useNavigate();

  useEffect(
    () => () => {
      void workerRef.current?.terminate().catch(() => {});
    },
    []
  );

  const runRecognition = useCallback(async (dataUrl: string) => {
    setState("working");
    setError(null);
    setMatches([]);
    setNames([]);
    setOcrText("");
    setConfidence(null);
    setProgress({ status: "loading-engine", progress: 0 });

    try {
      const result = await recogniseCard(dataUrl, setProgress, (worker) => {
        workerRef.current = worker;
      });
      setNames(result.names);
      setOcrText(result.text);
      setConfidence(result.confidence);
      setMatches(result.matches);
      setState(result.status === "no-text" ? "no-text" : "results");
    } catch (err) {
      setError(
        err instanceof OcrUnavailableError
          ? err.message
          : "Text recognition failed for this image. Try a sharper, straight-on photo with the card filling the frame."
      );
      setState("error");
    } finally {
      workerRef.current = null;
    }
  }, []);

  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;

      if (!file.type.startsWith("image/")) {
        setImageWarning("Please choose an image file (JPEG, PNG, WebP or HEIC).");
        return;
      }
      if (file.size > 15 * 1024 * 1024) {
        setImageWarning("That image is larger than 15 MB. Please use a smaller photo.");
        return;
      }

      setImageWarning(null);
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result ?? "");
        setImage(dataUrl);
        void runRecognition(dataUrl);
      };
      reader.onerror = () => setImageWarning("That image could not be read. Please try another file.");
      reader.readAsDataURL(file);
    },
    [runRecognition]
  );

  const openPicker = (capture: boolean) => {
    const input = fileInputRef.current;
    if (!input) return;
    if (capture) {
      input.setAttribute("capture", "environment");
    } else {
      input.removeAttribute("capture");
    }
    input.accept = "image/*";
    input.click();
  };

  const reset = () => {
    setImage(null);
    setState("idle");
    setProgress(null);
    setMatches([]);
    setNames([]);
    setOcrText("");
    setError(null);
    setConfidence(null);
  };

  const working = state === "working";
  const progressPercent = Math.round((progress?.progress ?? 0) * 100);

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-6 text-center">
        <h1 className="text-2xl font-extrabold tracking-tight">Card scanner</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-[var(--muted)]">
          Text recognition runs entirely on your device using Tesseract.js. It reads the card name, then searches the
          live database — you always confirm the match yourself.
        </p>
      </header>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
      />

      {!image ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-8">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="rounded-full bg-[var(--bg-soft)] p-6">
              <ScanLine size={44} className="text-[var(--muted)]" aria-hidden="true" />
            </div>
            <p className="max-w-md text-sm leading-relaxed text-[var(--muted)]">
              Photograph the card straight-on with the name clearly visible and as much of the card in frame as
              possible. Good lighting makes a big difference.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => openPicker(true)}
                className="flex items-center gap-2 rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#dc2626]"
              >
                <Camera size={17} aria-hidden="true" />
                Take photo
              </button>
              <button
                type="button"
                onClick={() => openPicker(false)}
                className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-soft)] px-5 py-2.5 text-sm font-bold text-[var(--text)] transition-colors hover:border-[var(--accent)]"
              >
                <Upload size={17} aria-hidden="true" />
                Upload image
              </button>
            </div>
            {imageWarning && (
              <p role="alert" className="flex items-center gap-2 text-xs text-[#fca5a5]">
                <AlertCircle size={14} aria-hidden="true" />
                {imageWarning}
              </p>
            )}
            <p className="mt-2 max-w-md text-[11px] leading-relaxed text-[var(--muted)]/80">
              Your photo is never uploaded. The first scan downloads the OCR engine and English language data; after
              that it works offline from the cache.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-card)]">
            <img src={image} alt="The card photo you selected for scanning" className="mx-auto max-h-[380px] w-auto object-contain" />
            {working && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 px-6 text-center text-white">
                <Loader2 size={28} className="animate-spin" aria-hidden="true" />
                <p className="text-sm font-semibold" role="status" aria-live="polite">
                  {STATUS_COPY[progress?.status ?? "loading-engine"] ?? "Working…"}
                </p>
                <div
                  className="h-1.5 w-56 overflow-hidden rounded-full bg-white/20"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progressPercent}
                >
                  <div className="h-full rounded-full bg-[var(--accent)] transition-all" style={{ width: `${progressPercent}%` }} />
                </div>
                <p className="text-[11px] text-white/70">
                  {progress?.status === "matching" ? "Almost there…" : `${progressPercent}%`}
                </p>
              </div>
            )}
          </div>

          {imageWarning && (
            <p role="alert" className="flex items-center gap-2 text-xs text-[#fca5a5]">
              <AlertCircle size={14} aria-hidden="true" />
              {imageWarning}
            </p>
          )}

          {state === "error" && (
            <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
              <p className="flex items-start gap-2">
                <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </p>
              <p className="mt-2 text-xs text-red-200/80">
                OCR is a browser capability and can be unavailable offline or on older devices. Searching by name always
                works.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  to={names[0] ? `/search?q=${encodeURIComponent(names[0])}` : "/search"}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--bg-card)] px-3 py-1.5 text-xs font-bold text-[var(--text)] no-underline"
                >
                  <Search size={13} aria-hidden="true" />
                  Search manually
                </Link>
                <button
                  type="button"
                  onClick={() => image && void runRecognition(image)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-bold text-[var(--text)]"
                >
                  <RotateCcw size={13} aria-hidden="true" />
                  Try again
                </button>
              </div>
            </div>
          )}

          {state === "no-text" && (
            <div role="status" className="rounded-xl border border-[var(--accent-2)]/30 bg-[var(--accent-2)]/10 p-4 text-sm text-[var(--accent-2)]">
              <p className="flex items-start gap-2 font-semibold">
                <ShieldQuestion size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                We couldn&apos;t read a card name from this photo.
              </p>
              <p className="mt-1 text-xs text-[var(--accent-2)]/80">
                Nothing has been guessed. Try again with the card centred, well-lit and filling more of the frame, or
                search by name.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => image && void runRecognition(image)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-bold text-[var(--text)]"
                >
                  <RotateCcw size={13} aria-hidden="true" />
                  Scan again
                </button>
                <Link to="/search" className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-bold text-[var(--text)] no-underline">
                  <Search size={13} aria-hidden="true" />
                  Search by name
                </Link>
              </div>
            </div>
          )}

          {state === "results" && (
            <section aria-labelledby="scan-results" className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id="scan-results" className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-[var(--accent-2)]">
                  <CheckCircle2 size={15} aria-hidden="true" />
                  Possible matches
                </h2>
                <span className="text-[11px] text-[var(--muted)]">
                  OCR confidence: {confidence != null ? `${Math.round(confidence)}%` : "not reported"}
                </span>
              </div>

              {names.length > 0 && (
                <p className="mt-2 text-xs text-[var(--muted)]">
                  Detected text: {names.map((name) => `“${name}”`).join(", ")}
                </p>
              )}

              {matches.length > 0 ? (
                <>
                  <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
                    These are suggestions based on the text we read. OCR can misread names — confirm the correct card
                    below.
                  </p>
                  <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {matches.map(({ card, score }) => (
                      <li key={card.id} className="rounded-xl border border-[var(--border)] bg-[var(--bg-soft)] p-2.5">
                        <button
                          type="button"
                          onClick={() => navigate(`/card/${card.id}`)}
                          className="block w-full text-left"
                          aria-label={`Open ${card.name} from ${card.set.name || "unknown set"}`}
                        >
                          {card.images.small ? (
                            <img
                              src={card.images.small}
                              alt={`${card.name} card`}
                              width={245}
                              height={337}
                              loading="lazy"
                              className="mx-auto w-full max-w-[140px] rounded-md"
                            />
                          ) : (
                            <div className="flex aspect-[245/337] items-center justify-center rounded-md bg-[var(--bg)] text-[11px] text-[var(--muted)]">
                              No image
                            </div>
                          )}
                          <p className="mt-2 truncate text-sm font-bold text-[var(--text)]">{card.name}</p>
                          <p className="truncate text-[11px] text-[var(--muted)]">
                            {card.set.name || "Set not listed"} {card.localId ? `· #${card.localId}` : ""}
                          </p>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--accent)]">
                            {score >= 10 ? "Name match" : score >= 5 ? "Close match" : "Possible match"}
                          </p>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="mt-3 text-sm text-[var(--muted)]">
                  The text was read, but no card in the database matches it confidently. Nothing has been guessed —
                  search by name to find it.
                </p>
              )}

              {ocrText && (
                <details className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--bg-soft)]/50 p-3 text-xs text-[var(--muted)]">
                  <summary className="cursor-pointer font-bold uppercase tracking-widest">Recognised text</summary>
                  <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed">{ocrText}</pre>
                </details>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => image && void runRecognition(image)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-bold text-[var(--text)] transition-colors hover:border-[var(--accent)]"
                >
                  <RotateCcw size={13} aria-hidden="true" />
                  Scan again
                </button>
                <Link
                  to={names[0] ? `/search?q=${encodeURIComponent(names[0])}` : "/search"}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-bold text-[var(--text)] no-underline transition-colors hover:border-[var(--accent)]"
                >
                  <Search size={13} aria-hidden="true" />
                  Search by text
                </Link>
              </div>
            </section>
          )}

          <div className="flex justify-center">
            <button
              type="button"
              onClick={reset}
              className="rounded-lg border border-[var(--border)] bg-[var(--bg-soft)] px-4 py-2 text-sm font-bold text-[var(--text)] transition-colors hover:border-[var(--accent)]"
            >
              Choose another image
            </button>
          </div>
        </div>
      )}

      <p className="mt-8 text-center text-xs text-[var(--muted)]">
        Prefer typing?{" "}
        <Link to="/search" className="text-[var(--link)]">
          Search the database manually
        </Link>
        .
      </p>
    </div>
  );
}
