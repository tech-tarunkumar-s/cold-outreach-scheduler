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
      port: 587,
      secure: false,
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
    try {
      const transporter = this.getTransporter();
      const authUser = process.env.ETHEREAL_USER || 'queen.parisian32@ethereal.email';

      const info = await transporter.sendMail({
        from: `"ReachInbox Outreach" <${authUser}>`,
        replyTo: senderEmail || 'demo@reachinbox.ai',
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
