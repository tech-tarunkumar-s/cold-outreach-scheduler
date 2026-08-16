import nodemailer from 'nodemailer';
import SMTPTransport from 'nodemailer/lib/smtp-transport';

export interface SendMailResult {
  success: boolean;
  messageId?: string;
  previewUrl?: string | false;
  error?: string;
}

class SmtpService {
  private getTransporter() {
    const options: SMTPTransport.Options = {
      host: 'smtp.ethereal.email',
      port: 465,
      secure: true,
      auth: {
        user: process.env.ETHEREAL_USER || 'queen.parisian32@ethereal.email',
        pass: process.env.ETHEREAL_PASS || 'HHGyb6dDbXGQS5H4m9',
      },
      connectionTimeout: 20000,
      greetingTimeout: 20000,
      socketTimeout: 20000,
      tls: {
        rejectUnauthorized: false,
      },
    };
    return nodemailer.createTransport(options);
  }

  async sendMail(
    to: string,
    subject: string,
    body: string,
    senderEmail?: string
  ): Promise<SendMailResult> {
    const authUser = process.env.ETHEREAL_USER || 'queen.parisian32@ethereal.email';
    const transporter = this.getTransporter();

    console.log(`[SmtpService] Opening fresh connection to deliver to ${to}...`);

    try {
      const info = await transporter.sendMail({
        from: `"ReachInbox Outreach" <${authUser}>`,
        replyTo: senderEmail || 'demo@reachinbox.ai',
        to,
        subject,
        text: body,
        html: `<p>${body.replace(/\n/g, '<br/>')}</p>`,
      });

      const previewUrl = nodemailer.getTestMessageUrl(info);
      console.log(`[SmtpService] ✓ Delivered to ${to}! MessageId: ${info.messageId}`);
      if (previewUrl) {
        console.log(`[SmtpService] ✓ Preview URL: ${previewUrl}`);
      }

      return {
        success: true,
        messageId: info.messageId,
        previewUrl,
      };
    } catch (error: any) {
      console.error(`[SmtpService Error] Failed to send to ${to}:`, error.message);
      throw error;
    }
  }
}

export const smtpService = new SmtpService();
