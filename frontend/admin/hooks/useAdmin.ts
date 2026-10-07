'use client';

import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';
import type { BankQuizStats, BankQuizView } from '@/lib/quizzes';

export interface AdminOverview {
  totalUsers: number;
  byRole: { STUDENT: number; TEACHER: number; ADMIN: number };
  cohortCount: number;
  archivedCohortCount: number;
  recentUsers: Array<{
    id: string;
    email: string | null;
    name: string | null;
    role: string;
    createdAt: string;
  }>;
  recentCohorts: Array<{
    id: string;
    name: string;
    archivedAt: string | null;
    createdAt: string;
    memberCount: number;
    createdById: string | null;
  }>;
}

export interface PaginatedUsers {
  items: Array<{
    id: string;
    email: string | null;
    name: string | null;
    role: string;
    createdAt: string;
  }>;
  total: number;
  page: number;
  limit: number;
}

export interface PaginatedCohorts {
  items: Array<{
    id: string;
    name: string;
    institutionLabel: string | null;
    archivedAt: string | null;
    createdAt: string;
    memberCount: number;
  }>;
  total: number;
  page: number;
  limit: number;
}

export function useAdminOverview() {
  return useQuery({
    queryKey: ['admin', 'overview'],
    queryFn: () => apiRequest<AdminOverview>('/api/v1/admin/overview'),
    staleTime: 30_000,
    retry: false,
  });
}

export function useAdminUsers(params: {
  search?: string;
  role?: string;
  page?: number;
  limit?: number;
}) {
  const { search, role, page, limit } = params;
  return useQuery({
    queryKey: ['admin', 'users', search ?? '', role ?? 'ALL', page ?? 1, limit ?? 20],
    queryFn: () => {
      const sp = new URLSearchParams();
      if (search) sp.set('search', search);
      if (role) sp.set('role', role);
      if (page) sp.set('page', String(page));
      if (limit) sp.set('limit', String(limit));
      const qs = sp.toString();
      return apiRequest<PaginatedUsers>(`/api/v1/admin/users${qs ? `?${qs}` : ''}`);
    },
    staleTime: 15_000,
    retry: false,
  });
}

export function useAdminCohorts(params: {
  search?: string;
  archived?: string;
  page?: number;
  limit?: number;
}) {
  const { search, archived, page, limit } = params;
  return useQuery({
    queryKey: ['admin', 'cohorts', search ?? '', archived ?? 'all', page ?? 1, limit ?? 20],
    queryFn: () => {
      const sp = new URLSearchParams();
      if (search) sp.set('search', search);
      if (archived) sp.set('archived', archived);
      if (page) sp.set('page', String(page));
      if (limit) sp.set('limit', String(limit));
      const qs = sp.toString();
      return apiRequest<PaginatedCohorts>(`/api/v1/admin/cohorts${qs ? `?${qs}` : ''}`);
    },
    staleTime: 15_000,
    retry: false,
  });
}

export interface AdminUserDetail {
  user: {
    id: string;
    email: string | null;
    name: string | null;
    role: string;
    createdAt: string;
  };
  deactivatedAt: string | null;
  stats: { memberships: number; quizAttempts: number; cohortsCreated: number };
}

export interface AuditLogEntry {
  id: string;
  actorId: string;
  actorRole: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface PaginatedAuditLogs {
  items: AuditLogEntry[];
  total: number;
  page: number;
  limit: number;
}

export function useAdminUser(id: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'user', id ?? ''],
    queryFn: () => apiRequest<AdminUserDetail>(`/api/v1/admin/users/${id}`),
    enabled: !!id,
    staleTime: 15_000,
    retry: false,
  });
}

export async function setUserRole(id: string, role: string): Promise<AdminUserDetail> {
  return apiRequest<AdminUserDetail>(`/api/v1/admin/users/${id}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
}

export async function deactivateUser(id: string): Promise<AdminUserDetail> {
  return apiRequest<AdminUserDetail>(`/api/v1/admin/users/${id}/deactivate`, { method: 'POST' });
}

export async function restoreUser(id: string): Promise<AdminUserDetail> {
  return apiRequest<AdminUserDetail>(`/api/v1/admin/users/${id}/restore`, { method: 'POST' });
}

export async function deleteUserAccount(id: string): Promise<{ status: string }> {
  return apiRequest<{ status: string }>(`/api/v1/admin/users/${id}`, { method: 'DELETE' });
}

export function useAuditLogs(params: {
  action?: string;
  actorId?: string;
  targetType?: string;
  page?: number;
  limit?: number;
}) {
  const { action, actorId, targetType, page, limit } = params;
  return useQuery({
    queryKey: [
      'admin',
      'audit-logs',
      action ?? '',
      actorId ?? '',
      targetType ?? '',
      page ?? 1,
      limit ?? 20,
    ],
    queryFn: () => {
      const sp = new URLSearchParams();
      if (action) sp.set('action', action);
      if (actorId) sp.set('actorId', actorId);
      if (targetType) sp.set('targetType', targetType);
      if (page) sp.set('page', String(page));
      if (limit) sp.set('limit', String(limit));
      const qs = sp.toString();
      return apiRequest<PaginatedAuditLogs>(`/api/v1/admin/audit-logs${qs ? `?${qs}` : ''}`);
    },
    staleTime: 15_000,
    retry: false,
  });
}

export function useAdminQuizzes() {
  return useQuery({
    queryKey: ['admin', 'quizzes'],
    queryFn: () => apiRequest<BankQuizView[]>('/api/v1/quizzes'),
    staleTime: 15_000,
    retry: false,
  });
}

export function useAdminQuiz(id: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'quiz', id ?? ''],
    queryFn: () => apiRequest<BankQuizView>(`/api/v1/quizzes/${id}`),
    enabled: !!id,
    staleTime: 15_000,
    retry: false,
  });
}

export function useAdminQuizStats(id: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'quiz-stats', id ?? ''],
    queryFn: () => apiRequest<BankQuizStats>(`/api/v1/quizzes/${id}/stats`),
    enabled: !!id,
    staleTime: 15_000,
    retry: false,
  });
}

export function useAdminCohort(id: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'cohort', id ?? ''],
    queryFn: () => apiRequest<PaginatedCohorts['items'][number]>(`/api/v1/admin/cohorts/${id}`),
    enabled: !!id,
    staleTime: 30_000,
    retry: false,
  });
}
