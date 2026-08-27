---
name: impeccable
description: Use when the user wants to design, redesign, shape, critique, audit, polish, clarify, distill, harden, optimize, adapt, animate, colorize, extract, or otherwise improve a frontend interface. Covers websites, landing pages, dashboards, product UI, app shells, components, forms, settings, onboarding, and empty states. Handles UX review, visual hierarchy, information architecture, cognitive load, accessibility, performance, responsive behavior, theming, anti-patterns, typography, fonts, spacing, layout, alignment, color, motion, micro-interactions, UX copy, error states, edge cases, i18n, and reusable design systems or tokens. Also use for bland designs that need to become bolder or more delightful, loud designs that should become quieter, live browser iteration on UI elements, or ambitious visual effects that should feel technically extraordinary. Not for backend-only or non-UI tasks.
version: 3.9.1
---

Designs and iterates production-grade frontend interfaces. Real working code, committed design choices, exceptional craft.

## Setup

You MUST do these steps before proceeding:

1. Run `node .agents/skills/impeccable/scripts/context.mjs` once per session; if the runtime shows this skill's loaded base directory, run `node <skill-base-dir>/scripts/context.mjs` instead. Keep cwd/workdir at the user's project, not the skill directory. If the request names or implies a file, route, or app inside a monorepo, infer the concrete path and append `--target <path>` to the same command. If you've already seen its output in this conversation, do not re-run it. The script either prints the project's PRODUCT.md (and DESIGN.md when present) as a markdown block, or tells you it's missing. Follow whatever it prints. **If it reports `NO_PRODUCT_MD`:** divert into `reference/init.md` first when the user invoked `init`, `teach`, `craft`, or `shape`, or when their wording clearly maps to one of those from-scratch build flows (for example: "build/create/make a landing page", "design a new app", or "shape a feature"). Captured product context is the point of those flows. For any other command, a scoped evaluate / refine / enhance / fix / iterate request against existing code, do **not** divert into init. The existing code is the context: proceed with the requested command, infer the register from the surface in focus (step 4), and offer `$impeccable init` once as a suggestion the user can take later. A missing PRODUCT.md must never block a scoped request. If the output ends with an `UPDATE_AVAILABLE` directive, follow it (ask the user once about updating, then continue). It never blocks the current task.
2. If the user invoked a sub-command (`craft`, `shape`, `audit`, `polish`, ...), you MUST read the command's reference next: **`reference/<command>.md`, or the native variant from the Commands table** (e.g. `reference/audit.native.md`) **when the project platform is native** (`ios` / `android` / `adaptive`, per the `context.mjs` directive). One file, not both. Non-optional. The reference defines the command's flow; without it you will skip steps the user expects.
3. Familiarize yourself with any existing design system, conventions, and components in the code. Read at least one project file (CSS / tokens / theme / a representative component or page). **Required even when you've loaded a sub-command reference in step 2.** Don't reinvent the wheel; use what's there when it works, branch out when the UX wins.
4. Read the matching register reference. **This is non-optional; skipping it produces generic output.** If the project is marketing, a landing page, a campaign, long-form content, or a portfolio (design IS the product), read `reference/brand.md`. If it is app UI, admin, a dashboard, or a tool (design SERVES the product), read `reference/product.md`. Pick by first match: (1) task cue ("landing page" vs "dashboard"); (2) surface in focus (the page, file, or route being worked on); (3) `register` field in PRODUCT.md.
5. **If PRODUCT.md's `## Platform` is `ios` or `android`**, also read `reference/<platform>.md` (HIG / Material 3 conventions). `adaptive` (cross-platform, ships both) reads both files. `web`, absent, or unrecognized: nothing extra to read. `context.mjs` prints the directive when one applies.
6. **If the project is brand-new (no existing CSS tokens / theme / committed brand colors found in step 3)**, run `node .agents/skills/impeccable/scripts/palette.mjs` to receive a brand seed color and composition guidance. This is the anchor for your primary brand color. Compose the rest of the palette (bg, surface, ink, accent, muted) around it per the script's instructions. Use OKLCH throughout. **Skip this step only if step 3 found committed brand colors in existing tokens; in that case identity-preservation wins.**

## Design guidance

Produce ready-to-ship, production-grade code, not prototypes or starting points. Take no shortcuts unless the user asks for them (when in doubt, ask). Don't stop until arriving at a complete implementation (beautiful, responsive, fast, precise, bug-free, on brand). You take attention to detail seriously: every page, section or component crafted is battle tested using the tools available to you (browser screenshotting, computer use, etc). GPT is capable of extraordinary work. Don't hold back.

### General rules

#### Color

- **Verify contrast.** Body text must hit ≥4.5:1 against its background; large text (≥18px or bold ≥14px) needs ≥3:1. Placeholder text needs the same 4.5:1, not the muted-gray default. The most common failure: muted gray body text on a tinted near-white. If the contrast is even close, bump the body color toward the ink end of the ramp; light gray "for elegance" is the single biggest reason AI designs feel hard to read.
- Gray text on a colored background looks washed out. Use a darker shade of the background's own hue, or a transparency of the text color.

#### Typography

