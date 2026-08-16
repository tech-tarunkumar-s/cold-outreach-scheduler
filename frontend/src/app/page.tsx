'use client';

import React, { useState, useEffect, useSyncExternalStore } from 'react';
import {
  Send,
  Clock,
  Plus,
  LogOut,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Trash2,
  ExternalLink,
  ShieldCheck,
  Layers,
  Inbox,
  Upload,
  Zap,
} from 'lucide-react';
import Papa from 'papaparse';
import { GoogleOAuthProvider, GoogleLogin, CredentialResponse } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import { emailApi, EmailJob, DashboardStats, UserProfile, GoogleJwtPayload } from '@/services/api';

const emptySubscribe = () => () => {};

function MainApp() {
  const isMounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const [user, setUser] = useState<UserProfile | null>(() => {
    if (typeof window !== 'undefined') {
      const savedUser = localStorage.getItem('reachinbox_user');
      if (savedUser) {
        try {
          return JSON.parse(savedUser);
        } catch (e) {
          console.error('Failed to parse cached user:', e);
        }
      }
    }
    return null;
  });

  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent'>('scheduled');
  const [scheduledEmails, setScheduledEmails] = useState<EmailJob[]>([]);
  const [sentEmails, setSentEmails] = useState<EmailJob[]>([]);
  const [stats, setStats] = useState<DashboardStats>({ scheduled: 0, sent: 0, failed: 0, total: 0 });
  const [isComposeOpen, setIsComposeOpen] = useState<boolean>(false);

  // Compose State
  const [senderEmail, setSenderEmail] = useState<string>(user?.email || 'outreach@reachinbox.ai');
  const [subject, setSubject] = useState<string>('Accelerating Growth with AI Cold Outreach');
  const [body, setBody] = useState<string>('Hi there,\n\nWe would love to connect and show you how ReachInbox can transform your lead generation workflow.\n\nBest regards,\nGrowth Team');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [recipientInput, setRecipientInput] = useState<string>('');
  const [scheduledAt, setScheduledAt] = useState<string>('');
  const [delayBetweenSeconds, setDelayBetweenSeconds] = useState<number>(2);
  const [hourlyLimit, setHourlyLimit] = useState<number>(200);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [csvFileName, setCsvFileName] = useState<string>('');

  const handleLoginSuccess = (credentialResponse: CredentialResponse) => {
    try {
      if (credentialResponse.credential) {
        const decoded = jwtDecode<GoogleJwtPayload>(credentialResponse.credential);
        const profile: UserProfile = {
          name: decoded.name || 'User',
          email: decoded.email || 'user@example.com',
          avatar: decoded.picture || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face',
        };
        setUser(profile);
        setSenderEmail(profile.email);
        localStorage.setItem('reachinbox_user', JSON.stringify(profile));
      }
    } catch (err) {
      console.error('Error decoding Google token:', err);
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('reachinbox_user');
  };

  const triggerRefresh = async () => {
    try {
      const [scheduledData, sentData, statsData] = await Promise.all([
        emailApi.getScheduledEmails(),
        emailApi.getSentEmails(),
        emailApi.getStats(),
      ]);
      setScheduledEmails(scheduledData);
      setSentEmails(sentData);
      setStats(statsData);
    } catch (err) {
      console.error('Error refreshing queue data:', err);
    }
  };

  useEffect(() => {
    if (!user) return;
    let isMountedLocal = true;
    const fetchData = async () => {
      try {
        const [scheduledData, sentData, statsData] = await Promise.all([
          emailApi.getScheduledEmails(),
          emailApi.getSentEmails(),
          emailApi.getStats(),
        ]);
        if (isMountedLocal) {
          setScheduledEmails(scheduledData);
          setSentEmails(sentData);
          setStats(statsData);
        }
      } catch (err) {
        console.error('Error polling dashboard data:', err);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 4000);
    return () => {
      isMountedLocal = false;
      clearInterval(interval);
    };
  }, [user]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFileName(file.name);
    Papa.parse(file, {
      complete: (results) => {
        const parsedEmails: string[] = [];
        results.data.forEach((row: unknown) => {
          if (Array.isArray(row)) {
            row.forEach((cell) => {
              if (cell && typeof cell === 'string' && cell.includes('@')) {
                parsedEmails.push(cell.trim());
              }
            });
          } else if (typeof row === 'object' && row !== null) {
            Object.values(row as Record<string, unknown>).forEach((val) => {
              if (val && typeof val === 'string' && val.includes('@')) {
                parsedEmails.push(val.trim());
              }
            });
          }
        });
        setRecipients(Array.from(new Set(parsedEmails)));
      },
      error: (error: unknown) => {
        console.error('CSV parse error:', error);
        alert('Failed to parse CSV file.');
      },
    });
  };

  const handleAddManualRecipient = () => {
    if (!recipientInput || !recipientInput.includes('@')) return;
    if (!recipients.includes(recipientInput.trim())) {
      setRecipients([...recipients, recipientInput.trim()]);
    }
    setRecipientInput('');
  };

  const handleRemoveRecipient = (email: string) => {
    setRecipients(recipients.filter((r) => r !== email));
  };

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (recipients.length === 0) {
      alert('Please add at least one recipient email.');
      return;
    }

    setSubmitting(true);
    try {
      await emailApi.scheduleEmails({
        userId: user?.email || 'user-1',
        senderEmail,
        subject,
        body,
        recipients,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : new Date().toISOString(),
        delayBetweenSeconds,
        hourlyLimit,
      });

      setIsComposeOpen(false);
      setRecipients([]);
      setCsvFileName('');
      triggerRefresh();
    } catch (err: unknown) {
      console.error('Error scheduling batch:', err);
      const errorMessage = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to schedule campaign';
      alert(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelEmail = async (id: string) => {
    if (!confirm('Cancel this scheduled job?')) return;
    try {
      await emailApi.cancelEmail(id);
      triggerRefresh();
    } catch (err: unknown) {
      const errorMessage = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to cancel job';
      alert(errorMessage);
    }
  };

  if (!isMounted) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-7 h-7 border-2 border-zinc-700 border-t-zinc-300 rounded-full animate-spin" />
      </div>
    );
  }

  // Login Gateway View
  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-zinc-100 selection:bg-zinc-800">
        <div className="max-w-md w-full bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-8 shadow-2xl backdrop-blur-xl space-y-6 text-center">
          <div className="w-12 h-12 rounded-xl bg-zinc-800 border border-zinc-700/60 flex items-center justify-center mx-auto text-zinc-100">
            <Zap className="w-6 h-6" />
          </div>

          <div className="space-y-1.5">
            <h1 className="text-xl font-semibold tracking-tight text-zinc-100">ReachInbox Scheduler</h1>
            <p className="text-xs text-zinc-400">
              Sign in to manage automated email sequences and outbox queues.
            </p>
          </div>

          <div className="pt-2 flex flex-col items-center justify-center space-y-3">
            <GoogleLogin
              onSuccess={handleLoginSuccess}
              onError={() => console.log('Google Login Failed')}
              theme="filled_black"
              shape="pill"
              size="large"
            />

            <div className="relative w-full my-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-800" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase tracking-wider">
                <span className="bg-zinc-900 px-3 text-zinc-500 font-medium">Or</span>
              </div>
            </div>

            <button
              onClick={() => {
                const demoProfile: UserProfile = {
                  name: 'Demo Account',
                  email: 'demo@reachinbox.ai',
                  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face',
                };
                setUser(demoProfile);
                setSenderEmail(demoProfile.email);
                localStorage.setItem('reachinbox_user', JSON.stringify(demoProfile));
              }}
              className="w-full py-2.5 px-4 rounded-xl border border-zinc-800 hover:border-zinc-700 bg-zinc-900 hover:bg-zinc-800/80 text-xs font-medium text-zinc-300 transition-all flex items-center justify-center space-x-2"
            >
              <ShieldCheck className="w-4 h-4 text-zinc-400" />
              <span>Enter with Demo Account</span>
            </button>
          </div>

          <div className="pt-3 border-t border-zinc-800/60 text-[11px] text-zinc-500">
            Engineered with BullMQ, Redis, PostgreSQL & Ethereal SMTP
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-zinc-800">
      {/* Top Navbar */}
      <header className="bg-zinc-900/40 border-b border-zinc-800/80 px-6 py-3.5 flex items-center justify-between backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center space-x-3">
          <div className="bg-zinc-800 border border-zinc-700/70 p-2 rounded-lg text-zinc-100">
            <Zap className="w-4 h-4" />
          </div>
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-sm tracking-tight text-zinc-100">ReachInbox</span>
            <span className="text-[11px] font-medium text-zinc-400 bg-zinc-800/80 px-2 py-0.5 rounded border border-zinc-700/60">
              Scheduler
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-3 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-full">
            <img src={user.avatar} alt={user.name} className="w-6 h-6 rounded-full border border-zinc-700" />
            <div className="text-left hidden sm:block">
              <p className="text-xs font-medium text-zinc-200">{user.name}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="text-zinc-400 hover:text-zinc-200 transition-colors p-1.5 rounded-lg hover:bg-zinc-800/60"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content Dashboard */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* Metric Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
          <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Scheduled Queue</p>
              <h3 className="text-2xl font-bold text-zinc-100 mt-1">{stats.scheduled}</h3>
            </div>
            <div className="p-2.5 rounded-lg bg-zinc-800/60 text-zinc-400 border border-zinc-750">
              <Clock className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Delivered</p>
              <h3 className="text-2xl font-bold text-zinc-100 mt-1">{stats.sent}</h3>
            </div>
            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Failed / Rate-Limited</p>
              <h3 className="text-2xl font-bold text-zinc-100 mt-1">{stats.failed}</h3>
            </div>
            <div className="p-2.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Total Processed</p>
              <h3 className="text-2xl font-bold text-zinc-100 mt-1">{stats.total}</h3>
            </div>
            <div className="p-2.5 rounded-lg bg-zinc-800/60 text-zinc-400 border border-zinc-750">
              <Layers className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Tab Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-zinc-900/40 p-2.5 rounded-xl border border-zinc-800/80">
          <div className="flex space-x-1.5 w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('scheduled')}
              className={`px-3.5 py-1.5 rounded-lg font-medium text-xs transition-all flex items-center space-x-2 ${
                activeTab === 'scheduled'
                  ? 'bg-zinc-800 text-zinc-100 border border-zinc-700/80 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Outbox Queue ({scheduledEmails.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('sent')}
              className={`px-3.5 py-1.5 rounded-lg font-medium text-xs transition-all flex items-center space-x-2 ${
                activeTab === 'sent'
                  ? 'bg-zinc-800 text-zinc-100 border border-zinc-700/80 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
              }`}
            >
              <Inbox className="w-3.5 h-3.5" />
              <span>Delivery Logs ({sentEmails.length})</span>
            </button>
          </div>

          <div className="flex items-center space-x-2.5 w-full sm:w-auto justify-end">
            <button
              onClick={triggerRefresh}
              className="p-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 rounded-lg transition-colors border border-zinc-800"
              title="Refresh queue"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => setIsComposeOpen(true)}
              className="bg-zinc-100 hover:bg-white text-zinc-950 px-3.5 py-1.5 rounded-lg font-medium text-xs transition-all flex items-center space-x-1.5 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Compose Campaign</span>
            </button>
          </div>
        </div>

        {/* Data Tables */}
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl shadow-sm overflow-hidden">
          {activeTab === 'scheduled' ? (
            <div>
              <div className="px-5 py-3 border-b border-zinc-800/80 flex items-center justify-between">
                <h3 className="font-medium text-xs text-zinc-300">Scheduled Tasks</h3>
                <span className="text-[11px] text-zinc-500">Auto-refreshing</span>
              </div>
              {scheduledEmails.length === 0 ? (
                <div className="p-12 text-center flex flex-col items-center justify-center space-y-2.5">
                  <div className="w-10 h-10 rounded-xl bg-zinc-800/50 flex items-center justify-center text-zinc-500">
                    <Clock className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-medium text-zinc-300">No scheduled emails in queue</p>
                  <p className="text-[11px] text-zinc-500 max-w-xs">
                    Create a new campaign to schedule emails with custom delays and rate limits.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-zinc-900 text-zinc-400 text-[10px] uppercase tracking-wider border-b border-zinc-800">
                        <th className="px-5 py-2.5 font-medium">Recipient</th>
                        <th className="px-5 py-2.5 font-medium">Sender</th>
                        <th className="px-5 py-2.5 font-medium">Subject</th>
                        <th className="px-5 py-2.5 font-medium">Scheduled Run</th>
                        <th className="px-5 py-2.5 font-medium">Status</th>
                        <th className="px-5 py-2.5 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60">
                      {scheduledEmails.map((item) => (
                        <tr key={item.id} className="hover:bg-zinc-800/30 transition-colors">
                          <td className="px-5 py-3 font-medium text-zinc-200">{item.recipientEmail}</td>
                          <td className="px-5 py-3 text-zinc-400 text-[11px] font-mono">{item.senderEmail}</td>
                          <td className="px-5 py-3 text-zinc-300 max-w-xs truncate">{item.subject}</td>
                          <td className="px-5 py-3 text-zinc-400 font-mono text-[11px]">
                            {new Date(item.scheduledAt).toLocaleString()}
                          </td>
                          <td className="px-5 py-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
                              {item.status}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right">
                            <button
                              onClick={() => handleCancelEmail(item.id)}
                              className="text-zinc-500 hover:text-rose-400 transition-colors p-1 rounded hover:bg-zinc-800"
                              title="Cancel job"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="px-5 py-3 border-b border-zinc-800/80 flex items-center justify-between">
                <h3 className="font-medium text-xs text-zinc-300">Executed Deliveries</h3>
                <span className="text-[11px] text-zinc-500">SMTP Activity</span>
              </div>
              {sentEmails.length === 0 ? (
                <div className="p-12 text-center flex flex-col items-center justify-center space-y-2.5">
                  <div className="w-10 h-10 rounded-xl bg-zinc-800/50 flex items-center justify-center text-zinc-500">
                    <Send className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-medium text-zinc-300">No sent emails recorded yet</p>
                  <p className="text-[11px] text-zinc-500 max-w-xs">
                    Executed deliveries and Ethereal preview links will appear here once jobs are sent.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-zinc-900 text-zinc-400 text-[10px] uppercase tracking-wider border-b border-zinc-800">
                        <th className="px-5 py-2.5 font-medium">Recipient</th>
                        <th className="px-5 py-2.5 font-medium">Sender</th>
                        <th className="px-5 py-2.5 font-medium">Subject</th>
                        <th className="px-5 py-2.5 font-medium">Timestamp</th>
                        <th className="px-5 py-2.5 font-medium">Status</th>
                        <th className="px-5 py-2.5 font-medium text-right">Ethereal Preview</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60">
                      {sentEmails.map((item) => (
                        <tr key={item.id} className="hover:bg-zinc-800/30 transition-colors">
                          <td className="px-5 py-3 font-medium text-zinc-200">{item.recipientEmail}</td>
                          <td className="px-5 py-3 text-zinc-400 text-[11px] font-mono">{item.senderEmail}</td>
                          <td className="px-5 py-3 text-zinc-300 max-w-xs truncate">{item.subject}</td>
                          <td className="px-5 py-3 text-zinc-400 font-mono text-[11px]">
                            {item.sentAt ? new Date(item.sentAt).toLocaleString() : '—'}
                          </td>
                          <td className="px-5 py-3">
                            {item.status === 'SENT' ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                                SENT
                              </span>
                            ) : item.status === 'FAILED' ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20 font-mono" title={item.errorMessage || ''}>
                                FAILED
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-800 text-zinc-400 font-mono">
                                {item.status}
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3 text-right">
                            {item.previewUrl ? (
                              <a
                                href={item.previewUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center space-x-1 text-zinc-300 hover:text-white text-[11px] font-medium bg-zinc-800/80 hover:bg-zinc-800 px-2.5 py-1 rounded border border-zinc-700/60 transition-colors"
                              >
                                <span>View Email</span>
                                <ExternalLink className="w-3 h-3 text-zinc-400" />
                              </a>
                            ) : (
                              <span className="text-zinc-600 text-[11px] italic">No preview</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Compose Campaign Modal */}
      {isComposeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div>
                <h2 className="text-sm font-semibold text-zinc-100">Schedule Email Campaign</h2>
                <p className="text-[11px] text-zinc-400">Configure delays and recipient queues</p>
              </div>
              <button
                onClick={() => setIsComposeOpen(false)}
                className="text-zinc-500 hover:text-zinc-200 p-1.5 rounded-lg hover:bg-zinc-800 transition-colors text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleScheduleSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 uppercase tracking-wider mb-1">
                    Sender Email
                  </label>
                  <input
                    type="email"
                    required
                    value={senderEmail}
                    onChange={(e) => setSenderEmail(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-zinc-600"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 uppercase tracking-wider mb-1">
                    Start Time (UTC)
                  </label>
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-zinc-600"
                  />
                </div>
              </div>

              {/* Lead Uploader */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
                  Recipients (CSV / Manual)
                </label>
                <label className="flex items-center justify-center px-4 py-2.5 border border-dashed border-zinc-800 rounded-lg cursor-pointer hover:border-zinc-700 bg-zinc-950/60 transition-colors">
                  <Upload className="w-3.5 h-3.5 mr-2 text-zinc-400" />
                  <span className="text-[11px] text-zinc-400">
                    {csvFileName ? csvFileName : 'Upload leads .csv or .txt file'}
                  </span>
                  <input type="file" accept=".csv, .txt" onChange={handleFileUpload} className="hidden" />
                </label>

                <div className="flex space-x-2">
                  <input
                    type="email"
                    placeholder="Or add single lead email"
                    value={recipientInput}
                    onChange={(e) => setRecipientInput(e.target.value)}
                    className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-zinc-200 focus:outline-none focus:border-zinc-600"
                  />
                  <button
                    type="button"
                    onClick={handleAddManualRecipient}
                    className="bg-zinc-800 hover:bg-zinc-750 text-zinc-200 px-3 py-1.5 rounded-lg font-medium transition-colors border border-zinc-700/60"
                  >
                    Add
                  </button>
                </div>

                {recipients.length > 0 && (
                  <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 max-h-28 overflow-y-auto space-y-1">
                    <p className="text-[10px] font-medium text-emerald-400">
                      ✓ {recipients.length} valid email address{recipients.length > 1 ? 'es' : ''} detected:
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {recipients.map((email) => (
                        <span key={email} className="inline-flex items-center space-x-1 bg-zinc-900 text-zinc-300 text-[10px] px-2 py-0.5 rounded border border-zinc-800">
                          <span>{email}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveRecipient(email)}
                            className="text-zinc-500 hover:text-rose-400 ml-1"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-400 uppercase tracking-wider mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-zinc-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-400 uppercase tracking-wider mb-1">
                  Email Body
                </label>
                <textarea
                  required
                  rows={3}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-zinc-200 focus:outline-none focus:border-zinc-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 uppercase tracking-wider mb-1">
                    Delay Between Emails (Seconds)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={delayBetweenSeconds}
                    onChange={(e) => setDelayBetweenSeconds(Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-zinc-600 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 uppercase tracking-wider mb-1">
                    Hourly Limit (Max / Hr)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={hourlyLimit}
                    onChange={(e) => setHourlyLimit(Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-zinc-600 font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsComposeOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-zinc-100 hover:bg-white text-zinc-950 px-4 py-1.5 rounded-lg font-medium shadow-sm transition-all flex items-center space-x-1.5 disabled:opacity-50"
                >
                  {submitting ? (
                    <span>Scheduling...</span>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Schedule Campaign</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const isMounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  if (!isMounted) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-7 h-7 border-2 border-zinc-700 border-t-zinc-300 rounded-full animate-spin" />
      </div>
    );
  }

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || 'mock-client-id.apps.googleusercontent.com';

  return (
    <GoogleOAuthProvider clientId={clientId}>
      <MainApp />
    </GoogleOAuthProvider>
  );
}
