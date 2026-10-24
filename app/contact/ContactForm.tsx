"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { InlineError } from "@/components/ui/ErrorLine";
import { useTurnstile } from "@/components/ui/Turnstile";
import { api, ClientApiError } from "@/lib/api/client";

/** Contact form: lands in the admin Inbox (POST /messages). */
export function ContactForm() {
  const t = useTranslations("pages.contactPage");
  const tt = useTranslations("toast");
  const toast = useToast();
  const { getToken, element, challenge, showChallenge } = useTurnstile();
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!body.trim()) return toast(tt("writeFirst"), "err");
    if (email && !/^\S+@\S+\.\S+$/.test(email.trim())) return toast(tt("emailOff"), "err");
    setBusy(true);
    setError(null);
    const fail = (message: string) => {
      setError(message);
      toast(message, "err");
    };
    try {
      const captchaToken = await getToken();
      // No token within 5 s: never send empty; show the visible check instead (SPIL-05).
      if (captchaToken === undefined) {
        showChallenge();
        return fail(tt("botCheck"));
      }
      await api("POST", "/messages", {
        email: email.trim() || undefined,
        body: body.trim(),
        captchaToken: captchaToken || undefined,
      });
      setEmail("");
      setBody("");
      toast(tt("sent"));
    } catch (e) {
      const code = e instanceof ClientApiError ? e.code : "";
      if (code === "CAPTCHA_FAILED") showChallenge();
      fail(
        code === "CAPTCHA_FAILED"
          ? tt("botCheck")
          : code === "RATE_LIMITED"
            ? tt("rateLimited")
            : code === "OFFLINE"
              ? tt("offline")
              : tt("somethingWrong"),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <TextField
        id="spil-mail"
        type="email"
        autoComplete="email"
        label={t("email")}
        placeholder={t("emailPlaceholder")}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <TextField
        id="spil-msg"
        multiline
        label={t("message")}
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      {challenge}
      <div>
        <Button block loading={busy} onClick={send}>
          {t("send")}
        </Button>
        <InlineError>{error}</InlineError>
      </div>
      {element}
    </>
  );
}
