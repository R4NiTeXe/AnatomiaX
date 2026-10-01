import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import PagePlaceholder from '@/components/PagePlaceholder';
import SimulationPage from '../SimulationPage';
import MedicalLabPage from '../MedicalLabPage';
import AiHealthPage from '../AiHealthPage';
import ClinicalCasesPage from '../ClinicalCasesPage';
import NotFoundPage from '../NotFoundPage';

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('placeholder and static pages', () => {
  it('renders the shared placeholder with title and description', () => {
    renderWithRouter(<PagePlaceholder title="Test Area" description="Coming soon." />);
    expect(screen.getByText('Test Area')).toBeInTheDocument();
    expect(screen.getByText('Coming soon.')).toBeInTheDocument();
  });

  it.each([
    ['Simulation', SimulationPage],
    ['MedicalLab', MedicalLabPage],
    ['AiHealth', AiHealthPage],
    ['ClinicalCases', ClinicalCasesPage],
  ])('renders the %s placeholder route', (_name, Page) => {
    const { unmount } = renderWithRouter(<Page />);
    expect(document.body.textContent ?? '').not.toHaveLength(0);
    unmount();
  });

  it('renders the 404 page with a home link', () => {
    renderWithRouter(<NotFoundPage />);
    expect(screen.getByTestId('not-found-title')).toBeInTheDocument();
    expect(screen.getByTestId('not-found-home')).toHaveAttribute('href', '/');
  });
});
