import { Suspense, lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import NotFoundPage from '@/pages/NotFoundPage';

const HomePage = lazy(() => import('@/pages/HomePage'));
const HumanPage = lazy(() => import('@/pages/HumanPage'));
const HumanTestPage = lazy(() => import('@/pages/HumanTestPage'));
const AiHealthPage = lazy(() => import('@/pages/AiHealthPage'));
const MedicalLabPage = lazy(() => import('@/pages/MedicalLabPage'));
const SimulationPage = lazy(() => import('@/pages/SimulationPage'));
const ClinicalCasesPage = lazy(() => import('@/pages/ClinicalCasesPage'));
const LearnPage = lazy(() => import('@/pages/LearnPage'));

function RouteFallback(): JSX.Element {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950">
      <p className="text-sm text-slate-500">Loading…</p>
    </div>
  );
}

export default function App(): JSX.Element {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/human" element={<HumanPage />} />
        <Route path="/human-test" element={<HumanTestPage />} />
        <Route path="/ai-health" element={<AiHealthPage />} />
        <Route path="/medical-lab" element={<MedicalLabPage />} />
        <Route path="/simulation" element={<SimulationPage />} />
        <Route path="/clinical-cases" element={<ClinicalCasesPage />} />
        <Route path="/learn" element={<LearnPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
