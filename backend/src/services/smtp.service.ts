import nodemailer from 'nodemailer';

export interface SendMailResult {
  success: boolean;
  messageId?: string;
  previewUrl?: string | false;
  error?: string;
}

class SmtpService {
  private transporter: nodemailer.Transporter | null = null;
  private authEmail: string = 'outreach@ethereal.email';

  private async getTransporter(): Promise<nodemailer.Transporter> {
    if (this.transporter) {
      return this.transporter;
    }

    const user = process.env.ETHEREAL_USER;
    const pass = process.env.ETHEREAL_PASS;

    if (user && pass) {
      this.authEmail = user;
      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user,
          pass,
        },
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 15000,
      });
      console.log(`[SmtpService] Initialized Ethereal with static credentials: ${user}`);
    } else {
      console.log('[SmtpService] Generating Ethereal test account...');
      const testAccount = await nodemailer.createTestAccount();
      this.authEmail = testAccount.user;
      console.log(`[SmtpService] Created Ethereal Account: ${testAccount.user}`);
      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 15000,
      });
    }

    return this.transporter;
  }

  async sendMail(
    to: string,
    subject: string,
    body: string,
    senderEmail: string
  ): Promise<SendMailResult> {
    try {
      const transporter = await this.getTransporter();
      const info = await transporter.sendMail({
        from: `"ReachInbox Outreach" <${this.authEmail}>`,
        replyTo: senderEmail,
        to,
        subject,
        text: body,
        html: `<p>${body.replace(/\n/g, '<br/>')}</p>`,
      });

      const previewUrl = nodemailer.getTestMessageUrl(info);
      console.log(`[SmtpService] Email sent to ${to}. MessageId: ${info.messageId}`);
      if (previewUrl) {
        console.log(`[SmtpService] Preview URL: ${previewUrl}`);
      }

      return {
        success: true,
        messageId: info.messageId,
        previewUrl,
      };
    } catch (error: any) {
      console.error('[SmtpService] Error sending email:', error);
      return {
        success: false,
        error: error.message || 'Failed to send email',
      };
    }
  }
}

export const smtpService = new SmtpService();