- Cap body line length at 65–75ch.
- Don't pair fonts that are similar but not identical (two geometric sans-serifs, two humanist sans-serifs). Pair on a contrast axis (serif + sans, geometric + humanist) or use one family in multiple weights.
- Hero / display heading ceiling: clamp() max ≤ 6rem (~96px). Above that the page is shouting, not designing.
- Display heading letter-spacing floor: ≥ -0.04em. Anything tighter and letters touch; cramped, not "designed".
- Use `text-wrap: balance` on h1–h3 for even line lengths; `text-wrap: pretty` on long prose to reduce orphans.

One hard typographic ceiling you currently miss:
- Display letter-spacing ≥ -0.04em. Your default of -0.05 to -0.085em on display H1s makes the letters touch and reads as cramped. -0.02 to -0.03em is plenty for tight grotesque display; -0.04em is the floor.

#### Layout

- Vary spacing for rhythm.
- Cards are the lazy answer. Use them only when they're truly the best affordance. Nested cards are always wrong.
- Flexbox for 1D, Grid for 2D. Don't default to Grid when `flex-wrap` would be simpler.
- For responsive grids without breakpoints: `repeat(auto-fit, minmax(280px, 1fr))`.
- Build a semantic z-index scale (dropdown → sticky → modal-backdrop → modal → toast → tooltip). Never arbitrary values like 999 or 9999.

#### Motion
- Motion should be intentional, and not be an afterthought. consider it as part of the build.
- Don't animate CSS layout properties unless truly needed.
- Ease out with exponential curves (ease-out-quart / quint / expo). No bounce, no elastic.
- Use libraries for more advanced motion needs (e.g. motion, gsap, anime.js, lenis etc)
- Reduced motion is not optional. Every animation needs a `@media (prefers-reduced-motion: reduce)` alternative: typically a crossfade or instant transition.
- Staggering the items within one list is legitimate. The tell is the uniform reflex (one identical entrance applied to every section), not motion itself; each reveal should fit what it reveals. Suppressing the reflex is never a reason to ship a page with no motion at all.
- Reveal animations must enhance an already-visible default. Don't gate content visibility on a class-triggered transition; transitions pause on hidden tabs and headless renderers, so the reveal never fires and the section ships blank.
- Premium motion materials are not just transform/opacity. Blur, backdrop-filter, clip-path, mask, and shadow/glow are part of the palette when they materially improve the effect and stay smooth.

#### Interaction

- Dropdowns rendered with `position: absolute` inside an `overflow: hidden` or `overflow: auto` container will be clipped. Use the native `<dialog>` / popover API, `position: fixed`, or a portal to escape the stacking context.

### New projects only (when no prior work exists)

#### Color & Theme

- Use OKLCH.
- **The cream / sand / beige body bg is the saturated AI default of 2026.** The whole warm-neutral band (OKLCH L 0.84-0.97, C < 0.06, hue 40-100) reads as cream/sand/paper/parchment regardless of what you call it. Token names like `--paper`, `--cream`, `--sand`, `--bone`, `--flour`, `--linen`, `--parchment`, `--wheat`, `--biscuit`, `--ivory` are tells in themselves. If the brief is "warm, traditional, family-coastal-Italian" or "magazine-warm" or "editorial-restraint", DO NOT translate that into a near-white warm-tinted bg; that's the AI move. Pick: (a) a saturated brand color as the body (terracotta, oxblood, deep ochre, near-black), (b) a true off-white at chroma 0 (or chroma toward the brand's own hue, not toward warmth-by-default), or (c) a darker mid-tone tinted neutral that's clearly the brand's own. "Warmth" in the brand is carried by accent + typography + imagery, not by body bg.
- Tinted neutrals: add 0.005–0.015 chroma toward the brand's hue. Don't default-tint toward warm or cool "because the brand feels that way"; that's the cross-project monoculture move.
- When picking a theme: Dark vs. light is never a default. Not dark "because tools look cool dark." Not light "to be safe.".Before choosing, write one sentence of physical scene: who uses this, where, under what ambient light, in what mood. If the sentence doesn't force the answer, it's not concrete enough. Add detail until it does.
- Pick a **color strategy** before picking colors. Four steps on the commitment axis:
  - **Restrained**: tinted neutrals + one accent ≤10%. Product default; brand minimalism.
  - **Committed**: one saturated color carries 30–60% of the surface. Brand default for identity-driven pages.
  - **Full palette**: 3–4 named roles, each used deliberately. Brand campaigns; product data viz.
  - **Drenched**: the surface IS the color. Brand heroes, campaign pages.

### Absolute bans

Match-and-refuse. If you're about to write any of these, rewrite the element with different structure.

- **Side-stripe borders.** `border-left` or `border-right` greater than 1px as a colored accent on cards, list items, callouts, or alerts. Never intentional. Rewrite with full borders, background tints, leading numbers/icons, or nothing.
- **Gradient text.** `background-clip: text` combined with a gradient background. Decorative, never meaningful. Use a single solid color. Emphasis via weight or size.
- **Glassmorphism as default.** Blurs and glass cards used decoratively. Rare and purposeful, or nothing.
- **The hero-metric template.** Big number, small label, supporting stats, gradient accent. SaaS cliché.
- **Identical card grids.** Same-sized cards with icon + heading + text, repeated endlessly.
- **Tiny uppercase tracked eyebrow above every section.** The 2023-era kicker (small all-caps text with wide tracking, "ABOUT" "PROCESS" "PRICING" above each heading) is now the saturated AI scaffold; it appears on 55-95% of generations regardless of brief, which is the definition of a tell. One named kicker as a deliberate brand system is voice; an eyebrow on every section is AI grammar. Choose a different cadence.
- **Numbered section markers as default scaffolding (01 / 02 / 03).** Putting `01 · About / 02 · Process / 03 · Pricing` above every section is the eyebrow trope one tier deeper: reach for it because "landing pages do this" and you're scaffolding by reflex. Numbers earn their place when the section actually IS a sequence (a real 3-step process, an ordered flow, a typed timeline) and the order carries information the reader needs. One deliberate numbered sequence on one page is voice; numbered eyebrows on every section across the site is AI grammar.
- **Text that overflows its container.** Long heading words plus large clamp scales plus narrow grids cause headline overflow on tablet/mobile. Test the heading copy at every breakpoint; if it overflows, reduce the clamp max or rewrite the copy. The viewport is part of the design.

