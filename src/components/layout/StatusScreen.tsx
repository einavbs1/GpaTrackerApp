import { type ReactNode } from "react";
import { Spinner } from "@/components/ui/surface";
import { cn } from "@/lib/utils";

export function VersionFooter({ className }: { className?: string }) {
  return (
    <footer
      className={cn("tnum pb-safe px-safe pt-8 text-center text-2xs text-ink-faint", className)}
      title={`${__GIT_COMMIT__} · ${__BUILD_DATE__}`}
    >
      v{__APP_VERSION__} · {__GIT_COMMIT__} · {__BUILD_DATE__}
    </footer>
  );
}

export function StatusScreen({ message }: { message: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6">
      <div className="animate-enter flex flex-col items-center gap-5">
        <Spinner className="size-8" />
        <p className="text-sm text-ink-muted">{message}</p>
      </div>
      <VersionFooter className="absolute inset-x-0 bottom-0 pb-6" />
    </div>
  );
}
