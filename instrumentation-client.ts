// Sentry loads lazily and only when a DSN is set at build time; without one the import is dead
// code and no Sentry bytes ship to the browser.
type SentryModule = typeof import("@sentry/nextjs");
let sentry: SentryModule | null = null;

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  void import("@sentry/nextjs").then((Sentry) => {
    sentry = Sentry;
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      environment: process.env.NEXT_PUBLIC_APP_ENV ?? "local",
      tracesSampleRate: 0.1,
      // Answers and guesses never leave the device in error reports (spec section 18).
      beforeBreadcrumb(crumb) {
        const url = String(crumb.data?.url ?? "");
        if (/\/(answers|guesses)/.test(url)) {
          delete crumb.data?.body;
          delete crumb.data?.request_body_size;
        }
        return crumb;
      },
    });
  });
}

export function onRouterTransitionStart(
  ...args: Parameters<SentryModule["captureRouterTransitionStart"]>
) {
  sentry?.captureRouterTransitionStart(...args);
}
