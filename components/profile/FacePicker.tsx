"use client";

import * as RadioGroup from "@radix-ui/react-radio-group";
import { useTranslations } from "next-intl";
import { Avatar } from "@/components/brand/Avatar";
import { avatarKey } from "@/lib/game";

/** The face grid (SPIL-26 names every face for screen readers). */
export function FacePicker({
  faces,
  value,
  onChange,
}: {
  faces: number[];
  value: number;
  onChange: (face: number) => void;
}) {
  const t = useTranslations("profile");
  return (
    <fieldset className="m-0 grid gap-3 border-0 p-0">
      <legend className="mb-3 p-0 text-[14px] leading-none font-semibold">{t("face")}</legend>
      <RadioGroup.Root
        aria-label={t("avatarGroup")}
        value={String(value)}
        onValueChange={(v) => onChange(Number(v))}
        className="grid grid-cols-6 gap-x-1 gap-y-1.5"
      >
        {faces.map((i) => (
          <RadioGroup.Item
            key={i}
            value={String(i)}
            aria-label={t("avatar", { name: t(`avatarNames.${avatarKey(i)}`) })}
            className="grid h-[54px] place-items-center rounded-pill border-0 bg-transparent p-0 hover:bg-surface-raised"
          >
            <Avatar n={i} size={42} selected={value === i} decorative />
          </RadioGroup.Item>
        ))}
      </RadioGroup.Root>
    </fieldset>
  );
}
