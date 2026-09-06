import { type ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Drawer } from "vaul";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsDesktop } from "@/hooks/useMediaQuery";
import { Button } from "@/components/ui/button";

interface ResponsiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  className?: string;
  children: ReactNode;
}

/**
 * Centred dialog from `md` up, native bottom sheet below it. One component so the
 * callers never branch on viewport themselves.
 */
export function ResponsiveDialog({
  open,
  onOpenChange,
  title,
  description,
  footer,
  className,
  children
}: ResponsiveDialogProps) {
  const isDesktop = useIsDesktop();

  if (isDesktop) {
    return (
      <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="animate-fade fixed inset-0 z-40 bg-black/45 backdrop-blur-sm" />
          <DialogPrimitive.Content
            className={cn(
              "animate-enter fixed start-1/2 top-1/2 z-50 flex max-h-[88dvh] w-[min(44rem,calc(100vw-2.5rem))]",
              "-translate-y-1/2 translate-x-1/2 flex-col rounded-3xl border border-line bg-surface shadow-float rtl:-translate-x-1/2",
              className
            )}
          >
            <header className="flex items-start gap-4 p-6 pb-4">
              <div className="min-w-0 flex-1">
                <DialogPrimitive.Title className="text-xl text-ink-strong">{title}</DialogPrimitive.Title>
                {description && (
                  <DialogPrimitive.Description className="mt-1.5 text-sm leading-relaxed text-ink-muted">
                    {description}
                  </DialogPrimitive.Description>
                )}
              </div>
              <DialogPrimitive.Close asChild>
                <Button variant="ghost" size="icon-sm" aria-label={String(title)}>
                  <X />
                </Button>
              </DialogPrimitive.Close>
            </header>
            <div className="scroll-region min-h-0 flex-1 px-6 pb-2">{children}</div>
            {footer && <footer className="flex flex-wrap items-center justify-end gap-2.5 p-6 pt-4">{footer}</footer>}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    );
  }

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/45" />
        <Drawer.Content
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-sheet border-t border-line bg-surface",
            "pb-safe outline-none",
            className
          )}
        >
          <div className="mx-auto mt-3 h-1.5 w-11 shrink-0 rounded-full bg-line-strong" aria-hidden="true" />
          <header className="px-5 pb-3 pt-4">
            <Drawer.Title className="text-lg text-ink-strong">{title}</Drawer.Title>
            {description && (
              <Drawer.Description className="mt-1.5 text-sm leading-relaxed text-ink-muted">
                {description}
              </Drawer.Description>
            )}
          </header>
          <div className="scroll-region min-h-0 flex-1 px-5 pb-2">{children}</div>
          {footer && (
            <footer className="flex flex-wrap items-center justify-end gap-2.5 border-t border-line px-5 py-4">
              {footer}
            </footer>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
