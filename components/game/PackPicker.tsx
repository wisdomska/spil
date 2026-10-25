"use client";

import { CheckIcon, DropIcon, InfoIcon } from "@phosphor-icons/react";
import * as RadioGroup from "@radix-ui/react-radio-group";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { PackGlyph } from "@/components/brand/PackGlyph";
import { Button } from "@/components/ui/Button";
import { InlineError } from "@/components/ui/ErrorLine";
import { Sheet } from "@/components/ui/Sheet";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton";
import { api } from "@/lib/api/client";
import type { Pack, PackSection } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import type { AgeBand } from "@/lib/game";
import { useIsDesktop } from "@/lib/useMedia";

const PACK_INFO = new Set(["purity"]);
/** SPIL-08: 5 · 10 · 15 · 20 · All. */
const COUNT_OPTIONS = [5, 10, 15, 20];
const SECTIONS: readonly PackSection[] = ["everyday", "life", "after_dark"];
const SECTION_KEY = {
  everyday: "sectionEveryday",
  life: "sectionLife",
  after_dark: "sectionAdult",
} as const;

/** Options under the pack's size, plus "All n" (App: qnOpts). */
export function countOptions(total: number) {
  return [...new Set([...COUNT_OPTIONS.filter((n) => n < total), total])].filter((n) => n > 0);
}

export function defaultCount(total: number, perGame: number) {
  const opts = countOptions(total);
  return opts.find((n) => n >= perGame) ?? opts[opts.length - 1] ?? 0;
}

type PackPickerProps = {
  packs: Pack[];
  questionsPerGame: number;
  /** The player's band: the preview endpoint checks it like the pack list does. */
  band: AgeBand;
  initialPack?: string;
  initialCount?: number;
  cta: (packName: string) => string;
  busy?: boolean;
  onContinue: (packId: string, questionCount: number) => void;
  /** Shown above the Continue button (the visible bot check, SPIL-05). */
  aboveCta?: React.ReactNode;
  /** Shown under the Continue button: why the last try failed (SPIL-05). */
  error?: React.ReactNode;
};

/**
 * Pack picker (SPIL-08): packs grouped into sections, one tile style (light for 13+, dark for
 * 18+), exactly one selected tile, a preview for every pack, and the count and Continue button
 * in a bar that stays on screen.
 */
