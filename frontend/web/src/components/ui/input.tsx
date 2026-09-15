import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // STEP 8.23: hairline field, teal focus glow, invalid state styling
          // (pages already set aria-invalid — no API change).
          'flex min-h-[44px] w-full rounded-lg border border-input bg-slate-800/50 px-3 py-2.5 text-sm text-slate-100 shadow-[inset_0_1px_2px_rgb(0_0_0/0.3)] ring-offset-background transition-all duration-150 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 hover:border-slate-600 focus-visible:outline-none focus-visible:border-teal-300/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 focus-visible:shadow-glow-sm disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-red-500/70 aria-[invalid=true]:focus-visible:border-red-400/70 aria-[invalid=true]:focus-visible:ring-red-500/40',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
