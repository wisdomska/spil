import * as Sentry from "@sentry/nextjs";

export async function register() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.APP_ENV ?? "local",
    tracesSampleRate: 0.1,
    beforeSend(event) {
      // Request bodies can carry answers; drop them.
      if (event.request) delete event.request.data;
      return event;
    },
  });
}

export const onRequestError = process.env.SENTRY_DSN ? Sentry.captureRequestError : undefined;
