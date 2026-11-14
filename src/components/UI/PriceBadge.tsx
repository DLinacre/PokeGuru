import { AlertTriangle, CheckCircle2, CircleHelp, Clock } from "lucide-react";
import type { PriceConfidence } from "../../services/pricing";
import { cn } from "../../utils/cn";

const STYLES: Record<PriceConfidence, { className: string; icon: typeof CheckCircle2 }> = {
  verified: {
    className: "border-[#2fbf71]/40 bg-[#2fbf71]/10 text-[#6fe3a5]",
    icon: CheckCircle2,
  },
  indicative: {
    className: "border-[#7cc4ff]/40 bg-[#7cc4ff]/10 text-[#a5d8ff]",
    icon: CircleHelp,
  },
  stale: {
    className: "border-[#f5a524]/40 bg-[#f5a524]/10 text-[#f7c568]",
    icon: Clock,
  },
  unverified: {
    className: "border-[#f04452]/40 bg-[#f04452]/10 text-[#ff9aa0]",
    icon: AlertTriangle,
  },
  unavailable: {
    className: "border-[var(--border)] bg-[var(--bg-soft)] text-[var(--muted)]",
    icon: AlertTriangle,
  },
};

/**
 * Small, honest confidence marker shown next to any price. The tooltip always
 * explains *why* a figure is marked the way it is.
 */
export default function PriceConfidenceBadge({
  confidence,
  label,
  reason,
  className,
}: {
  confidence: PriceConfidence;
  label: string;
  reason?: string;
  className?: string;
}) {
  const style = STYLES[confidence];
  const Icon = style.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em]",
        style.className,
        className
      )}
      title={reason}
    >
      <Icon size={11} aria-hidden="true" />
      {label}
    </span>
  );
}
