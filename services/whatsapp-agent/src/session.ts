/**
 * In-memory conversation session manager with 30-minute TTL.
 * For production, replace with Redis.
 */

export interface BookingState {
  step: "select_date" | "select_time_period" | "select_time" | "confirm";
  serviceId: string;
  serviceName: string;
  date?: string;
  time?: string;
}

export interface ConversationSession {
  phoneNumber: string;
  businessId: string;
  language: "he" | "ar" | "en";
  messages: { role: "user" | "assistant"; content: string }[];
  booking?: BookingState;
  bookingFlow?: "quick" | "specific";
  customerId?: string;
  customerName?: string;
  awaitingName?: boolean;
  createdAt: number;
  lastActiveAt: number;
}

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const sessions = new Map<string, ConversationSession>();

function sessionKey(phone: string, businessPhoneId: string): string {
  return `${phone}:${businessPhoneId}`;
}

export function getSession(
  phone: string,
  businessPhoneId: string
): ConversationSession | null {
  const key = sessionKey(phone, businessPhoneId);
  const session = sessions.get(key);
  if (!session) return null;

  // Check TTL
  if (Date.now() - session.lastActiveAt > SESSION_TTL_MS) {
    sessions.delete(key);
    return null;
  }

  return session;
}

export function createSession(
  phone: string,
  businessPhoneId: string,
  businessId: string,
  language: "he" | "ar" | "en"
): ConversationSession {
  const key = sessionKey(phone, businessPhoneId);
  const session: ConversationSession = {
    phoneNumber: phone,
    businessId,
    language,
    messages: [],
    createdAt: Date.now(),
    lastActiveAt: Date.now(),
  };
  sessions.set(key, session);
  return session;
}

export function updateSession(
  phone: string,
  businessPhoneId: string,
  update: Partial<ConversationSession>
): void {
  const key = sessionKey(phone, businessPhoneId);
  const session = sessions.get(key);
  if (session) {
    Object.assign(session, update, { lastActiveAt: Date.now() });
  }
}

export function addMessage(
  phone: string,
  businessPhoneId: string,
  role: "user" | "assistant",
  content: string
): void {
  const key = sessionKey(phone, businessPhoneId);
  const session = sessions.get(key);
  if (session) {
    session.messages.push({ role, content });
    session.lastActiveAt = Date.now();
  }
}

// Periodically clean expired sessions
setInterval(() => {
  const now = Date.now();
  for (const [key, session] of sessions.entries()) {
    if (now - session.lastActiveAt > SESSION_TTL_MS) {
      sessions.delete(key);
    }
  }
}, 5 * 60 * 1000); // every 5 minutes
