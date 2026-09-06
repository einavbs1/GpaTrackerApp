import { forwardRef, type ReactNode } from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-11 w-full rounded-2xl border border-line bg-sunken px-4 text-ink outline-none",
        "placeholder:text-ink-faint",
        "transition-[border-color,box-shadow,background-color] duration-200 ease-out",
        "hover:border-line-strong",
        "focus:border-primary focus:ring-4 focus:ring-primary-soft focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-45",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

export const Label = forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn("text-xs font-semibold tracking-wide text-ink-muted", className)}
    {...props}
  />
));
Label.displayName = "Label";

interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  required?: boolean;
  optional?: boolean;
  className?: string;
  children: ReactNode;
}

export function Field({ label, hint, required, optional, className, children }: FieldProps) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-ink-muted">
        {label}
        {required && <span className="text-critical">{t.course.required}</span>}
        {optional && <span className="font-normal text-ink-faint">{t.settings.account.optional}</span>}
      </span>
      {children}
      {hint && <span className="text-xs leading-relaxed text-ink-faint">{hint}</span>}
    </label>
  );
}