**Codex-specific defects** (your most-frequent giveaways; refuse-and-rewrite):

- **`border: 1px solid X` + `box-shadow: 0 Npx Mpx ...` with M ≥ 16px** on the same element. The "ghost-card" pattern: 1px border plus soft wide drop shadow on buttons and cards. Don't pair them. Pick one (a single solid border at the brand color, OR a defined shadow at no more than 8px blur), never both as decoration.
- **`border-radius: 32px+` on cards / sections / inputs.** You over-round. Cards top out at 12–16px; full-pill is fine for tags/buttons. Picking 24/28/32/40px on a card is the codex tell; no brand wants "insanely rounded".
- **Hand-drawn / sketchy SVG illustrations.** Class names like `loose-sketch`, `*-sketch`, `doodle`, `wavy`; `feTurbulence` / `feDisplacementMap` "paper grain" filters; 5-to-30 path crude scenes meant to depict a tangible subject (an otter, a table-and-fork, an album cover). All of these read as amateurish, not whimsical. If you can't render the scene with real assets, ship no illustration. Don't attempt sketchy SVG as a fallback.
- **`repeating-linear-gradient(...)` stripe backgrounds.** Diagonal stripes in `body:before` or section backgrounds are pure codex decoration. Don't.
- **Decorative grid backgrounds.** Two-axis CSS grid overlays built from `linear-gradient(... 1px, transparent 1px)` plus `background-size` are a Codex tell unless the surface is an actual canvas, map, blueprint, or measurement tool. Use product structure, real artifacts, or a plain surface instead.
- **Meta-criticism copy.** Naming a concept then layering an ironic modifier, or staging a strawman to "correct" it. Make the specific claim instead.

### The AI slop test

If someone could look at this interface and say "AI made that" without doubt, it's failed. Cross-register failures are the absolute bans above. Register-specific failures live in each reference.

**Category-reflex check.** Run at two altitudes; the second one catches what the first one misses.

- **First-order:** if someone could guess the theme + palette from the category alone, it's the first training-data reflex. Rework the scene sentence and color strategy until the answer isn't obvious from the domain.
- **Second-order:** if someone could guess the aesthetic family from category-plus-anti-references ("AI workflow tool that's not SaaS-cream → editorial-typographic", "fintech that's not navy-and-gold → terminal-native dark mode"), it's the trap one tier deeper. The first reflex was avoided; the second wasn't. Rework until both answers are not obvious. The brand register's [reflex-reject aesthetic lanes](reference/brand.md) list catches the currently-saturated families.

## Commands

| Command | Category | Description | Reference |
|---|---|---|---|
| `craft [feature]` | Build | Shape, then build a feature end-to-end | [reference/craft.md](reference/craft.md) |
| `shape [feature]` | Build | Plan UX/UI before writing code | [reference/shape.md](reference/shape.md) |
| `init` | Build | Set up project context: PRODUCT.md, DESIGN.md, live config, next steps | [reference/init.md](reference/init.md) |
| `document` | Build | Generate DESIGN.md from existing project code | [reference/document.md](reference/document.md) |
| `extract [target]` | Build | Pull reusable tokens and components into design system | [reference/extract.md](reference/extract.md) |
| `critique [target]` | Evaluate | UX design review with heuristic scoring | [reference/critique.md](reference/critique.md) |
| `audit [target]` | Evaluate | Technical quality checks (a11y, perf, responsive) | [reference/audit.md](reference/audit.md) · native: [reference/audit.native.md](reference/audit.native.md) |
| `polish [target]` | Refine | Final quality pass before shipping | [reference/polish.md](reference/polish.md) |
| `bolder [target]` | Refine | Amplify safe or bland designs | [reference/bolder.md](reference/bolder.md) |
| `quieter [target]` | Refine | Tone down aggressive or overstimulating designs | [reference/quieter.md](reference/quieter.md) |
| `distill [target]` | Refine | Strip to essence, remove complexity | [reference/distill.md](reference/distill.md) |
| `harden [target]` | Refine | Production-ready: errors, i18n, edge cases | [reference/harden.md](reference/harden.md) |
| `onboard [target]` | Refine | Design first-run flows, empty states, activation | [reference/onboard.md](reference/onboard.md) |
| `animate [target]` | Enhance | Add purposeful animations and motion | [reference/animate.md](reference/animate.md) |
| `colorize [target]` | Enhance | Add strategic color to monochromatic UIs | [reference/colorize.md](reference/colorize.md) |
| `typeset [target]` | Enhance | Improve typography hierarchy and fonts | [reference/typeset.md](reference/typeset.md) |
| `layout [target]` | Enhance | Fix spacing, rhythm, and visual hierarchy | [reference/layout.md](reference/layout.md) |
| `delight [target]` | Enhance | Add personality and memorable touches | [reference/delight.md](reference/delight.md) |
| `overdrive [target]` | Enhance | Push past conventional limits | [reference/overdrive.md](reference/overdrive.md) |
| `clarify [target]` | Fix | Improve UX copy, labels, and error messages | [reference/clarify.md](reference/clarify.md) |
| `adapt [target]` | Fix | Adapt for different devices and screen sizes | [reference/adapt.md](reference/adapt.md) · native: [reference/adapt.native.md](reference/adapt.native.md) |
| `optimize [target]` | Fix | Diagnose and fix UI performance | [reference/optimize.md](reference/optimize.md) |
| `live` | Iterate | Visual variant mode: pick elements in the browser, generate alternatives | [reference/live.md](reference/live.md) |

