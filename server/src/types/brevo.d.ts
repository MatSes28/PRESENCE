declare module "brevo" {
  export interface SendSmtpEmail {
    to: Array<{ email: string; name?: string }>;
    sender: { email: string; name?: string };
    subject: string;
    htmlContent?: string;
    textContent?: string;
  }

  export class TransactionalEmailsApi {
    sendTransacEmail(sendSmtpEmail: SendSmtpEmail): Promise<any>;
  }

  export class ApiClient {
    static instance: ApiClient;
    authentications: {
      "api-key": { apiKey: string };
    };
  }
}
