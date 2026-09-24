# Design language: "Glovebox folder"

The approved visual direction for the web app (UX audit of 23-09-2026, direction A, approved 24-09-2026). The app should feel calm and trustworthy, like the folder of papers kept in the glovebox, and each vehicle is identified by its Indian number plate. The visual reference is the "A · final" page of the [design canvas](https://claude.ai/artifact/6RCPcP3KYCb9AJjNDEahMR).

This is the spec the Phase 1 tokens and components are built from. Where it names a token, the code name follows in `code`; the values live in `apps/web/src/styles/tokens.css`.

## Principles

1. **The plate is the identity.** Wherever a vehicle is named, its number plate appears with it. The nickname is secondary.
2. **Say when, not just what.** Every status is a dot plus words that give a time: "3 days late", "Today", "153 days left", "Ended 20 Sep". Status never relies on colour alone, and never uses vague words like "Active" or "In force".
3. **Calm by default.** Flat surfaces, one accent colour, sentence case, no uppercase micro-labels. Emphasis comes from hierarchy, not weight.
4. **The next action is always one tap away.** Each row carries its one verb (Renew, Log service, Done). On phone the primary action is pinned to the bottom.
5. **Numbers must be right and readable.** Rupees use Indian grouping (₹1,31,624) with tabular numerals; dates read "23 Sep 2026" or "Wed 23 Sep"; nothing is shown that the data can't support.

## Colour

Semantic names only; screens never use palette colours (`slate-500`, `rose-50`) directly. Lint enforces this and the other rules below (`apps/web/eslint/design-system-plugin.js`): errors on migrated paths, warnings elsewhere until each area moves.

| Token                   | CSS variable → Tailwind utility        | Light                                       | Dark      | Use                                                  |
| ----------------------- | -------------------------------------- | ------------------------------------------- | --------- | ---------------------------------------------------- |
| surface.page (Kerb)     | `--surface-page` → `bg-page`           | `#F3F4F6`                                   | `#0F1216` | App background                                       |
| surface.card (Chassis)  | `--surface-card` → `bg-surface`        | `#FFFFFF`                                   | `#171B21` | Cards, sheets (the number plate stays white in dark) |
| border (Line)           | `--line` → `border-line`               | `#DADDE3`                                   | `#2A3038` | 1px borders                                          |
| border.subtle           | `--line-subtle` → `border-line-subtle` | `#E7E9ED`                                   | `#232830` | Row dividers                                         |
| text (Tarmac)           | `--fg` → `text-fg`                     | `#15181E`                                   | `#ECEEF1` | Primary text, plate lettering                        |
| text.2                  | `--fg-2` → `text-fg-2`                 | `#4A505C`                                   | `#AEB4BD` | Secondary text                                       |
| text.3                  | `--fg-3` → `text-fg-3`                 | `#626874`                                   | `#8E95A0` | Captions (≥ 4.5:1 on card)                           |
| brand (Petrol teal)     | `--brand` → `bg-brand`, `text-brand`   | `#0E5C63`                                   | `#6FD0CA` | Primary buttons, links, active nav, focus ring       |
| on brand                | `--on-brand` → `text-on-brand`         | `#FFFFFF`                                   | `#0F1216` | Text on a brand fill (dark text in dark mode)        |
| brand.tint              | `--brand-tint` → `bg-brand-tint`       | `#E3F0F0`                                   | `#1E2A2C` | Active nav, selected chips                           |
| late (Brake red)        | `--late`, `--late-tint`                | `#B42318` on `#FCE9E7`                      | `#FF8A80` | Overdue, expired, errors                             |
| soon (Indicator amber)  | `--soon`, `--soon-dot`, `--soon-tint`  | text `#8A5300`, dot `#D98200`, bg `#FFF1D6` | `#F5B452` | Due today or this week                               |
| on late                 | `--on-late` → `text-on-late`           | `#FFFFFF`                                   | `#0F1216` | Text on a late fill (the final Delete in a confirm)  |
| ok (PUC green)          | `--ok`, `--ok-tint`                    | `#1C7A47` on `#E4F3EA`                      | `#6FCF97` | Valid, done, all clear                               |
| ended                   | `--ended`, `--ended-dot`               | text `#4A505C`, dot `#C4C8D0`               | `#AEB4BD` | Lapsed but not urgent (e.g. warranty ended)          |
| plate.strip (HSRP blue) | `--plate-strip`                        | `#1D4E9E`                                   | same      | Only the plate's IND strip                           |
| plate.ev                | `--plate-ev`                           | `#1E7F4A` bg, white text                    | same      | Electric vehicles, as on the road                    |

One value differs from the approved boards, for contrast: the ok text is `#1C7A47` rather than the boards' `#1E7F4A`, which reads 4.37:1 on its tint, under AA. The electric plate keeps `#1E7F4A`, where white text reads 5.0:1. The spec gives one dark value for each status colour; their dark tints are derived as the status colour at 16% over the dark card, and the dark `ended` dot (`#5B626D`) is derived to stay quieter than its text.

The shadcn variables the UI components read are mapped onto these tokens:

| shadcn                                             | Token            |
| -------------------------------------------------- | ---------------- |
| `background`, `card`, `popover`                    | surface.card     |
| `foreground` and every `*-foreground` on a surface | text             |
| `muted-foreground`                                 | text.2           |
| `muted`, `secondary`, `accent`                     | surface.page     |
| `primary` / `primary-foreground`                   | brand / on brand |
| `destructive` / `destructive-foreground`           | late / on late   |
| `border`, `input`                                  | border           |
| `ring`                                             | brand            |

A `--scrim` token dims the page behind dialogs and sheets.

Every token pair used for text meets WCAG AA (4.5:1). `apps/web/src/styles/tokens.spec.ts` reads `tokens.css` and checks each pair, in both light and dark. Class names are merged by `cn` (`apps/web/src/lib/utils.ts`), which is taught the token names; add a new token there too.

## Type

- **Display: Anek Latin**, width 92%, weight 600–650. Page titles, section headings, vehicle names (`font-display`; `h1` and `h2` use it by default). Plate lettering at width 78%, weight 700, letter-spacing 0.06–0.08em.
- **UI: IBM Plex Sans** 400/500/600 (`font-sans`, the default). Tabular numerals on every figure (the body sets `tabular-nums`).
- **Identifiers: IBM Plex Mono** 500/600 (`font-mono`), only for policy, certificate and receipt numbers that people read out.
- Fonts are self-hosted from `apps/web/public/fonts/` (Fontsource's Latin subset, plus Latin Extended, which carries the ₹ sign and loads only where one appears), with `font-display: swap`; Plex Sans 400 and 600 are preloaded. Nothing loads from Google Fonts.
- **Scale (px):** 12 · 13 · 15 · 17 · 20 · 28 · 40, as `text-caption`, `text-small`, `text-body`, `text-lead`, `text-heading`, `text-title`, `text-display`. Body 15; nothing under 12. Sentence case everywhere.

## The number plate (`NumberPlate`)

| Size | Height | Border | Radius | Strip     | Font | Used in                          |
| ---- | ------ | ------ | ------ | --------- | ---- | -------------------------------- |
| S    | 22     | 1.25   | 3      | 5         | 13   | List rows, attention queue       |
| M    | 36     | 2      | 5      | 9         | 21   | Garage cards, log-service header |
| L    | 56     | 2.5    | 6      | 22, "IND" | 32   | Vehicle header                   |
| XL   | 72     | 3      | 8      | 26, "IND" | 40   | Show papers (checkpoint)         |

Variants: private (white), electric (green, white text), BH series (`22 BH 1234 AA` spacing). Format the plate as state · district · series · number. Where no number is known, show a dashed "empty plate" whose call to action is to add the vehicle.

## Shape, space, motion

- Radius 6 for controls (`rounded-control`), 10 for cards (`rounded-card`), 12 for sheets (`rounded-sheet`). Pills (999) only for chips and count badges.
- Flat cards with 1px borders on Kerb. The one shadow (`shadow-overlay`) is reserved for menus, popovers and sheets.
- 4px grid: 8 · 12 · 16 · 20 · 24 · 32 · 40.
- Touch targets 44px; primary phone actions 52px, pinned to the bottom above the bottom bar.
- Motion: 150ms colour/opacity transitions; one orchestrated moment (the attention list settling on load); all motion behind `prefers-reduced-motion`.
- Icons: lucide, 1.75 stroke, 16 / 20 / 22 only.

## Key patterns (drawn on the canvas)

- **Home:** date → H1 count ("4 things need you this week") → one-sentence status → attention list grouped Late / This week (plate · task · when · verb) → recently logged; side column: Papers health bar, Garage status per vehicle, Costs.
- **Vehicle page:** L plate + name + model and odometer line; Show papers · Log ▾ · more menu; tabs Overview · History · Reminders · Papers (status dot) · More. Overview shows what needs attention first, then last service beside the next one due (with the reading it was counted from), costs with honest empty states, and sharing presented as an invitation.
- **Papers:** one slip per document with a coloured validity strip on top, issuer, dates written out, and Show; a pinned "Show papers" button.
- **Show papers:** XL plate, a large VALID/EXPIRED banner, tabs per paper, number/issuer/validity, the file, and a "Saved on this phone · works offline" line.
- **Log service:** Snap the bill / Choose file first; the due category preselected with the reason given; date and odometer defaulted and explained; total empty; extras collapsed; next due worked out; sticky Save service.
- **Dark mode:** the same layout, with the plates staying white.
