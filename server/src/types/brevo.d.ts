declare module "brevo" {
  export interface SendSmtpEmail {
    to: Array<{ email: string; name?: string }>;
    sender: { email: string; name?: string };
    subject: string;
    htmlContent?: string;
    textContent?: string;
  }

  export class SendSmtpEmail {
    subject?: string;
    htmlContent?: string;
    sender?: { name?: string; email: string };
    to?: Array<{ email: string; name?: string }>;
    textContent?: string;
  }

  export class TransactionalEmailsApi {
    setApiKey(apiKeyIdentifier: number, apiKey: string): void;
    static readonly ApiKeys: {
      readonly apiKey: 1;
    };
    sendTransacEmail(
      sendSmtpEmail: SendSmtpEmail
    ): Promise<{ response: { statusCode: number } }>;
  }

  export class ApiClient {
    static instance: ApiClient;
    authentications: {
      "api-key": { apiKey: string };
    };
  }
}
