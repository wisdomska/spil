"use client";

import { CheckIcon, InfoIcon } from "@phosphor-icons/react";
import * as RadioGroup from "@radix-ui/react-radio-group";
import { useTranslations } from "next-intl";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { PackGlyph } from "@/components/brand/PackGlyph";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import type { Pack } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { useIsDesktop } from "@/lib/useMedia";

const PACK_INFO = new Set(["purity"]);
const COUNT_OPTIONS = [5, 10, 15, 20, 30, 50];

/** Options under the pack's size, plus "All n" (App: qnOpts). */
export function countOptions(total: number) {
  return [...new Set([...COUNT_OPTIONS.filter((n) => n < total), total])].filter((n) => n > 0);
}

export function defaultCount(total: number, perGame: number) {
  const opts = countOptions(total);
  return opts.find((n) => n >= perGame) ?? opts[opts.length - 1] ?? 0;
}

const BADGE = { spicy: "badgeSpicy", explicit: "badgeExplicit", intense: "badgeIntense" } as const;

type PackPickerProps = {
  packs: Pack[];
  questionsPerGame: number;
  initialPack?: string;
  initialCount?: number;
  cta: (packName: string) => string;
  busy?: boolean;
  onContinue: (packId: string, questionCount: number) => void;
};

/** Masonry pack grid with a featured first tile, question count picker and CTA (App: packs). */
export function PackPicker({
  packs,
  questionsPerGame,
  initialPack,
  initialCount,
  cta,
  busy,
  onContinue,
}: PackPickerProps) {
  const t = useTranslations("packs");
  const ti = useTranslations("packInfo.purity");
  const tc = useTranslations("common");
  const desktop = useIsDesktop();
  const [selected, setSelected] = useState(initialPack ?? packs[0]?.id ?? "");
  const pack = packs.find((p) => p.id === selected) ?? packs[0];
  const total = pack?.questionCount ?? 0;
  const [chosen, setChosen] = useState<number | null>(initialCount ?? null);
  const options = countOptions(total);
  const count = chosen && options.includes(chosen) ? chosen : defaultCount(total, questionsPerGame);
  const [info, setInfo] = useState<string | null>(null);

  // Masonry: 4px rows; each tile spans its measured height.
  const grid = useRef<HTMLDivElement>(null);
  const [spans, setSpans] = useState<Record<string, number>>({});
  const measure = () => {
    const el = grid.current;
    if (!el) return;
    const gap = parseFloat(getComputedStyle(el).columnGap) || 12;
    const next: Record<string, number> = {};
    el.querySelectorAll<HTMLElement>("[data-pack]").forEach((cell) => {
      next[cell.dataset.pack!] = Math.ceil(
        (cell.firstElementChild!.getBoundingClientRect().height + gap) / 4,
      );
    });
    setSpans((cur) => (Object.keys(next).some((k) => next[k] !== cur[k]) ? next : cur));
  };
  useLayoutEffect(measure);
  useEffect(() => {
    const el = grid.current;
    if (!el) return;
    const ro = new ResizeObserver(() => requestAnimationFrame(measure));
    el.querySelectorAll("[data-pack] > *").forEach((c) => ro.observe(c));
    ro.observe(el);
    document.fonts?.ready.then(measure);
    return () => ro.disconnect();
  });

  if (!pack) return <p className="text-text-muted">{t("empty")}</p>;
  const minutes = Math.max(1, Math.round((count * 7) / 60));

  return (
    <>
      <RadioGroup.Root
        ref={grid}
        aria-label={t("group")}
        value={selected}
        onValueChange={setSelected}
        className="grid grid-flow-row-dense grid-cols-2 items-start gap-x-3 p-2 lg:grid-cols-3 lg:gap-x-3.5"
        style={{ gridAutoRows: "4px", rowGap: 0 }}
      >
        {packs.map((p, i) => {
          const feat = i === 0;
          const sel = p.id === selected;
          const adult = p.isAdult;
          const classic = p.id === "classic";
          const tile = adult
            ? "bg-tile-night text-tile-on-night border border-line"
            : classic
              ? "bg-accent text-on-accent border border-transparent"
              : "bg-tile-paper text-tile-on-paper border border-transparent";
          const glyph = adult
            ? { background: "var(--adult-badge)", color: "var(--adult-badge-ink)" }
            : classic
              ? { background: "var(--tile-night-glyph-ink)", color: "var(--tile-on-night)" }
              : { background: "var(--accent)", color: "var(--tile-night-glyph-ink)" };
          const glyphSize = feat ? 60 : desktop ? 52 : 44;
          const hasInfo = PACK_INFO.has(p.id);
          return (
            <div
              key={p.id}
              data-pack={p.id}
              className="relative grid self-start"
              style={{
                gridColumn: feat ? "1 / -1" : "auto",
                gridRowEnd: `span ${spans[p.id] ?? 50}`,
              }}
            >
              <RadioGroup.Item
                value={p.id}
                className={cn(
                  "relative box-border flex min-w-0 flex-col items-start justify-start gap-4 self-start rounded-card text-left hover:brightness-[1.08] active:scale-[.98]",
                  tile,
                  feat ? "p-5" : "p-4",
                  hasInfo && "pb-[76px]",
                )}
                style={{
                  boxShadow: sel ? "0 0 0 3px var(--bg), 0 0 0 6px var(--accent)" : "none",
                  transform: sel ? "translateY(-2px)" : "none",
                  transition:
                    "box-shadow 180ms var(--ease-out), transform 180ms var(--ease-out), filter 150ms ease",
                }}
              >
                <div className="flex w-full flex-col items-start gap-3">
                  <span
                    className="grid shrink-0 place-items-center rounded-full"
                    style={{
                      ...glyph,
                      width: glyphSize,
                      height: glyphSize,
                      transform: `rotate(${i % 2 ? 6 : -6}deg)`,
                    }}
                  >
                    <PackGlyph icon={p.icon} />
                  </span>
                  {adult && p.heat && (
                    <span className="inline-flex h-7 items-center rounded-pill border-[1.5px] border-adult-badge-edge bg-adult-badge px-2.5 font-mono text-[12px] leading-none font-bold whitespace-nowrap text-adult-badge-ink">
                      {t(BADGE[p.heat])}
                    </span>
                  )}
                </div>
                {sel && (
                  <span
                    aria-hidden
                    className="absolute -top-3 -right-2.5 grid size-10 animate-tick place-items-center rounded-full border-[3px] border-sticker-edge bg-accent text-on-accent"
                    style={{ boxShadow: "0 0 0 1.5px var(--sticker-ring)", rotate: "8deg" }}
                  >
                    <CheckIcon size={20} />
                  </span>
                )}
                <div className="grid w-full gap-1.5 text-left">
                  <span
                    className="font-display leading-none font-extrabold tracking-[-.02em] text-balance"
                    style={{ fontSize: feat ? 36 : 24 }}
                  >
                    {p.name}
                  </span>
                  <span className="text-[14px] leading-[1.35] text-pretty">{p.blurb}</span>
                  <span className="mt-1 font-mono text-[13px] leading-none font-medium">
                    {tc("questions", { count: p.questionCount })}
                  </span>
                </div>
              </RadioGroup.Item>
              {hasInfo && (
                <button
                  type="button"
                  aria-label={t("howPackWorks", { pack: p.name })}
                  onClick={() => setInfo(p.id)}
                  className="absolute bottom-4 left-4 z-[3] box-border flex h-11 items-center justify-center gap-1.5 rounded-pill border border-[var(--tile-info-edge)] bg-transparent text-[14px] leading-none font-semibold whitespace-nowrap text-tile-on-night hover:bg-[var(--tile-info-hover)] lg:px-4 lg:pl-3"
                  style={{ width: desktop ? "auto" : 44 }}
                >
                  <InfoIcon size={20} aria-hidden />
                  {desktop && <span>{t("howItWorks")}</span>}
                </button>
              )}
            </div>
          );
        })}
      </RadioGroup.Root>

      <div
        className={cn(
          "mt-auto px-2",
          desktop
            ? "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-8 gap-y-2.5 pt-2"
            : "grid gap-5 pt-1",
        )}
      >
        <div className={desktop ? "contents" : "grid gap-2.5"}>
          <span id="spil-qn" className="col-start-1 text-[15px] leading-none font-semibold">
            {t("howMany")}
          </span>
          <RadioGroup.Root
            aria-labelledby="spil-qn"
            value={String(count)}
            onValueChange={(v) => setChosen(Number(v))}
            className="col-start-1 row-start-2 flex flex-wrap gap-2"
          >
            {options.map((n) => (
              <RadioGroup.Item
                key={n}
                value={String(n)}
                className={cn(
                  "h-12 min-w-14 rounded-pill border-[1.5px] px-[18px] text-[15px] leading-none font-semibold tabular-nums hover:border-text",
                  n === count
                    ? "border-accent bg-accent-soft text-accent-ink"
                    : "border-line-strong bg-transparent text-text",
                )}
              >
                {n === total ? t("all", { n }) : n}
              </RadioGroup.Item>
            ))}
          </RadioGroup.Root>
          <span className="col-start-1 text-[14px] leading-[1.4] text-text-muted">
            {t("minutes", { n: minutes })}
          </span>
          {PACK_INFO.has(pack.id) && (
            <button
              type="button"
              onClick={() => setInfo(pack.id)}
              className="col-start-1 -ml-2.5 flex h-11 items-center gap-1.5 justify-self-start rounded-pill border-0 bg-transparent pr-3.5 pl-2.5 text-[14px] leading-none font-semibold text-accent-ink hover:bg-surface-raised"
            >
              <InfoIcon size={18} aria-hidden />
              {t("scoringInfo")}
            </button>
          )}
        </div>
        <div className={desktop ? "col-start-2 row-start-2 min-w-80" : "w-full"}>
          <Button block size="md" loading={busy} onClick={() => onContinue(pack.id, count)}>
            {cta(pack.name)}
          </Button>
        </div>
      </div>

      <Sheet open={info !== null} onOpenChange={(o) => !o && setInfo(null)} title={ti("title")}>
        <div className="grid min-w-0 gap-4">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="grid gap-1">
              <span className="text-[15px] leading-[1.2] font-bold">{ti(`s${n}h`)}</span>
              <span className="text-[15px] leading-[1.5] text-pretty text-text-muted">
                {ti(`s${n}p`)}
              </span>
            </div>
          ))}
        </div>
        <Button onClick={() => setInfo(null)}>{tc("gotIt")}</Button>
      </Sheet>
    </>
  );
}
