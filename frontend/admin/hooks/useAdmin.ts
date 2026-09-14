'use client';

import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';

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
  });
}

export function useAdminCohort(id: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'cohort', id ?? ''],
    queryFn: () => apiRequest<PaginatedCohorts['items'][number]>(`/api/v1/admin/cohorts/${id}`),
    enabled: !!id,
    staleTime: 30_000,
  });
}
