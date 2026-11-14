import { AlertTriangle, RefreshCw } from "lucide-react";

interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
  hint?: string;
}

export default function ErrorMessage({ message, onRetry, hint }: ErrorMessageProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-red-500/25 bg-red-500/5 px-6 py-16 text-center"
    >
      <AlertTriangle size={40} className="text-[#fca5a5]" aria-hidden="true" />
      <p className="max-w-lg text-base font-medium text-[#fca5a5]">{message}</p>
      {hint && <p className="max-w-md text-sm text-[var(--muted)]">{hint}</p>}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-4 py-2 text-sm font-bold text-[var(--text)] transition-colors hover:border-[var(--accent)]"
        >
          <RefreshCw size={16} aria-hidden="true" />
          Try again
        </button>
      )}
    </div>
  );
}