export function PackPicker({
  packs,
  questionsPerGame,
  band,
  initialPack,
  initialCount,
  cta,
  busy,
  onContinue,
  aboveCta,
  error,
}: PackPickerProps) {
  const t = useTranslations("packs");
  const ti = useTranslations("packInfo.purity");
  const tc = useTranslations("common");
  const desktop = useIsDesktop();
  const sections = SECTIONS.map((key) => ({
    key,
    packs: packs.filter((p) => (p.minAge >= 18 ? "after_dark" : p.section) === key),
  })).filter((s) => s.packs.length > 0);
  const ordered = sections.flatMap((s) => s.packs);
  const [selected, setSelected] = useState(initialPack ?? ordered[0]?.id ?? "");
  const pack = ordered.find((p) => p.id === selected) ?? ordered[0];
  const total = pack?.questionCount ?? 0;
  const [chosen, setChosen] = useState<number | null>(initialCount ?? null);
  const options = countOptions(total);
  const count = chosen && options.includes(chosen) ? chosen : defaultCount(total, questionsPerGame);
  const [info, setInfo] = useState<string | null>(null);
  const [preview, setPreview] = useState<Pack | null>(null);

  // Masonry: 4px rows; each tile spans its measured height.
  const grid = useRef<HTMLDivElement>(null);
  const [spans, setSpans] = useState<Record<string, number>>({});
  const measure = () => {
    const el = grid.current;
    if (!el) return;
    const first = el.querySelector<HTMLElement>("[data-masonry]");
    const gap = (first && parseFloat(getComputedStyle(first).columnGap)) || 12;
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
        className="grid"
      >
        {sections.map((section) => (
          <Fragment key={section.key}>
            <h2 className="m-0 px-2 pt-6 pb-3 text-[14px] leading-none font-semibold tracking-wide text-text-muted uppercase">
              {t(SECTION_KEY[section.key])}
            </h2>
            <div
              data-masonry
              className="grid grid-flow-row-dense grid-cols-2 items-start gap-x-3 p-2 lg:grid-cols-3 lg:gap-x-3.5"
              style={{ gridAutoRows: "4px", rowGap: 0 }}
            >
              {section.packs.map((p) => {
                const i = ordered.indexOf(p);
                const sel = p.id === selected;
                const adult = p.minAge >= 18;
                const hasInfo = PACK_INFO.has(p.id);
                const tileButton = adult
                  ? "border-[var(--tile-info-edge)] text-tile-on-night hover:bg-[var(--tile-info-hover)]"
                  : "border-line-strong text-tile-on-paper hover:bg-[color-mix(in_oklab,var(--tile-on-paper)_8%,transparent)]";
                return (
                  <div
                    key={p.id}
                    data-pack={p.id}
                    className="relative grid self-start"
                    style={{ gridRowEnd: `span ${spans[p.id] ?? 50}` }}
                  >
                    <RadioGroup.Item
                      value={p.id}
                      className={cn(
                        "relative box-border flex min-w-0 flex-col items-start justify-start gap-4 self-start rounded-card border p-4 pb-[72px] text-left hover:brightness-[1.08] active:scale-[.98]",
                        adult
                          ? "border-line bg-tile-night text-tile-on-night"
                          : "border-transparent bg-tile-paper text-tile-on-paper",
                      )}
                      style={{
                        // 2 px ring with a 2 px offset; only the chosen tile has it.
                        boxShadow: sel ? "0 0 0 2px var(--bg), 0 0 0 4px var(--accent)" : "none",
                        transition: "box-shadow 180ms var(--ease-out), filter 150ms ease",
                      }}
                    >
                      <div className="flex w-full flex-wrap items-center gap-2">
                        <span
                          className="grid shrink-0 place-items-center rounded-full"
                          style={{
                            background: adult ? "var(--adult-badge)" : "var(--accent)",
                            color: adult ? "var(--adult-badge-ink)" : "var(--tile-night-glyph-ink)",
                            width: desktop ? 52 : 44,
                            height: desktop ? 52 : 44,
                            transform: `rotate(${i % 2 ? 6 : -6}deg)`,
                          }}
                        >
                          <PackGlyph icon={p.icon} />
                        </span>
                        {adult ? (
                          <span className="inline-flex h-7 items-center rounded-pill border-[1.5px] border-adult-badge-edge bg-adult-badge px-2.5 font-mono text-[12px] leading-none font-bold whitespace-nowrap text-adult-badge-ink">
                            {t("badge18")}
                          </span>
                        ) : p.minAge === 16 ? (
                          <span className="inline-flex h-7 items-center rounded-pill border-[1.5px] border-line-strong px-2.5 font-mono text-[12px] leading-none font-bold whitespace-nowrap">
                            {t("badge16")}
                          </span>
                        ) : (
                          p.id === "classic" && (
                            <span className="inline-flex h-7 items-center rounded-pill bg-accent px-2.5 text-[12px] leading-none font-bold whitespace-nowrap text-on-accent">
                              {t("starter")}
                            </span>
                          )
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
                        <span className="font-display text-[24px] leading-none font-extrabold tracking-[-.02em] text-balance">
                          {p.name}
                        </span>
                        <span className="text-[14px] leading-[1.35] text-pretty">{p.blurb}</span>
                        <span className="mt-1 font-mono text-[13px] leading-none font-medium">
                          {tc(
                            p.format === "statements"
                              ? "statements"
                              : p.format === "prompts"
                                ? "prompts"
                                : p.format === "flags"
                                  ? "scenarios"
                                  : p.format === "open"
                                    ? "open"
                                    : "questions",
                            { count: p.questionCount },
                          )}
                        </span>
                      </div>
                    </RadioGroup.Item>
                    <div className="absolute bottom-4 left-4 z-[3] flex gap-1.5">
                      <button
                        type="button"
                        aria-label={t("previewAria", { pack: p.name })}
                        onClick={() => setPreview(p)}
                        className={cn(
                          "flex h-11 items-center gap-1.5 rounded-pill border bg-transparent px-3 text-[14px] leading-none font-semibold whitespace-nowrap",
                          tileButton,
                        )}
                      >
                        {t("preview")}
                      </button>
                      {hasInfo && (
                        <button
                          type="button"
                          aria-label={t("howPackWorks", { pack: p.name })}
                          onClick={() => setInfo(p.id)}
                          className={cn(
                            "grid size-11 place-items-center rounded-pill border bg-transparent",
                            tileButton,
                          )}
                        >
                          <InfoIcon size={18} aria-hidden />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Fragment>
        ))}
      </RadioGroup.Root>

      {/* Count and Continue stay on screen at every size (SPIL-08). */}
      <div
        className={cn(
          "sticky bottom-0 z-[5] -mx-5 mt-auto border-t border-line bg-surface/90 px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] backdrop-blur-[14px]",
          "lg:mx-0 lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-x-8 lg:rounded-t-card lg:px-5",
        )}
      >
        <div className="grid gap-2">
          <span id="spil-qn" className="sr-only">
            {t("howMany")}
          </span>
          <span className="text-[13px] leading-none text-text-muted">
            {t("minutes", { n: minutes })}
          </span>
          <RadioGroup.Root
            aria-labelledby="spil-qn"
            value={String(count)}
            onValueChange={(v) => setChosen(Number(v))}
            className="flex flex-wrap gap-1.5"
          >
            {options.map((n) => (
              <RadioGroup.Item
                key={n}
                value={String(n)}
                className={cn(
                  "h-11 min-w-12 rounded-pill border-[1.5px] px-3.5 text-[15px] leading-none font-semibold tabular-nums hover:border-text",
                  n === count
                    ? "border-accent bg-accent-soft text-accent-ink"
                    : "border-line-strong bg-transparent text-text",
                )}
              >
                {n === total ? t("all", { n }) : n}
              </RadioGroup.Item>
            ))}
          </RadioGroup.Root>
        </div>
        <div className="mt-3 grid gap-3 lg:mt-0 lg:w-88">
          {aboveCta}
          <div>
            <Button block loading={busy} onClick={() => onContinue(pack.id, count)}>
              {cta(pack.name)}
            </Button>
            <InlineError>{error}</InlineError>
          </div>
        </div>
      </div>

      <PackPreview
        pack={preview}
        band={band}
        onClose={() => setPreview(null)}
        onPick={(id) => {
          setSelected(id);
          setPreview(null);
        }}
      />

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

/** Three sample questions, a spice meter and "Pick {pack}" (SPIL-08). */
function PackPreview({
  pack,
  band,
  onClose,
  onPick,
}: {
  pack: Pack | null;
  band: AgeBand;
  onClose: () => void;
  onPick: (id: string) => void;
}) {
  const t = useTranslations("packs");
  const tq = useTranslations("question");
  const q = useQuery({
    queryKey: ["pack-preview", pack?.id, band],
    queryFn: () => api<{ questions: string[] }>("GET", `/packs/${pack!.id}/preview?band=${band}`),
    enabled: Boolean(pack),
    staleTime: 5 * 60_000,
  });
  return (
    <Sheet open={pack !== null} onOpenChange={(o) => !o && onClose()} title={pack?.name ?? ""}>
      {pack && (
        <>
          <div
            role="img"
            aria-label={t("spice", { n: pack.spice })}
            className="flex items-center gap-1"
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <DropIcon
                key={n}
                size={22}
                aria-hidden
                weight={n <= pack.spice ? "fill" : "regular"}
                className={n <= pack.spice ? "text-accent" : "text-text-muted"}
              />
            ))}
          </div>
          {q.data ? (
            <ul className="m-0 grid list-none gap-2.5 p-0">
              {q.data.questions.map((text) => (
                <li
                  key={text}
                  className="grid gap-1.5 rounded-card border border-line bg-surface p-4"
                >
                  {/* Statements (Hot Takes) read on their own; prompts and questions get their opener. */}
                  {pack?.format !== "statements" &&
                    pack?.format !== "flags" &&
                    pack?.format !== "open" &&
                    pack?.format !== "pairs" && (
                      <span className="text-[13px] leading-none font-semibold text-text-muted">
                        {pack?.format === "prompts" ? tq("likelyPrefix") : tq("haveYouEver")}
                      </span>
                    )}
                  <span className="text-[17px] leading-[1.35] font-semibold text-pretty">
                    {text}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <SkeletonGroup label={t("previewAria", { pack: pack.name })} className="gap-2.5">
              {[0, 1, 2].map((n) => (
                <Skeleton key={n} className="h-[76px] rounded-card" />
              ))}
            </SkeletonGroup>
          )}
          <Button onClick={() => onPick(pack.id)}>{t("pick", { pack: pack.name })}</Button>
        </>
      )}
    </Sheet>
  );
}
