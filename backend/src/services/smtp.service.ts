import nodemailer from 'nodemailer';

export interface SendMailResult {
  success: boolean;
  messageId?: string;
  previewUrl?: string | false;
  error?: string;
}

export class SmtpService {
  private transporter: nodemailer.Transporter | null = null;

  private getTransporter() {
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: process.env.ETHEREAL_USER || 'queen.parisian32@ethereal.email',
          pass: process.env.ETHEREAL_PASS || 'HHGyb6dDbXGQS5H4m9',
        },
        tls: {
          rejectUnauthorized: false,
        },
      });
    }
    return this.transporter;
  }

  async sendMail(to: string, subject: string, body: string, senderEmail?: string) {
    const transporter = this.getTransporter();
    const authUser = process.env.ETHEREAL_USER || 'queen.parisian32@ethereal.email';

    console.log(`[SmtpService] Sending REAL Ethereal email to ${to} from ${senderEmail}...`);

    const info = await transporter.sendMail({
      from: `"ReachInbox" <${authUser}>`,
      replyTo: senderEmail || 'demo@reachinbox.ai',
      to,
      subject,
      html: body,
      text: body,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    console.log(`[SmtpService] ✓ Real Ethereal Message ID: ${info.messageId}`);
    console.log(`[SmtpService] ✓ Real Public Preview URL: ${previewUrl}`);

    return {
      success: true,
      messageId: info.messageId,
      previewUrl: previewUrl || undefined,
    };
  }
}

export const smtpService = new SmtpService();