Plus three management commands: `pin <command>`, `unpin <command>`, and `hooks <on|off|status|...>`, detailed below.

### Routing rules

1. **No argument**: the user is asking "what should I do?" Make the menu context-aware instead of static. Setup has already run `context.mjs`; if that reported `NO_PRODUCT_MD` the project has no captured context yet, so lead the menu with `$impeccable init` as the top recommendation (one line on why) and still show the rest below; don't silently jump into init. Otherwise run `node .agents/skills/impeccable/scripts/context-signals.mjs` once and read its JSON, then lead with the **2-3 highest-value next commands**, each with a one-line reason pulled from the signals, followed by the full menu (the table above, grouped by category). **Never auto-run a command; the recommendation is a suggestion the user confirms.**

   Reason over the signals; there is no score to obey:
   - `setup.hasDesign` false while `setup.hasCode` true → `document` (capture the visual system).
   - `critique.latest` is `null` → the project has never been critiqued; for a set-up project with a real surface, offering `$impeccable critique <surface>` is a strong default.
   - `critique.latest` with a low `score` or non-zero `p0` / `p1` → `polish` (it reads that snapshot as its backlog), or re-run `critique` if the snapshot looks stale.
   - `git.changedFiles` pointing at one surface → scope `audit` or `polish` to those files specifically, naming them.
   - `devServer.running` true → `live` is available for in-browser iteration; if false, don't lead with `live`. **`live` and the bundled `detect.mjs` are web-only.** If `setup.platform` is `ios`, `android`, or `adaptive`, don't lead with either; the browser overlay and the HTML rule engine don't apply to native app code.
   - Otherwise group by intent exactly as init's "Recommend starting points" step does (build new / improve what's there / iterate visually), tailored to `setup.register`.

   **If `scan.targets` is non-empty and `setup.platform` is not `ios`/`android`/`adaptive`, run `node .agents/skills/impeccable/scripts/detect.mjs --json <scan.targets joined by spaces>` once** (the bundled detector over local files: no network, no npx; it reads HTML/CSS, so skip it for native projects). `scan.via` tells you what they are: `git-changes` (the markup/style files in your dirty tree, the most relevant set), `source-dir` (e.g. `src`, `app`), `html`, or `root`. Fold the hits into your picks: many quality / contrast hits → `audit` or `polish`; a specific slop family → the matching command (gradient text or eyebrows → `quieter` / `typeset`, flat or gray palette → `colorize`, and so on). It's a real, current signal that beats guessing. If detect errors or the tree is large and slow, skip it and recommend the user run `audit` themselves; never block the suggestion on it.

   Keep it to 2-3 pointed picks with the exact command to type. The menu stays the fallback; the recommendation is the lede.
2. **First word matches a command** (table above OR `pin` / `unpin` / `hooks`): load its reference file (on native platforms, the table's native variant; Setup step 2's one-file rule) and follow its instructions. Everything after the command name is the target.
3. **First word doesn't match, but the intent clearly maps to one command** (e.g. "fix the spacing" → `layout`, "rewrite this error message" → `clarify`, "the colors feel flat" → `colorize`): load that command's reference (same native-variant rule) and proceed as if invoked. If two commands could fit, ask once which.
4. **No clear command match**: general design invocation. Apply the setup steps, the General rules, and the loaded register reference, using the full argument as context.

Setup (context gathering, register) is already loaded by then; sub-commands don't re-invoke `$impeccable`.

If the first word is `craft` or `shape`, or routing rule 3 clearly maps the user's intent to either command, setup still runs first, but the matching reference ([reference/craft.md](reference/craft.md) or [reference/shape.md](reference/shape.md)) owns the rest of the flow. Both are from-scratch build flows: if setup invokes `init` as a blocker, finish init, refresh context, then resume the original command and target.

`teach` is a deprecated alias for `init`: if the user types it, load [reference/init.md](reference/init.md) and proceed as if they ran `init`.

## Pin / Unpin

**Pin** creates a standalone shortcut so `$<command>` invokes `$impeccable <command>` directly. **Unpin** removes it. The script writes to every harness directory present in the project.

```bash
node .agents/skills/impeccable/scripts/pin.mjs <pin|unpin> <command>
```

Valid `<command>` is any command from the table above. Report the script's result concisely. Confirm the new shortcut on success, relay stderr verbatim on error.

