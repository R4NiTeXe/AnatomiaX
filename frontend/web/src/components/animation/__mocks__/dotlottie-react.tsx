import { forwardRef } from 'react';

export const DotLottieReact = forwardRef<HTMLDivElement, Record<string, unknown>>(
  function DotLottieReact(props, ref) {
    return (
      <div
        ref={ref}
        className={props.className as string}
        data-testid="dotlottie-mock"
        data-src={props.src as string}
      />
    );
  }
);
