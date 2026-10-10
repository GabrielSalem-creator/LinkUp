/**
 * Email delivery boundary. Default is queue-only (no approved sender yet):
 * deliveries stay queued and in-app tickets remain fully usable.
 */
export interface EmailMessage {
  to: string;
  userId: string;
  subject: string;
  text: string;
  html: string;
}

export interface EmailSender {
  readonly id: string;
  /** Returns { sent: true } or { sent: false, retryable, error } — never throws. */
  send(msg: EmailMessage): Promise<{ sent: boolean; retryable?: boolean; error?: string }>;
}

export class QueueOnlySender implements EmailSender {
  readonly id = 'queue-only';
  async send(): Promise<{ sent: boolean; retryable?: boolean; error?: string }> {
    return { sent: false, retryable: true, error: 'No approved email provider configured' };
  }
}

/** Test double that can be scripted to fail. */
export class ScriptedSender implements EmailSender {
  readonly id = 'scripted';
  readonly sent: EmailMessage[] = [];
  failNext = 0;
  async send(msg: EmailMessage) {
    if (this.failNext > 0) {
      this.failNext--;
      return { sent: false, retryable: true, error: 'simulated outage' };
    }
    this.sent.push(msg);
    return { sent: true };
  }
}

/** Appwrite Messaging adapter — only active when EMAIL_PROVIDER=appwrite and a provider is configured in the console. */
export class AppwriteMessagingSender implements EmailSender {
  readonly id = 'appwrite-messaging';
  private readonly send_: (msg: EmailMessage) => Promise<void>;
  constructor(send_: (msg: EmailMessage) => Promise<void>) {
    this.send_ = send_;
  }
  async send(msg: EmailMessage) {
    try {
      await this.send_(msg);
      return { sent: true };
    } catch (e) {
      return { sent: false, retryable: true, error: (e as Error).message };
    }
  }
}