## Hooks

`$impeccable hooks <on|off|status|ignore-rule|ignore-file|ignore-value|reset>` manages the design detector hook for this project. The hook auto-runs the detector after direct UI file edits and surfaces findings as system reminders. Full flow is in [reference/hooks.md](reference/hooks.md); load it when the user invokes `$impeccable hooks` with any argument.

# SKILL.md — QMS-Portal Project Development Guide

> ไฟล์นี้เป็น Project Skill / Project Instruction สำหรับ AI หรือ AI IDE ที่ช่วยวิเคราะห์ ออกแบบ พัฒนา ทดสอบ และขยายระบบ **QMS-Portal**
>
> จุดประสงค์หลักคือทำให้ AI เข้าใจภาพรวมของระบบ สถาปัตยกรรม เทคโนโลยี มาตรฐานการพัฒนา รูปแบบโมดูล และข้อควรระวัง โดยไม่ผูกระบบไว้กับโมดูลใดโมดูลหนึ่งมากเกินไป เพื่อให้สามารถเพิ่มโมดูลใหม่ในอนาคตได้ง่าย

---

## 1. Project Overview

### Project Name

**QMS-Portal**

### Project Purpose

QMS-Portal คือระบบศูนย์กลางสำหรับบริหารงานด้าน Quality Management System ของโรงงาน โดยออกแบบให้เป็นระบบแบบหลายโมดูล และสามารถเพิ่มโมดูลใหม่ได้ในอนาคต เช่น

- Document Control
- Quality Event
- CAPA
- NCR / HOLD / RELEASE
- Customer Complaint
- Audit Management
- Supplier Quality
- Training Management
- Calibration
- Change Control
- Risk Management
- Deviation
- Recall / Withdrawal
- Management Review
- E-Form / Record Management
- Dashboard / Report
- Master Data

รายการข้างต้นเป็นเพียงตัวอย่าง ไม่ใช่ขอบเขตที่ตายตัว

### Core Design Principle

ระบบต้องถูกออกแบบให้เป็น **Modular QMS Platform** ไม่ใช่แอปเฉพาะกิจสำหรับ workflow เดียว

ทุกโมดูลควรสามารถ:

- พัฒนาแยกจากกัน
- มี route ของตัวเอง
- มี permission ของตัวเอง
- มี service / data model / test ของตัวเอง
- เชื่อมโยงกับโมดูลอื่นผ่าน interface ที่ชัดเจน
- ไม่แก้ไขสถานะหรือ workflow ของโมดูลอื่นโดยตรง
- เพิ่มหรือลบได้โดยไม่ทำให้ระบบหลักเสีย

---

## 2. Project Structure

### High-Level Architecture

```text
QMS-Portal
├── Portal Shell / Module Hub
├── Shared Layout
├── Shared Design System
├── Authentication / Current User
├── Permission & Access Control
├── Shared Notification Layer
├── Shared Audit Trail
├── Shared Master Data
├── Shared Reporting Layer
├── Feature Modules
│   ├── DCC
│   ├── Quality Event
│   ├── Future Module A
│   ├── Future Module B
│   └── Future Module N
└── Legacy Compatibility Routes
```

### Module Independence Rule

แต่ละโมดูลต้องมี ownership ของข้อมูลและ workflow ของตัวเอง

ตัวอย่าง:

```text
DCC controls document lifecycle
Quality Event controls quality issue lifecycle
Training controls training lifecycle
Audit controls audit lifecycle
```

ห้ามโมดูลหนึ่งเปลี่ยน status ของอีกโมดูลโดยตรง

การเชื่อมโยงข้ามโมดูลต้องใช้แนวทาง เช่น

- linked record
- reference ID
- service interface
- event notification
- shared read-only summary
- draft/shell creation

---

## 3. Repository and Development Environment

### Repository

```text
https://github.com/tharns1999-cmyk/New_DCC.git
```

### Local Project Path

```text
C:\Users\User\Desktop\qms-portal
```

### Current Technology Stack

```text
Frontend Framework:
- React
- Vite
- JavaScript / JSX

Styling / UI:
- Tailwind CSS
- framer-motion
- lucide-react

State / Data:
- Current project store and mock service pattern
- Local mock data for prototype phases

Testing / Quality:
- Vitest
- Project lint command / oxlint
- npm run lint
- npm run build
- npm run test

Version Control:
- Git
- GitHub
```

### Stack Stability Rule

อย่าเปลี่ยน Technology Stack หลักโดยไม่จำเป็น

ห้ามทำสิ่งต่อไปนี้โดยพลการ:

- สร้าง Vite app ใหม่
- ย้ายไป framework ใหม่
- เปลี่ยน JavaScript เป็น TypeScript ทั้งโปรเจกต์โดยไม่ได้รับอนุมัติ
- เปลี่ยน state management ทั้งระบบ
- เปลี่ยน routing structure
- สร้าง repository ใหม่
- เพิ่ม dependency ขนาดใหญ่โดยไม่จำเป็น

ก่อนเพิ่ม library ใหม่ ต้องอธิบาย:

1. ใช้แก้ปัญหาอะไร
2. ทำไมของเดิมทำไม่ได้
3. ผลกระทบต่อ bundle size
4. ผลกระทบต่อ maintenance
5. มี alternative ที่เบากว่าหรือไม่

---

## 4. Route Architecture

