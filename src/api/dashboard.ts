import { api } from './client'
import type { DashboardData, AttributesStore } from '../domain/types'

export const dashboardApi = {
  get: (from?: string, to?: string) => {
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    const qs = params.toString()
    return api.get<DashboardData>(`/dashboard${qs ? `?${qs}` : ''}`)
  },
}

export const attributesApi = {
  get: () => api.get<AttributesStore>('/attributes'),
  recalculate: () => api.post<{ success: boolean }>('/attributes/recalculate', {}),
}
