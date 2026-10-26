"use client";

import { EyeIcon, EyeSlashIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { TextField } from "@/components/ui/TextField";

/** A password field with a show and hide button inside its right edge. */
export function PasswordField({
  id,
  label,
  help,
  error,
  value,
  onChange,
  autoComplete,
}: {
  id: string;
  label: string;
  help?: string;
  error?: string | null;
  value: string;
  onChange: (v: string) => void;
  autoComplete: "new-password" | "current-password";
}) {
  const t = useTranslations("account");
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <TextField
        id={id}
        label={label}
        help={help}
        error={error ?? undefined}
        type={shown ? "text" : "password"}
        value={value}
        autoComplete={autoComplete}
        maxLength={200}
        onChange={(e) => onChange(e.target.value)}
        className="pr-14"
      />
      <button
        type="button"
        aria-label={shown ? t("hide") : t("show")}
        aria-pressed={shown}
        onClick={() => setShown((s) => !s)}
        className="absolute top-[30px] right-1 grid size-12 place-items-center rounded-pill border-0 bg-transparent text-text-muted hover:text-text"
      >
        {shown ? <EyeSlashIcon aria-hidden size={20} /> : <EyeIcon aria-hidden size={20} />}
      </button>
    </div>
  );
}
