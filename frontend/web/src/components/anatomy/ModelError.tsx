type ModelErrorProps = {
  message?: string;
};

export default function ModelError({ message }: ModelErrorProps): JSX.Element {
  return (
    <div className="flex h-full w-full items-center justify-center bg-slate-950 p-6 text-center">
      <div className="max-w-sm">
        <p className="text-sm font-medium text-slate-200">Model could not be loaded</p>
        <p className="mt-1 text-xs leading-5 text-slate-400">
          {message ?? 'The requested anatomy model was not found or failed to load.'}
        </p>
        <p className="mt-3 text-xs text-slate-500">Please try again or select a different model.</p>
      </div>
    </div>
  );
}
