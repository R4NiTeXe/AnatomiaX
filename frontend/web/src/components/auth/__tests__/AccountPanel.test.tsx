import { screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { renderWithAppProviders as render } from '@/test-utils';
import { __resetAuthForTests } from '@/lib/auth';
import AccountPanel from '../AccountPanel';

function jsonResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 || status === 201 ? 'OK' : 'Error',
    headers: { get: () => 'application/json' },
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as unknown as Response;
}

const USER = { id: 'u-1', email: 'a@b.c', name: null, role: 'STUDENT', createdAt: '2026-01-01' };
const SESSION = { user: USER, accessToken: 'access-1', refreshToken: 'refresh-1' };

describe('AccountPanel', () => {
  beforeEach(() => {
    __resetAuthForTests();
    jest.restoreAllMocks();
    global.fetch = jest.fn(() => Promise.resolve(jsonResponse({}, 404))) as unknown as typeof fetch;
  });

  it('logs in and shows the account with a sign-out button', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) =>
      Promise.resolve(
        (url as string).endsWith('/api/v1/auth/login')
          ? jsonResponse(SESSION)
          : jsonResponse({}, 404)
      )
    );
    render(<AccountPanel />);
    await screen.findByTestId('anatomy-account-login');
    fireEvent.change(screen.getByTestId('anatomy-account-email'), { target: { value: 'a@b.c' } });
    fireEvent.change(screen.getByTestId('anatomy-account-password'), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByTestId('anatomy-account-login'));
    await screen.findByTestId('anatomy-account-user', {}, { timeout: 4000 });
    expect(screen.getByTestId('anatomy-account-user')).toHaveTextContent('a@b.c');
    expect(screen.getByTestId('anatomy-account-logout')).toBeInTheDocument();
  });

  it('shows a friendly error on invalid credentials', async () => {
    (global.fetch as jest.Mock).mockImplementation(() =>
      Promise.resolve(jsonResponse({ message: 'Unauthorized' }, 401))
    );
    render(<AccountPanel />);
    await screen.findByTestId('anatomy-account-login');
    fireEvent.change(screen.getByTestId('anatomy-account-email'), { target: { value: 'a@b.c' } });
    fireEvent.change(screen.getByTestId('anatomy-account-password'), {
      target: { value: 'wrong-pass' },
    });
    fireEvent.click(screen.getByTestId('anatomy-account-login'));
    await screen.findByTestId('anatomy-account-error', {}, { timeout: 4000 });
    expect(screen.getByTestId('anatomy-account-error')).toHaveTextContent(
      'Invalid email or password.'
    );
  });

  it('registers a new account', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) =>
      Promise.resolve(
        (url as string).endsWith('/api/v1/auth/register')
          ? jsonResponse(SESSION, 201)
          : jsonResponse({}, 404)
      )
    );
    render(<AccountPanel />);
    await screen.findByTestId('anatomy-account-register');
    fireEvent.change(screen.getByTestId('anatomy-account-email'), { target: { value: 'new@b.c' } });
    fireEvent.change(screen.getByTestId('anatomy-account-password'), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByTestId('anatomy-account-register'));
    await screen.findByTestId('anatomy-account-user', {}, { timeout: 4000 });
  });

  it('signs out and returns to the form', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      const u = url as string;
      if (u.endsWith('/api/v1/auth/login')) return Promise.resolve(jsonResponse(SESSION));
      if (u.endsWith('/api/v1/auth/logout')) return Promise.resolve(jsonResponse({ status: 'ok' }));
      return Promise.resolve(jsonResponse({}, 404));
    });
    render(<AccountPanel />);
    await screen.findByTestId('anatomy-account-login');
    fireEvent.change(screen.getByTestId('anatomy-account-email'), { target: { value: 'a@b.c' } });
    fireEvent.change(screen.getByTestId('anatomy-account-password'), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByTestId('anatomy-account-login'));
    await screen.findByTestId('anatomy-account-logout', {}, { timeout: 4000 });
    fireEvent.click(screen.getByTestId('anatomy-account-logout'));
    await screen.findByTestId('anatomy-account-login', {}, { timeout: 4000 });
    expect(screen.queryByTestId('anatomy-account-user')).not.toBeInTheDocument();
  });
});
