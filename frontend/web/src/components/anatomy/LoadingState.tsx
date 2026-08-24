export default function LoadingState(): JSX.Element {
  return (
    <div className="flex h-full w-full items-center justify-center bg-slate-950">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-teal-400" />
        <p className="text-xs tracking-widest text-slate-400">LOADING MODEL</p>
      </div>
    </div>
  );
}