### Core Routes

```text
/portal
  Portal Module Hub

/dcc
/dcc/*
  DCC Module

/quality-event
/quality-event/*
  Quality Event Module

/nc-capa
/nc-capa/*
  Legacy / compatibility route group
```

### Future Module Route Pattern

โมดูลใหม่ควรใช้ pattern:

```text
/<module-key>
/<module-key>/dashboard
/<module-key>/list
/<module-key>/new
/<module-key>/:id
/<module-key>/my-tasks
/<module-key>/reports
/<module-key>/master-data
```

ตัวอย่าง:

```text
/audit
/audit/dashboard
/audit/new
/audit/:id
```

### Route Guardrails

- route ต้องไม่ชนกัน
- direct refresh ต้องทำงาน
- invalid ID ต้องแสดง Not Found
- unauthorized access ต้องแสดง Access Denied
- ห้าม silent redirect โดยไม่มีคำอธิบาย
- sidebar active state ต้องถูกต้อง
- breadcrumb ต้องตรง route
- legacy route ต้องยังใช้งานได้ หากยังไม่อนุมัติให้ลบ

---

## 5. Recommended Module Folder Pattern

ทุกโมดูลใหม่ควรใช้โครงสร้างใกล้เคียงนี้:

```text
src/features/<module-key>/
├── components/
├── pages/
├── services/
├── mock/
├── hooks/
├── utils/
├── locales/
├── constants/
├── tests/
└── index.js
```

### Responsibilities

```text
components/
Reusable UI within the module

pages/
Route-level screens

services/
Business logic, transitions, validation, access enforcement

mock/
Mock users, records, master/config data, scenarios

hooks/
Module-specific hooks

utils/
Mapping, formatting, helper functions

locales/
User-facing translations

constants/
Canonical codes and enums

tests/
Unit, integration, route, permission, workflow tests
```

### Separation Rule

Component ไม่ควรเป็นที่เก็บ business logic หลัก

ควรแยกดังนี้:

```text
UI component
→ calls helper/service
→ service validates permission + business rule
→ service changes data/status
→ UI renders result
```

ห้าม hardcode workflow transition ใน JSX

---

## 6. Shared Platform Capabilities

ระบบควรมี shared capability ที่ทุกโมดูลใช้ร่วมกันได้

### 6.1 Authentication

- current user
- login state
- logout
- session state
- first-login password flow หากเพิ่ม backend ภายหลัง

### 6.2 Permission System

ใช้ permission code เป็นหลัก

ตัวอย่าง:

```text
MODULE_VIEW
MODULE_VIEW_ALL
MODULE_CREATE
MODULE_EDIT
MODULE_ASSIGN
MODULE_APPROVE
MODULE_CLOSE
MODULE_ADMIN
MODULE_AUDIT_VIEW
```

ห้ามใช้ชื่อ role หรือ department ใน workflow logic โดยตรง

ไม่ใช้:

```text
isQaqc
isManagement
user.department === "QAQC"
user.role === "Plant Manager"
hardcoded user IDs
```

ใช้:

```js
hasPermission(user, "MODULE_CREATE")
```

และควรเช็ก assignment ร่วมด้วยเมื่อเป็น action ต่อ record

```text
permission + assignment + record state
```

### 6.3 Assignment

รองรับ:

- assigned user
- assigned department
- task owner
- backup owner
- watchers / observers
- escalation owner

### 6.4 Notification

ใน prototype ใช้ mock notification ได้

notification ไม่ควร hardcode user ID

ควร resolve recipient จาก:

- assignment
- permission group
- department membership
- configured escalation matrix

### 6.5 Audit Trail

ทุก action สำคัญต้องมี audit event เช่น

- create
- submit
- assign
- approve
- reject
- return
- update
- close
- reopen
- link
- unlink
- override
- permission-denied attempt เมื่อจำเป็น

Audit entry ควรมี:

```text
id
recordType
recordId
actionCode
actorId
actorName
actorDepartment
previousStatus
newStatus
comment
createdAt
metadata
```

### 6.6 Master Data

Master data ต้องแยกจาก transaction data

ตัวอย่าง:

- Department
- Position
- Role
- User
- Permission
- Document Type
- Severity
- Category
- Reason
- Approval Matrix
- SLA Configuration
- Workflow Configuration
- Notification Template

### 6.7 Reporting

ทุกโมดูลควรออกแบบให้รองรับ:

- list filter
- export
- summary card
- trend
- overdue
- status distribution
- department breakdown
- audit trail report

---

## 7. Workflow Design Standard

ทุก workflow ต้องนิยามอย่างน้อย:

```text
Trigger
Creator
Owner
Reviewer
Approver
Assignee
Status model
Allowed transition
Permission
SLA
Reminder
Escalation
Closure condition
Reopen condition
Audit event
Visibility
```

### Status Design

ใช้ canonical status code ภาษาอังกฤษใน code

```text
DRAFT
SUBMITTED
ASSIGNED
IN_PROGRESS
PENDING_REVIEW
RETURNED
APPROVED
CLOSED
CANCELLED
REOPENED
```

UI แสดงชื่อภาษาไทยผ่าน label mapper

ห้ามใช้ข้อความภาษาไทยเป็น canonical code

### Transition Rule

ทุก transition ต้องตรวจ:

```text
1. current status
2. permission
3. assignment
4. required fields
5. closure gate
6. approval condition
7. linked record condition
```

