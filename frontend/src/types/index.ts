export interface UserProfile {
  name: string;
  email: string;
  avatar: string;
}

export interface GoogleJwtPayload {
  name?: string;
  email?: string;
  picture?: string;
}

export interface EmailJob {
  id: string;
  userId?: string | null;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  body: string;
  scheduledAt: string;
  sentAt?: string | null;
  status: 'SCHEDULED' | 'SENDING' | 'SENT' | 'FAILED';
  previewUrl?: string | null;
  errorMessage?: string | null;
  createdAt: string;
}

export interface DashboardStats {
  scheduled: number;
  sent: number;
  failed: number;
  total: number;
}

export interface SchedulePayload {
  userId?: string;
  senderEmail: string;
  subject: string;
  body: string;
  recipients: string[];
  scheduledAt?: string;
  delayBetweenSeconds?: number;
  hourlyLimit?: number;
}
