import nodemailer from 'nodemailer';

export interface SendMailResult {
  success: boolean;
  messageId?: string;
  previewUrl?: string | false;
  error?: string;
}

class SmtpService {
  private transporter: nodemailer.Transporter | null = null;

  private async getTransporter(): Promise<nodemailer.Transporter> {
    if (this.transporter) {
      return this.transporter;
    }

    const user = process.env.ETHEREAL_USER;
    const pass = process.env.ETHEREAL_PASS;

    if (user && pass) {
      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user,
          pass,
        },
      });
    } else {
      console.log('[SmtpService] Generating new Ethereal test account...');
      const testAccount = await nodemailer.createTestAccount();
      console.log(`[SmtpService] Created Ethereal Account: ${testAccount.user}`);
      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
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
        from: `"${senderEmail}" <${senderEmail}>`,
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