### SLA Pattern

รองรับ:

- submittedAt
- assignedAt
- dueDate
- completedAt
- daysRemaining
- overdueDays
- reminder status
- escalation status

SLA ต้องคำนวณใน service/helper ไม่คำนวณกระจัดกระจายใน UI

---

## 8. UI / UX Standard

### Language

UI สำหรับผู้ใช้งานโรงงานต้องเป็นภาษาไทยเป็นหลัก

อนุญาตให้ใช้คำย่อ/รหัสที่ผู้ใช้งานคุ้นเคย เช่น

```text
CAPA
CAR
PAR
NCR
HOLD
QAQC
RM
WIP
FG
Lot No.
DCC
DAR
```

Internal code, route, permission และ status constants ใช้ภาษาอังกฤษได้

### Dashboard Principle

Dashboard ต้องตอบ 3 คำถาม:

1. ฉันต้องทำอะไร
2. อะไรใกล้ครบกำหนดหรือเกินกำหนด
3. สถานะของแผนกหรือระบบเป็นอย่างไร

หลีกเลี่ยง KPI card จำนวนมาก

แนะนำ:

- 4–6 cards ต่อ view
- work queue
- due soon
- overdue
- high risk
- waiting for another department
- management trend

### List Page Standard

ควรมี:

- search
- filter
- status tabs
- date range
- department filter
- owner/assignee filter
- pagination หรือ virtualization เมื่อข้อมูลมาก
- responsive mobile card view
- no horizontal overflow

### Detail Page Standard

ควรมี:

- record header
- current status
- key metadata
- current task
- due date
- permission-aware action panel
- tabs/sections
- linked records
- comments/history
- audit trail

### Form Standard

- multi-step wizard เมื่อข้อมูลมาก
- save draft
- validation per step
- final review before submit
- contextual help
- required field indication
- no duplicate input
- dependent field visibility

### Access Denied

ต้องแสดงอย่างชัดเจนเป็นภาษาไทย

```text
ไม่มีสิทธิ์เข้าถึงข้อมูลนี้
ข้อมูลนี้ถูกจำกัดสิทธิ์เฉพาะผู้เกี่ยวข้อง
กรุณาติดต่อผู้ดูแลระบบหรือเจ้าของงาน
```

ไม่ควร redirect ออกเงียบ ๆ

---

## 9. Localization Standard

ใช้ centralized localization

ตัวอย่าง:

```text
src/features/<module>/locales/th.js
src/features/<module>/utils/labelMappers.js
```

ควรมี helper เช่น

```js
tModule(key)
getStatusLabel(code)
getActionLabel(code)
getSeverityLabel(code)
getDocumentTypeLabel(code)
getValidationMessage(code)
```

ห้าม hardcodeข้อความซ้ำ ๆ ในหลาย component

UI ภาษาไทย แต่ code ภาษาอังกฤษ

---

## 10. Data and Security Principles

### Access Control

ต้องควบคุมข้อมูลทั้งระดับ:

- route
- list result
- detail view
- field masking
- action button
- service action
- linked record summary

การซ่อน button อย่างเดียวไม่ถือว่าปลอดภัย

### Sensitive Data

หากโมดูลมีข้อมูล sensitive เช่น

- customer information
- complaint detail
- medical data
- employee information
- confidential document

ต้องมี:

- field-level masking
- safe view mapper
- permission check
- assignment check
- audit access เมื่อจำเป็น

### Service-Level Enforcement

ทุก action ต้อง validate ใน service แม้ UI จะซ่อนปุ่มแล้ว

ตัวอย่าง:

```text
UI guard + service guard + data filtering
```

### Linked Records

Linked records เป็น traceability เท่านั้น

ห้าม:

- auto-close source record
- auto-approve target record
- mutate status ข้ามโมดูล
- bypass workflow
- leak restricted information

---

## 11. Current Modules as Reference Implementations

ส่วนนี้เป็น reference ของโมดูลที่มีอยู่ ไม่ใช่ template ตายตัวสำหรับทุกโมดูล

### DCC

ใช้สำหรับ:

- document lifecycle
- new/revision/obsolete
- controlled copy
- document library
- distribution
- periodic review
- external document

### Quality Event

ใช้สำหรับ:

- CAPA / CAR / PAR
- NCR / HOLD / RELEASE
- Customer Complaint
- linked record traceability

### Legacy NC-CAPA

route `/nc-capa/*` ต้องไม่ถูกทำลายจนกว่าจะมีแผน migration ที่อนุมัติแล้ว

---

## 12. Adding a New Module

เมื่อเพิ่มโมดูลใหม่ AI ต้องทำตามลำดับนี้

### Step 1: Business Analysis

ระบุ:

- objective
- scope
- out of scope
- actors
- current process
- future process
- pain points
- business rules
- forms/documents
- reports
- integrations

### Step 2: Workflow Definition

ระบุ:

- status model
- transitions
- task owner
- reviewer
- approver
- SLA
- escalation
- closure gate
- reopen rule

### Step 3: Permission Matrix

ระบุ:

- view
- view all
- create
- edit
- assign
- respond
- review
- approve
- close
- reopen
- admin
- audit view

### Step 4: Data Model

แยก:

- record fields
- assignment
- workflow state
- comments
- audit trail
- linked records
- attachments metadata
- SLA fields

