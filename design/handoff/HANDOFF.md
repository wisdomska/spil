# SPIL handoff notes

Stack: Next.js, Tailwind v4 (`tokens.css` + `spil-theme.css`), Radix primitives, Motion.
Design files: `SPIL Design System` (art direction, tokens, avatars, components), `SPIL Prototype` (clickable host + guest flow), `SPIL Screens *` (every state, both themes, mobile + desktop, admin), `SPIL Share Cards`.

## Breakpoints
- Base: 360 to 599. Design width 390. Single column, max content 520, side padding 20.
- `md` 600: same column, wider gutters. Pack grid goes to 3 columns via `repeat(auto-fill, minmax(150px, 1fr))`.
- `lg` 1024: in-room screens get the 340 px left panel (room code, players with status, theme toggle, leave). Main column stays 520 max, top padding 48. Bottom sheets become centered modals (440 wide).
- `xl` 1280: landing hero splits into text + phone, steps run 3 across. Long-form pages cap at 720.
- Reveal is always a full-bleed stage, max 560 wide, on every size (it gets cast to TVs).
- Use container query units for the hero headline: `clamp(46px, 7.2cqi, 100px)` on a `container-type: inline-size` wrapper.

## Motion specs
Curves: `--ease-out: cubic-bezier(.23,1,.32,1)` (enter/exit), `--ease-in-out: cubic-bezier(.77,0,.175,1)` (on-screen morph), `--ease-drawer: cubic-bezier(.32,.72,0,1)` (sheets). Never ease-in. Animate `transform`, `opacity` and `clip-path` only. UI motion stays under 300 ms; only the reveal ceremony and the pour run longer.

| Token | Spec | Where |
|---|---|---|
| press | scale .97 (.92 icon buttons, .98 pack tiles), 160 ms ease-out, CSS transition | every pressable; `navigator.vibrate(10)` on answer |
| card-follow | drag x 1:1, `rotate = clamp(x / 14, -12, 12)`, no transition while dragging | question card (`useMotionValue`, no React state on pointermove) |
| card-flick | to `x ±520` + fade, 200 ms ease-out | abs(x) > 96, or abs(x) > 24 with velocity > 0.11 px/ms |
| card-return | 320 ms `cubic-bezier(.34,1.3,.64,1)` (slight overshoot), interruptible | released under threshold |
| card-rise | from `scale .96, y 10, opacity 0`, same curve | next card |
| keyboard answer | no motion; card text swaps instantly | Y / N / arrow keys (repeated 50x a game) |
| progress pour | `clip-path: inset(0 X% 0 0 round 999px)`, 300 ms ease-out; drip rides a translateX layer | question progress |
| vessel fill | fill layer `translateY(100 - level%)`, number counter-translated; 1.4 s waiting, 3 s waking | never animate height |
| wave | 26 px strip, `translateX` loop, 1.6 s linear | vessels only, off in reduced motion |
| switch | knob `translateX(20px)`, 200 ms `(.34,1.4,.64,1)`, interruptible | Spill Mode, Hide my name |
| theme icon | remount with rotate -70 / scale .6 / fade, 240 ms ease-out; colours swap instantly | theme toggle |
| copy | icon swaps to check for 1.6 s + toast | copy link |
| check-tick | from scale .6 rotate -20, 260 ms `(.34,1.56,.64,1)` | pack selected |
| sticker-slap | from scale 1.9 rotate -14, 480 to 520 ms spring-like | reveal label, award sticker, error sticker (rare, ceremonial) |
| lobby-drop | from y -24 scale 1.12, 420 ms `(.34,1.4,.64,1)` | player joins |
| toast | from y 8 + fade, 240 ms ease-out | toasts |
| sheet | from y 100%, 400 ms ease-drawer | mobile sheets |
| modal | from scale .96 + fade, 200 ms ease-out, centred origin | desktop dialogs |
| count-up | 1400 ms, easeOutCubic, integer steps | reveal score |
| beats | 700 ms intro, 450 ms between players, 150 ms count to label, 1200 ms hold, 550 ms before each award, 1900 ms hold | reveal choreography |

