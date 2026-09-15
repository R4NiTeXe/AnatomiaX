import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const alertVariants = cva(
  // STEP 8.23: soft depth so inline feedback reads as a raised surface.
  'relative w-full rounded-lg border p-3 text-sm shadow-soft [&>svg]:absolute [&>svg]:left-3 [&>svg]:top-3 [&>svg+div]:translate-y-[-3px]',
  {
    variants: {
      variant: {
        default: 'border-slate-800 bg-slate-900/40 text-slate-200',
        destructive: 'border-red-900/60 bg-red-950/40 text-red-200',
        warning: 'border-amber-900/60 bg-amber-950/40 text-amber-200',
        success: 'border-teal-900/60 bg-teal-950/40 text-teal-200',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div ref={ref} role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
));
Alert.displayName = 'Alert';

const AlertTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h5
      ref={ref}
      className={cn('mb-1 font-medium leading-none tracking-tight', className)}
      {...props}
    />
  )
);
AlertTitle.displayName = 'AlertTitle';

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('text-sm [&_p]:leading-relaxed', className)} {...props} />
));
AlertDescription.displayName = 'AlertDescription';

export { Alert, AlertTitle, AlertDescription };
