export default function AuthDivider({
  label = 'or continue with',
}: {
  label?: string;
}): JSX.Element {
  return (
    <div className="flex items-center gap-3" aria-hidden="true">
      <span className="h-px flex-1 bg-slate-800" />
      <span className="text-[0.7rem] font-medium tracking-widest text-slate-500">{label}</span>
      <span className="h-px flex-1 bg-slate-800" />
    </div>
  );
}
