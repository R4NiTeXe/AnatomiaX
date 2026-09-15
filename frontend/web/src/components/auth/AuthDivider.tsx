/**
 * STEP 8.24 shared form/Google divider — visual hierarchy between the
 * credential submit and the OAuth entry. Decorative; screen readers skip it.
 */
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
