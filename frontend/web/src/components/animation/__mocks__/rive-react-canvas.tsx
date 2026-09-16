import { forwardRef } from 'react';

export const Rive = forwardRef<HTMLDivElement, Record<string, unknown>>(function Rive(props, ref) {
  return (
    <div
      ref={ref}
      className={props.className as string}
      data-testid="rive-mock"
      data-src={props.src as string}
    />
  );
});

export function useRive() {
  return { rive: null, RiveComponent: Rive };
}
