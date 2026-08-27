---
name: QMS Portal
description: 100% digital, fully traceable QMS document control hub.
colors:
  primary: "#0056b3"
  indigo-action: "#4f46e5"
  neutral-bg: "#f8fafc"
  neutral-text: "#0f172a"
  border: "#e2e8f0"
typography:
  display:
    fontFamily: "'Inter', -apple-system, sans-serif"
    fontWeight: 600
    letterSpacing: "-0.025em"
  body:
    fontFamily: "'Inter', -apple-system, sans-serif"
    fontWeight: 400
rounded:
  md: "0.375rem"
  xl: "0.75rem"
  2xl: "1rem"
spacing:
  3: "0.75rem"
  4: "1rem"
  6: "1.5rem"
components:
  btn-primary:
    backgroundColor: "{colors.indigo-action}"
    textColor: "#ffffff"
    rounded: "{rounded.xl}"
    padding: "12px 24px"
  card:
    backgroundColor: "#ffffff"
    rounded: "{rounded.2xl}"
---

# Design System: QMS Portal

## 1. Overview

**Creative North Star: "The Fluid Interface"**

This system emphasizes fluid, seamless transitions and a modern, tactile feel that breathes life into enterprise data. Interactions should feel native, smooth, and highly responsive, turning mundane QMS tasks into a satisfying experience. We explicitly reject the dense, clunky, and static legacy enterprise UI patterns.

**Key Characteristics:**
- Highly interactive and tactile.
- Deep, soft shadows for spatial separation.
- Rounded, friendly contours (xl and 2xl radii).

## 2. Colors

The palette is anchored by a deep blue trust-signal, supported by clean, airy neutrals.

### Primary
- **Trust Indigo** (#0056b3): The core brand color, used for primary navigation and high-level branding.
- **Active Indigo** (#4f46e5): Used for primary action buttons (`btn-ios-primary`) to draw attention and encourage interaction.

### Neutral
- **Slate Background** (#f8fafc): The default canvas color, keeping the interface light and breathable.
- **Slate Ink** (#0f172a): Used for primary text to ensure crisp legibility.
- **Subtle Border** (#e2e8f0): Used for delineating cards and inputs without visual noise.

## 3. Typography

**Display Font:** Inter (with system fallbacks)
**Body Font:** Inter (with system fallbacks)

**Character:** Clean, highly legible, and universally accessible for users of all ages.

### Hierarchy
- **Display** (600, tight tracking): Major page titles and heroic metrics.
- **Headline** (600, normal tracking): Section headers and card titles.
- **Body** (400, normal tracking): Standard prose and form labels.

## 4. Elevation

The system uses a "Soft & Deep" philosophy. We rely on soft, diffuse shadows to clearly separate cards, modals, and sticky headers from the background canvas at all times.

### Shadow Vocabulary
- **Ambient Shadow** (`shadow-sm`): Default state for interactive cards.
- **Lifted Shadow** (`shadow-md`): Applied during hover states to signify tactile interactivity.
- **Glassmorphism** (`premium-glass`): Used strictly for sticky elements (like navbars) to maintain context while scrolling.

## 5. Components

### Buttons
- **Shape:** Rounded-xl (12px)
- **Primary:** Active Indigo background, white text. Tactile and confident hover state (`scale-102`).
- **Secondary:** White background, Slate 700 text, subtle border. Gently lifts on hover.

### Cards / Containers
- **Corner Style:** Rounded-2xl (16px)
- **Background:** Solid white.
- **Shadow Strategy:** Ambient soft shadow by default, elevating on hover if interactive.
- **Border:** Very subtle translucent border (`border-slate-200/80`).

### Inputs / Fields
- **Style:** White background, rounded-xl, subtle border.
- **Focus:** Strong Indigo focus ring to clearly indicate the active field.

## 6. Do's and Don'ts

### Do:
- **Do** use large, readable typography (`Inter`) to ensure legibility for all employee age groups.
- **Do** apply smooth, fluid transitions (`duration-300 ease-out`) to state changes.
- **Do** maintain high contrast between text and its background.

### Don't:
- **Don't** build dense, clunky, or overly complex navigation structures (no legacy enterprise UI).
- **Don't** use sharp, rigid corners (`rounded-none`) for primary containers or buttons.
- **Don't** pack information too tightly; let the layout breathe.
