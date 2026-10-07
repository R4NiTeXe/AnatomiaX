import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import RequireAuth from '@/features/auth/components/RequireAuth';
import AppShell from '@/components/layout/AppShell';
import NotFoundPage from '@/pages/NotFoundPage';

const HomePage = lazy(() => import('@/pages/HomePage'));
const HumanPage = lazy(() => import('@/features/anatomy/pages/HumanPage'));
const HumanTestPage = lazy(() => import('@/features/anatomy/pages/HumanTestPage'));
const AiHealthPage = lazy(() => import('@/pages/AiHealthPage'));
const MedicalLabPage = lazy(() => import('@/pages/MedicalLabPage'));
const SimulationPage = lazy(() => import('@/pages/SimulationPage'));
const ClinicalCasesPage = lazy(() => import('@/pages/ClinicalCasesPage'));
const LearnPage = lazy(() => import('@/features/progress/pages/LearnPage'));
const ModulePage = lazy(() => import('@/features/progress/pages/ModulePage'));
const LoginPage = lazy(() => import('@/features/auth/pages/LoginPage'));
const RegisterPage = lazy(() => import('@/features/auth/pages/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('@/features/auth/pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@/features/auth/pages/ResetPasswordPage'));
const AccountPage = lazy(() => import('@/pages/AccountPage'));
const AuthCallbackPage = lazy(() => import('@/features/auth/pages/AuthCallbackPage'));
const CohortsPage = lazy(() => import('@/features/cohorts/pages/CohortsPage'));
const CohortDetailPage = lazy(() => import('@/features/cohorts/pages/CohortDetailPage'));
const CohortDashboardPage = lazy(() => import('@/features/cohorts/pages/CohortDashboardPage'));
const QuizzesPage = lazy(() => import('@/features/quizzes/pages/QuizzesPage'));
const QuizTakePage = lazy(() => import('@/features/quizzes/pages/QuizTakePage'));
const TeachQuizzesPage = lazy(() => import('@/features/quizzes/pages/TeachQuizzesPage'));
const TeachQuizDetailPage = lazy(() => import('@/features/quizzes/pages/TeachQuizDetailPage'));

function RouteFallback(): JSX.Element {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950">
      <p className="text-sm text-slate-500">Loading…</p>
    </div>
  );
}

export default function App(): JSX.Element {
  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-slate-900 focus:px-4 focus:py-2 focus:text-sm focus:text-slate-100 focus:ring-2 focus:ring-teal-400"
      >
        Skip to content
      </a>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/learn" element={<LearnPage />} />
            <Route path="/learn/:systemKey" element={<ModulePage />} />
            <Route
              path="/account"
              element={
                <RequireAuth>
                  <AccountPage />
                </RequireAuth>
              }
            />
            <Route
              path="/cohorts"
              element={
                <RequireAuth>
                  <CohortsPage />
                </RequireAuth>
              }
            />
            <Route
              path="/cohorts/:id/dashboard"
              element={
                <RequireAuth>
                  <CohortDashboardPage />
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
            <Route
              path="/quizzes"
              element={
                <RequireAuth>
                  <QuizzesPage />
                </RequireAuth>
              }
            />
            <Route
              path="/quizzes/:id"
              element={
                <RequireAuth>
                  <QuizTakePage />
                </RequireAuth>
              }
            />
            <Route
              path="/teach/quizzes"
              element={
                <RequireAuth>
                  <TeachQuizzesPage />
                </RequireAuth>
              }
            />
            <Route
              path="/teach/quizzes/:id"
              element={
                <RequireAuth>
                  <TeachQuizDetailPage />
                </RequireAuth>
              }
            />
          </Route>

          <Route path="/human" element={<HumanPage />} />
          {process.env.NODE_ENV !== 'production' && (
            <Route path="/human-test" element={<HumanTestPage />} />
          )}
          <Route path="/ai-health" element={<AiHealthPage />} />
          <Route path="/medical-lab" element={<MedicalLabPage />} />
          <Route path="/simulation" element={<SimulationPage />} />
          <Route path="/clinical-cases" element={<ClinicalCasesPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/anatomy" element={<Navigate to="/human" replace />} />
          <Route path="/progress" element={<Navigate to="/learn" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </>
  );
}