### Step 5: UX Structure

กำหนด:

- dashboard
- list
- create
- detail
- my tasks
- reports
- master data

### Step 6: Implementation Plan

ก่อน coding ต้องเสนอ:

- files to create/modify
- route changes
- service methods
- data model
- mock data
- permission changes
- tests
- regression risks

### Step 7: Implementation

ทำตาม plan ที่ได้รับอนุมัติ

### Step 8: Quality Gate

```powershell
npm run lint
npm run build
npm run test
```

### Step 9: Walkthrough

ต้องรายงาน:

- files changed
- route behavior
- workflow behavior
- permission behavior
- tests
- lint
- build
- known limitations
- regression confirmation

### Step 10: Commit

Commit หลัง walkthrough ผ่านเท่านั้น

---

## 13. Testing Standard

ทุกโมดูลใหม่ควรมี test อย่างน้อยในหมวดต่อไปนี้

### Permission Tests

- unauthorized cannot view
- unauthorized cannot create
- permission alone insufficient when assignment required
- admin/view-all works correctly

### Workflow Tests

- valid transition works
- invalid transition blocked
- required field enforced
- closure gate enforced
- reopen rule enforced

### Data Tests

- official number generation
- draft number behavior
- no duplicate link
- audit event created
- sensitive data masked

### UI Tests

- route renders
- access denied renders
- Thai labels render
- status badges render
- mobile layout no overflow

### Regression Tests

- existing modules still work
- portal still works
- DCC remains separate
- legacy routes remain working

---

## 14. Quality Gate

ทุก phase ต้องผ่าน:

```text
npm run lint
npm run build
npm run test
```

เกณฑ์:

```text
0 lint errors
build success
all tests passed
no avoidable app-source warnings
no React act warning
no worker crash
no redirect loop
no FatalProcessOutOfMemory
no app console error in normal flow
```

---

## 15. Git Workflow

หลัง phase ผ่านการ review:

```powershell
git status
git add .
git commit -m "<type>: <clear message>"
git push
git status
```

Commit type แนะนำ:

```text
feat
fix
refactor
test
chore
docs
```

ตัวอย่าง:

```text
feat: add audit management module shell
fix: enforce assignment-based access control
refactor: centralize Thai status labels
test: add workflow regression coverage
```

---

## 16. AI Working Rules

AI ที่ช่วยโปรเจกต์นี้ต้อง:

- เข้าใจระบบในภาพรวมก่อนแก้ code
- ตรวจของเดิมก่อนสร้างของใหม่
- reuse component/service เมื่อเหมาะสม
- ไม่ duplicate architecture
- ไม่สร้าง module แบบ isolated app
- ไม่ hardcode role/department/user
- ไม่ bypass permission
- ไม่เปลี่ยน workflow โดยไม่ยืนยัน
- ไม่ทำลาย route เดิม
- ไม่ลบ legacy โดยไม่มี migration plan
- ไม่ขอให้ user แก้ไฟล์เอง หาก AI IDE ทำให้ได้
- ต้องรายงานผล lint/build/test
- ต้องแยก implementation plan กับ walkthrough ให้ชัดเจน

### Review Vocabulary

เมื่อ review ผลจาก AI IDE ให้ใช้:

```text
ผ่าน
ไม่ผ่าน
เกือบผ่าน แต่ต้องแก้
```

พร้อมบอก:

1. จุดที่ถูก
2. จุดที่เสี่ยง
3. สิ่งที่ต้องแก้
4. ให้ proceed หรือไม่
5. commit ได้หรือยัง

---

## 17. Future Backend Readiness

แม้ปัจจุบันหลายส่วนเป็น frontend/mock prototype แต่ code ควรเตรียมพร้อมต่อ backend จริง

แนะนำให้แยก:

```text
UI
Service
Repository/API Adapter
Validation
Permission
Mapper
Mock Data
```

หลีกเลี่ยง:

- component อ่าน/เขียน mock array โดยตรงทุกจุด
- business rule อยู่ใน JSX
- status transition กระจัดกระจาย
- permission logicกระจัดกระจาย
- hardcoded master data ในหลายไฟล์

เมื่อทำ backend ภายหลัง ควรเปลี่ยนเฉพาะ repository/API layer มากที่สุด โดยไม่ต้อง rewrite UI/workflow ทั้งหมด

---

## 18. Definition of Done for a New Module

โมดูลถือว่าเสร็จระดับ prototype-ready เมื่อมี:

- module route
- sidebar/menu entry
- permission model
- dashboard or entry view
- list page
- create flow
- detail page
- workflow service
- canonical status codes
- Thai UI labels
- access denied state
- audit trail
- mock data scenarios
- tests
- lint passed
- build passed
- all tests passed
- regression verified
- walkthrough accepted
- commit pushed

---

## 19. Final Principle

QMS-Portal ต้องเติบโตแบบ platform

ทุกการพัฒนาใหม่ต้องรักษา 5 เรื่องนี้:

```text
Modularity
Permission Safety
Workflow Integrity
Thai-first UX
Future Backend Readiness
```

อย่าออกแบบโมดูลใหม่ด้วยการ copy แล้วผูก logic แบบเฉพาะหน้า

ให้สร้างโมดูลที่ใช้ pattern ร่วมกัน แต่รักษา business rule ของแต่ละกระบวนการอย่างชัดเจน