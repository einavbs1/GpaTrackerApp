import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Height animation via grid-template-rows so content keeps its natural size —
 * no max-height guessing and no layout jump when a semester gains courses.
 */
export function Collapse({ open, id, children }: { open: boolean; id?: string; children: ReactNode }) {
  return (
    <div
      id={id}
      className={cn(
        "grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none",
        open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
      )}
    >
      <div className={cn("min-h-0 overflow-hidden", open ? "visible" : "invisible")}>{children}</div>
    </div>
  );
}

export function Chevron({ open, className }: { open: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cn(
        "size-4 shrink-0 text-ink-faint transition-transform duration-300 ease-out motion-reduce:transition-none",
        // Points inward at rest; RTL flips the resting direction, not the open state.
        open ? "rotate-90" : "rotate-0 rtl:rotate-180",
        className
      )}
    >
      <path fill="currentColor" d="M9 6l6 6-6 6z" />
    </svg>
  );
}
