import { type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-3xl border border-line bg-surface", className)} {...props} />;
}

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-2xs font-semibold whitespace-nowrap",
  {
    variants: {
      variant: {
        muted: "bg-raised text-ink-muted",
        outline: "border border-line text-ink-muted",
        primary: "bg-primary-soft text-primary",
        hit: "bg-caution-soft text-caution"
      }
    },
    defaultVariants: { variant: "muted" }
  }
);

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export function GpaPill({ value, className }: { value: string; className?: string }) {
  return (
    <span
      className={cn(
        "tnum inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary-soft px-3 py-1",
        "text-2xs font-bold text-primary",
        className
      )}
    >
      {value}
    </span>
  );
}

const BANNER_ICONS = {
  error: XCircle,
  warning: AlertTriangle,
  success: CheckCircle2,
  info: Info
} as const;

const bannerVariants = cva("flex items-start gap-3 rounded-2xl border p-3.5 text-sm animate-enter", {
  variants: {
    tone: {
      error: "border-critical/25 bg-critical-soft text-critical",
      warning: "border-caution/25 bg-caution-soft text-caution",
      success: "border-positive/25 bg-positive-soft text-positive",
      info: "border-info/25 bg-info-soft text-info"
    }
  },
  defaultVariants: { tone: "info" }
});

export function Banner({
  tone = "info",
  children,
  className
}: {
  tone?: "error" | "warning" | "success" | "info";
  children: ReactNode;
  className?: string;
}) {
  const Glyph = BANNER_ICONS[tone];
  return (
    <div role="status" className={cn(bannerVariants({ tone }), className)}>
      <Glyph className="mt-0.5 size-4 shrink-0" />
      <span className="min-w-0 flex-1 leading-relaxed">{children}</span>
    </div>
  );
}

export function SectionHeading({
  title,
  hint,
  action,
  className
}: {
  title: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-3", className)}>
      <div className="min-w-0">
        <h3 className="text-lg text-ink-strong">{title}</h3>
        {hint && <p className="mt-1 max-w-prose text-sm leading-relaxed text-ink-muted">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-dashed border-line px-6 py-12 text-center text-sm text-ink-muted",
        className
      )}
    >
      {children}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        "inline-block size-6 animate-spin rounded-full border-2 border-line border-t-primary",
        className
      )}
    />
  );
}