Deliberately not animated: screen changes, theme colour swap, slider thumb (pointer and keys), tab switches, hover (colour only, no movement).

Reveal order: players sorted by score ascending, then 6 awards in fixed order (Top Spiller, Saint of the Room, Mind Reader, Dark Horse, Open Book, Clueless). Skip is always visible and jumps to results. Total about 33 s for 7 players.

`prefers-reduced-motion`: keep opacity and colour, drop movement (every keyframe falls back to a fade, transitions limited to opacity/colour), cards swap without flying, final score shows with no count, beats stay (they carry order), wave stops.

## Rules an engineer could get wrong
1. One accent. No other hues except `error` and `success`, and those only for state. Stickers use accent, ink, or inverse.
2. Light accent is `#D63D1D`, not `#E5401F` (white on `#E5401F` is 4.13:1). Accent as text on light surfaces uses `--accent-ink` `#B8321A`.
3. `--line` is decorative. Inputs, code boxes and the slider track use `--line-strong` so their edge clears 3:1.
4. Only stickers rotate (-4 to 4 deg, pick from a seeded list per player so it's stable across renders). Cards, tiles, buttons never tilt.
5. One liquid moment per screen: hero phone, progress pour, waiting fill, reveal counter, results mini vessel, share card vessel. Never two at once.
6. Liquid number: render the number twice, once in `--text` over the empty vessel and once in `--on-accent` inside the fill with `overflow: hidden`, bottom-anchored at full vessel height. That is what flips the colour exactly at the waterline.
7. Grain lives on a `position: fixed; inset: 0; pointer-events: none` layer at the app root (absolute inside the device frame in the prototype). Never put it on a scrolling element: it repaints on scroll and kills 3G Androids.
8. No spinners. Loading = skeleton shaped like the final layout (`animate-breathe`) or the mini pour inside a button.
9. Bricolage Grotesque has no italic. Emphasis is `font-stretch: 75%` plus accent ink. Never let the browser synthesise italics (`font-synthesis: none`).
10. Numbers (scores, codes, timers, counts) are Geist Mono with `tabular-nums`, so counting does not jitter.
11. Touch targets 48 x 48 minimum, including the remove button inside player stickers (the visible chip is 30, the button is 48).
12. Meaning never by colour alone: Yes/No carry icon + word, statuses carry icon + word ("Done", "38/50"), errors carry icon + text.
13. Code input is one real `<input autocomplete="one-time-code" autocapitalize="characters" maxlength="4">` laid over four visual boxes. Strip spaces and dashes on paste.
14. Slider: `role="slider"`, arrows step 1, PageUp/PageDown 10, Home/End, `aria-valuetext="64, Main Character"`. Steppers are separate 48 px buttons.
15. Question stats only render for questions answered by 3 or more players. Names only for players with Spill Mode on. Spill Mode defaults off on every new game.
16. Copy has no em or en dashes anywhere. One label per intent: "Start a room", "Join with code".
17. Theme: `localStorage["spil-theme"]` = dark | light | system, applied by an inline script before first paint to avoid a flash. Default dark.
18. Theme toggles and tabs are Radix `ToggleGroup` / `Tabs` with pill items; bottom sheet and modal are Radix `Dialog` with focus trap and Escape.
19. Share cards render from one component at 1x (1080 x 1920, 1080 x 1080, 1200 x 630) to PNG. Fonts must be loaded before capture. Link text currently `spil.party` (placeholder domain).

## Score labels and awards
0 to 15 Fresh Out The Box (ink, square), 16 to 35 Mostly Innocent (raised, pill), 36 to 55 Been Around (accent, tag), 56 to 75 Main Character (accent, pill, condensed), 76 to 100 Legendary Menace (ink, square, condensed caps).
Awards: Top Spiller (drop), Saint of the Room (hands praying), Mind Reader (eye), Dark Horse (horse), Open Book (book open), Clueless (question). Phosphor regular only.

## Open items
- Pack glyphs are Phosphor icons inside sticker discs as placeholders for the custom flat glyph illustrations.
- Mood board image slots need real photography.
- Privacy and Terms copy is draft and needs legal review. "12 players max" is assumed.
