import { Suspense, lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import RequireAuth from '@/components/auth/RequireAuth';
import NotFoundPage from '@/pages/NotFoundPage';

const HomePage = lazy(() => import('@/pages/HomePage'));
const HumanPage = lazy(() => import('@/pages/HumanPage'));
const HumanTestPage = lazy(() => import('@/pages/HumanTestPage'));
const AiHealthPage = lazy(() => import('@/pages/AiHealthPage'));
const MedicalLabPage = lazy(() => import('@/pages/MedicalLabPage'));
const SimulationPage = lazy(() => import('@/pages/SimulationPage'));
const ClinicalCasesPage = lazy(() => import('@/pages/ClinicalCasesPage'));
const LearnPage = lazy(() => import('@/pages/LearnPage'));
const LoginPage = lazy(() => import('@/pages/LoginPage'));
const RegisterPage = lazy(() => import('@/pages/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('@/pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@/pages/ResetPasswordPage'));
const AccountPage = lazy(() => import('@/pages/AccountPage'));
const AuthCallbackPage = lazy(() => import('@/pages/AuthCallbackPage'));
const CohortsPage = lazy(() => import('@/pages/CohortsPage'));
const CohortDetailPage = lazy(() => import('@/pages/CohortDetailPage'));

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
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route
          path="/account"
          element={
            <RequireAuth>
              <AccountPage />
            </RequireAuth>
          }
        />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route
          path="/cohorts"
          element={
            <RequireAuth>
              <CohortsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/cohorts/:id"
          element={
            <RequireAuth>
              <CohortDetailPage />
            </RequireAuth>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
