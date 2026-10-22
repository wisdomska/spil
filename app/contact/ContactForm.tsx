"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { useTurnstile } from "@/components/ui/Turnstile";
import { api, ClientApiError } from "@/lib/api/client";

/** Contact form: lands in the admin Inbox (POST /messages). */
export function ContactForm() {
  const t = useTranslations("pages.contactPage");
  const tt = useTranslations("toast");
  const toast = useToast();
  const { getToken, element } = useTurnstile();
  const [email, setEmail] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!body.trim()) return toast(tt("writeFirst"), "err");
    if (email && !/^\S+@\S+\.\S+$/.test(email.trim())) return toast(tt("emailOff"), "err");
    setBusy(true);
    try {
      await api("POST", "/messages", {
        email: email.trim() || undefined,
        body: body.trim(),
        captchaToken: await getToken(),
      });
      setEmail("");
      setBody("");
      toast(tt("sent"));
    } catch (e) {
      toast(
        e instanceof ClientApiError && e.code === "RATE_LIMITED"
          ? tt("rateLimited")
          : tt("somethingWrong"),
        "err",
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
      <Button loading={busy} onClick={send}>
        {t("send")}
      </Button>
      {element}
    </>
  );
}
