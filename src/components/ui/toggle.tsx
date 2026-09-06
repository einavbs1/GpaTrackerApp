import { forwardRef, type ReactNode } from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const Checkbox = forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "press peer size-5 shrink-0 rounded-md border border-line-strong bg-sunken",
      "data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-ink",
      "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-soft",
      "disabled:cursor-not-allowed disabled:opacity-40",
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
      <Check className="size-3.5" strokeWidth={3.5} />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = "Checkbox";

interface CheckboxFieldProps extends React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> {
  children: ReactNode;
}

export function CheckboxField({ children, className, ...props }: CheckboxFieldProps) {
  return (
    <label
      className={cn(
        "press flex cursor-pointer items-center gap-2.5 rounded-2xl border border-transparent px-1 py-1.5 text-sm text-ink",
        "hover:border-line hover:bg-raised/50",
        className
      )}
    >
      <Checkbox {...props} />
      <span className="min-w-0 flex-1">{children}</span>
    </label>
  );
}

export const Switch = forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      "peer inline-flex h-7 w-12 shrink-0 items-center rounded-full border border-line bg-sunken",
      "transition-colors duration-300 ease-out data-[state=checked]:border-primary data-[state=checked]:bg-primary",
      "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-soft",
      className
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        "pointer-events-none block size-5 rounded-full bg-ink shadow-soft",
        "transition-transform duration-300 ease-out",
        "translate-x-[-3px] rtl:translate-x-[3px]",
        "data-[state=checked]:translate-x-[-23px] data-[state=checked]:bg-primary-ink rtl:data-[state=checked]:translate-x-[23px]"
      )}
    />
  </SwitchPrimitive.Root>
));
Switch.displayName = "Switch";
