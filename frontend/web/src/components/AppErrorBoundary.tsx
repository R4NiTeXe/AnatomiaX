import * as React from 'react';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: unknown | null;
}

export default class AppErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    const requestId = error instanceof ApiError ? error.requestId : undefined;
    // Log for owners; never surface stack to users.
    // eslint-disable-next-line no-console
    console.error(
      '[AppErrorBoundary]',
      requestId ? `(requestId: ${requestId})` : '',
      error,
      info.componentStack
    );
  }

  private handleReload = () => {
    window.location.reload();
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      const requestId =
        this.state.error instanceof ApiError ? this.state.error.requestId : undefined;
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
          <Card className="w-full max-w-md" data-testid="app-error-fallback">
            <CardHeader>
              <CardTitle>Something went wrong</CardTitle>
              <CardDescription>
                An unexpected error occurred. Your data is safe — please try again.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {requestId ? (
                <p className="text-xs text-slate-500" data-testid="app-error-request-id">
                  Reference: {requestId}
                </p>
              ) : null}
              <div className="flex gap-2">
                <Button onClick={this.handleReload} data-testid="app-error-reload">
                  Reload
                </Button>
                <Button variant="outline" asChild>
                  <a href="/" data-testid="app-error-home">
                    Go home
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }
    return this.props.children;
  }
}
