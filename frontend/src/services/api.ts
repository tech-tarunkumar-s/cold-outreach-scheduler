import axios from 'axios';
import { EmailJob, DashboardStats, SchedulePayload } from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const emailApi = {
  getScheduledEmails: async (): Promise<EmailJob[]> => {
    const res = await api.get<EmailJob[]>('/api/emails/scheduled');
    return res.data;
  },

  getSentEmails: async (): Promise<EmailJob[]> => {
    const res = await api.get<EmailJob[]>('/api/emails/sent');
    return res.data;
  },

  getStats: async (): Promise<DashboardStats> => {
    const res = await api.get<DashboardStats>('/api/emails/stats');
    return res.data;
  },

  scheduleEmails: async (payload: SchedulePayload) => {
    const res = await api.post('/api/emails/schedule', payload);
    return res.data;
  },

  cancelEmail: async (id: string) => {
    const res = await api.delete(`/api/emails/${id}`);
    return res.data;
  },
};

export default api;
export * from '@/types';
