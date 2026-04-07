import crypto from "crypto";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { IncomingMessage } from "http";
import { isProductionLike, requireEnv } from "./config/env.js";

export const isTestEnv =
  process.env.NODE_ENV === "test" ||
  typeof process.env.JEST_WORKER_ID !== "undefined";

export const sessionCookieName = "presence.sid";
export const sessionSecret = isTestEnv
  ? process.env.SESSION_SECRET || "test-session-secret-please-change-32chars"
  : requireEnv("SESSION_SECRET", { minLength: 32 });

const PgSession = connectPgSimple(session);

const sessionDbConfig = {
  connectionString: process.env.DATABASE_URL,
  ...(isProductionLike() && {
    ssl: {
      rejectUnauthorized: false,
    },
  }),
};

export const sessionStore: session.Store = isTestEnv
  ? new session.MemoryStore()
  : new PgSession({
      ...sessionDbConfig,
      tableName: "user_sessions",
      createTableIfMissing: true,
      pruneSessionInterval: 60 * 60,
    });

export const sessionCookieMaxAge = parseInt(
  process.env.SESSION_MAX_AGE || "28800000",
);

export const sessionMiddleware = session({
  store: sessionStore,
  secret: sessionSecret,
  name: sessionCookieName,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    secure: isProductionLike() && !isTestEnv,
    httpOnly: true,
    sameSite: (process.env.SESSION_COOKIE_SAMESITE as any) || "lax",
    maxAge: sessionCookieMaxAge,
    path: "/",
  },
});

function parseCookieHeader(header: string | undefined): Record<string, string> {
  if (!header) return {};

  return header
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, part) => {
      const separatorIndex = part.indexOf("=");
      if (separatorIndex <= 0) {
        return acc;
      }

      const key = part.slice(0, separatorIndex).trim();
      const value = part.slice(separatorIndex + 1).trim();
      if (key) {
        acc[key] = value;
      }
      return acc;
    }, {});
}

function unsignSessionCookie(value: string): string | null {
  const decoded = decodeURIComponent(value);

  if (!decoded.startsWith("s:")) {
    return decoded || null;
  }

  const signedValue = decoded.slice(2);
  const lastDot = signedValue.lastIndexOf(".");
  if (lastDot <= 0) {
    return null;
  }

  const rawValue = signedValue.slice(0, lastDot);
  const signature = signedValue.slice(lastDot + 1);
  const expected = crypto
    .createHmac("sha256", sessionSecret)
    .update(rawValue)
    .digest("base64")
    .replace(/=+$/, "");

  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);

  if (expectedBuffer.length !== signatureBuffer.length) {
    return null;
  }

  if (!crypto.timingSafeEqual(expectedBuffer, signatureBuffer)) {
    return null;
  }

  return rawValue;
}

export async function getAuthenticatedSessionFromRequest(
  request: IncomingMessage,
): Promise<{
  sessionId: string;
  sessionData: session.SessionData & Record<string, any>;
} | null> {
  const cookies = parseCookieHeader(request.headers.cookie);
  const rawCookie = cookies[sessionCookieName];
  if (!rawCookie) {
    return null;
  }

  const sessionId = unsignSessionCookie(rawCookie);
  if (!sessionId) {
    return null;
  }

  const sessionData = await new Promise<(session.SessionData & Record<string, any>) | null>(
    (resolve) => {
      sessionStore.get(sessionId, (error, value) => {
        if (error || !value) {
          resolve(null);
          return;
        }

        resolve(value as session.SessionData & Record<string, any>);
      });
    },
  );

  if (!sessionData?.userId) {
    return null;
  }

  return {
    sessionId,
    sessionData,
  };
}
