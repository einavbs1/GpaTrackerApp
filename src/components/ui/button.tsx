import { forwardRef } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "press inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:size-[1.05em] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-ink shadow-soft hover:bg-primary-hover hover:-translate-y-0.5 hover:shadow-lifted",
        neutral:
          "border border-line bg-raised/60 text-ink hover:-translate-y-0.5 hover:border-line-strong hover:bg-raised",
        ghost: "text-ink-muted hover:bg-raised hover:text-ink",
        soft: "bg-primary-soft text-primary hover:bg-primary-soft hover:-translate-y-0.5",
        danger: "border border-critical/30 bg-critical-soft text-critical hover:border-critical/60",
        link: "text-primary underline-offset-4 hover:underline"
      },
      size: {
        sm: "h-9 px-3.5 text-sm",
        md: "h-11 px-5 text-sm",
        lg: "h-13 px-7 text-base",
        icon: "size-10 rounded-full p-0",
        "icon-sm": "size-9 rounded-full p-0"
      }
    },
    defaultVariants: { variant: "neutral", size: "md" }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type = "button", ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp ref={ref} type={asChild ? undefined : type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
    );
  }
);
Button.displayName = "Button";

export { buttonVariants };
