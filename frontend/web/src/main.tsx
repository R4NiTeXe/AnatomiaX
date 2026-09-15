import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import App from './App';
import '@/lib/devHealth';
import { AuthProvider } from '@/components/auth/AuthProvider';
import AppErrorBoundary from '@/components/AppErrorBoundary';
import { MotionRoot } from '@/components/motion';

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MotionRoot>
      <AppErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </AuthProvider>
        </QueryClientProvider>
      </AppErrorBoundary>
    </MotionRoot>
  </React.StrictMode>
);
