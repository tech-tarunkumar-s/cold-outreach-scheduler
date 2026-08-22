# 🚀 ReachInbox Full-Stack Email Job Scheduler

Production-grade email job scheduler service and dashboard built with **Node.js, TypeScript, Express, BullMQ, Redis, PostgreSQL (Prisma ORM), Ethereal Email SMTP, and Next.js (Tailwind CSS)**.

---

## 🏗️ Architecture & Core Components

1. **Backend & Persistence**:
   - **PostgreSQL / MySQL (via Prisma)**: Stores all scheduled, sending, sent, and failed email records with relational metadata.
   - **BullMQ + Redis**: Handles reliable delayed job scheduling (**No cron jobs used**). When server restarts, BullMQ reads pending jobs directly from Redis, ensuring jobs are never lost or re-sent from day one (fully idempotent).

2. **Rate Limiting & Concurrency**:
   - **Per-Sender Hourly Rate Limiting**: Backed by Redis counters (`ratelimit:{senderEmail}:{YYYY-MM-DD-HH}`) with auto-expiration TTLs. When hourly limits are exceeded, overflow jobs are automatically rescheduled into the next hour window without dropping or failing.
   - **Worker Concurrency & Throttling**: Configurable worker concurrency (`WORKER_CONCURRENCY=5`) and minimum throttle delay between individual sends (`MIN_DELAY_SECONDS=2`).

3. **SMTP Sending**:
   - Uses **Ethereal Email** via Nodemailer to generate fully functional test preview links for all sent cold emails.

4. **Frontend Dashboard**:
   - Built with **Next.js App Router, Tailwind CSS, and Lucide React**.
   - Supports uploading CSV/text lead files (`PapaParse`), scheduling campaigns, viewing live scheduled queues and sent history with Ethereal preview links.

---

## 🛠️ How to Run Locally

### 1. Start Infrastructure (PostgreSQL & Redis via Docker)
```bash
docker-compose up -d
```

### 2. Run Backend
```bash
cd backend
npm install
npx prisma migrate dev --name init
npx prisma generate
npm run dev
```

### 3. Run Frontend Dashboard
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

