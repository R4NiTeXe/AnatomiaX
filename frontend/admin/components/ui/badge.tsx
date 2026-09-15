import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded px-2 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'bg-slate-800 text-slate-200',
        secondary: 'bg-slate-800 text-slate-400',
        outline: 'border border-slate-700 text-slate-300',
        teal: 'bg-teal-500/20 text-teal-300',
        destructive: 'bg-red-950/40 border border-red-900/70 text-red-200',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), 'uppercase', className)} {...props} />;
}

export { Badge, badgeVariants };
