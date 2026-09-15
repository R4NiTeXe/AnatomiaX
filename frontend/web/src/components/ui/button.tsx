import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium ring-offset-background transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none',
  {
    variants: {
      variant: {
        // STEP 8.23: single premium primary — solid clinical teal, restrained glow.
        // `primary` kept as a compat alias (identical treatment).
        default:
          'bg-teal-400 text-slate-950 shadow-glow hover:bg-teal-300 hover:shadow-[0_0_28px_-4px_rgb(45_212_191/0.6)]',
        primary:
          'bg-teal-400 text-slate-950 shadow-glow hover:bg-teal-300 hover:shadow-[0_0_28px_-4px_rgb(45_212_191/0.6)]',
        destructive: 'border border-red-900/70 bg-red-950/40 text-red-200 hover:bg-red-950/70',
        outline:
          'border border-slate-700/80 bg-slate-900/40 text-slate-200 shadow-soft hover:border-slate-600 hover:bg-slate-800/70',
        secondary: 'bg-slate-800 text-slate-100 shadow-soft hover:bg-slate-700',
        ghost: 'text-slate-300 hover:bg-slate-800/80 hover:text-white',
        link: 'text-teal-300 underline-offset-4 hover:text-teal-200 hover:underline',
      },
      size: {
        default: 'min-h-[44px] px-4 py-2.5',
        sm: 'min-h-9 px-3 text-xs',
        lg: 'min-h-11 px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
