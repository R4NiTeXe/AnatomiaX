import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import { ActiveNavPill } from '../motion/ActiveNavPill';
import SectionHeader from '../learning/SectionHeader';
import AuthErrorNotice from '../auth/AuthErrorNotice';
import AuthLayout from '../auth/AuthLayout';

describe('presentational components', () => {
  it('renders the active nav pill with default and custom ids', () => {
    const { unmount } = render(<ActiveNavPill />);
    expect(document.querySelector('[aria-hidden="true"]')).not.toBeNull();
    unmount();
    render(<ActiveNavPill id="custom-pill" />);
    expect(document.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it('renders section headers with optional description and action', () => {
    const { rerender } = render(<SectionHeader kicker="Kick" title="Title" />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Title');
    expect(screen.queryByText('Desc')).not.toBeInTheDocument();
    rerender(
      <SectionHeader
        kicker="Kick"
        title="Title"
        description="Desc"
        action={<button type="button">Go</button>}
      />
    );
    expect(screen.getByText('Desc')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go' })).toBeInTheDocument();
  });

  it('renders nothing without an auth error', () => {
    const { container } = render(<AuthErrorNotice error={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders auth errors with details and request reference', () => {
    render(
      <AuthErrorNotice
        error={{ message: 'Invalid credentials', details: ['email'], requestId: 'req-1' }}
      />
    );
    expect(screen.getByTestId('auth-error')).toHaveTextContent('Invalid credentials');
    expect(screen.getByText('email')).toBeInTheDocument();
    expect(screen.getByTestId('auth-error-request-id')).toHaveTextContent('req-1');
  });

  it('renders auth errors without optional details', () => {
    render(<AuthErrorNotice error={{ message: 'Oops' }} />);
    expect(screen.getByTestId('auth-error')).toHaveTextContent('Oops');
    expect(screen.queryByTestId('auth-error-request-id')).not.toBeInTheDocument();
  });

  it('renders the auth layout with subtitle and footer', () => {
    render(
      <MemoryRouter>
        <AuthLayout title="Sign in" subtitle="Welcome back" footer={<span>foot</span>}>
          <span>child</span>
        </AuthLayout>
      </MemoryRouter>
    );
    expect(screen.getByText('Sign in')).toBeInTheDocument();
    expect(screen.getByText('Welcome back')).toBeInTheDocument();
    expect(screen.getByText('foot')).toBeInTheDocument();
    expect(screen.getByText('child')).toBeInTheDocument();
  });

  it('renders the auth layout without optional parts', () => {
    render(
      <MemoryRouter>
        <AuthLayout title="Sign in">
          <span>child</span>
        </AuthLayout>
      </MemoryRouter>
    );
    expect(screen.getByText('Sign in')).toBeInTheDocument();
  });
});
