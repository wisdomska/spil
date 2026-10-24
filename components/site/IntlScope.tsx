import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { BASE_SCOPE, pickMessages, SCOPES, type Scope } from "@/lib/i18n/pick";

/**
 * Gives a route's client components only the copy they use (SPIL-07), so public pages never
 * carry the admin console's strings. Nested providers replace the parent's messages, so every
 * scope includes the base namespaces too.
 */
export async function IntlScope({
  scope,
  children,
}: {
  scope: Scope | "all";
  children: React.ReactNode;
}) {
  const all = await getMessages();
  const messages = scope === "all" ? all : pickMessages(all, [...BASE_SCOPE, ...SCOPES[scope]]);
  return <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>;
}
