import { googleLoginUrl } from '@/lib/auth';
import { Button } from '@/components/ui/button';

/** Full-page navigation to the existing backend Google entrypoint. */
export default function GoogleSignInButton({
  testId = 'google-signin',
}: {
  testId?: string;
}): JSX.Element {
  return (
    <Button variant="outline" className="w-full" asChild>
      <a href={googleLoginUrl()} data-testid={testId}>
        Continue with Google
      </a>
    </Button>
  );
}
