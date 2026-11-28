---
name: PetSales Scam Checker
source: Adapted from the Sentry design system in the Awesome Design library (structure, keyword chip, sticker rhythm, button caps). Brand, colours, logo and imagery are PetSales' own.
colors:
  canvas: "#12053B"        # PetSales logo indigo, the only background
  accent: "#17E4D6"        # PetSales aqua, the only accent
  on-accent: "#12053B"
  text: "#FFFFFF"
  text-muted: "rgba(255,255,255,0.76)"
  text-faint: "rgba(255,255,255,0.60)"
  surface: "rgba(23,228,214,0.05)"
  surface-raised: "rgba(23,228,214,0.10)"
  line: "rgba(23,228,214,0.16)"
  line-strong: "rgba(23,228,214,0.32)"
typography:
  display: { family: "Archivo", weight: 800, tracking: "-0.025em", use: "h1, section titles, register state codes, rule titles" }
  ui: { family: "Rubik", weights: [400, 500, 600, 700], use: "all body, labels, buttons" }
  mono: { family: "Geist Mono", use: "scores, points, breeder numbers only" }
  h1: "clamp(2.4rem, 5vw, 4rem) / 1.04"
  title: "clamp(1.9rem, 3.4vw, 2.75rem) / 1.06"
  body: "16px / 1.6; marketing lede 18px / 1.75"
  button: "14px / 700 / uppercase / 0.06em"
rounded: { chip: 4px, input: 6px, button: 8px, panel: 12px, image: 18px, status-pill: 9999px }
spacing: { section: 96px (64px mobile), container: 1180px, gutter: 24px (16px mobile) }
---

# PetSales Scam Checker design system

## Principles
- **The page is the checker.** The first viewport holds a working check beside an example report.
- **Two colours, no more.** Indigo canvas, aqua accent, white text. Every surface and line is a tint of the aqua. Risk states are told by words and icons, not extra colours.
- **Warning signs, never accusations.** Copy never calls a seller a scammer.

## Signature devices
- **Keyword chip:** the decisive words in a heading sit in a solid aqua chip with indigo text (`.hl`). One chip per heading, at most.
- **Stickers:** line-drawn animals cut from the PetSales logo (`public/stickers/`) sit between sections on the bare canvas, never inside boxes.
- **Scanning report:** in the hero, the example report's warning rows tick in one by one after an aqua scan line. Static under reduced motion.

## Components
- **Primary button:** aqua fill, indigo uppercase label, 8px radius, 52px tall, soft aqua glow. One primary action per section.
- **Ghost button:** transparent, white label, aqua-tint border.
- **Input:** indigo fill, 6px radius, aqua-tint border, aqua focus ring. Label above, help or error below.
- **Panel:** aqua 5% tint, 12px radius, 1px aqua-tint border. Used for the checker and report only.
- **Check chips:** 4px radius, aqua 10% tint, white 14px text.
- **Status pill:** full radius; "live" is solid aqua, others outlined.
- **Icons:** Phosphor, one family; duotone 40px in the rules list, regular 22px elsewhere.

## Layout
- Hero: 55/45 split, stacks on mobile with the checker first.
- Checks: sticky intro with photo on the left, grouped list on the right.
- Registers: four columns divided by hairlines, two by two on tablet, stacked on phones.
- Rules: open list with large icons, no boxes.
- No eyebrows, no section numbers, no same-size icon cards.

## Browser surfaces
Selection is aqua on indigo, the caret and form accents are aqua, and scrollbars are aqua on indigo.
