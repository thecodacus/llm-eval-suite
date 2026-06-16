# Design System: Neumorphic Tech Schematic

## 1. Definição do Estilo

- **Nome:** Neumorphic Tech Schematic
- **Tipo:** Professional, Informative, Sleek
- **Keywords:** neumorphic, schematic, tech, soft, shadows, gradient, flow, hub, spoke
- **Era:** Modern Tech
- **Light/Dark:** ✓ Full / ◐ Part

## 2. Paleta de Cores

- **Primárias:** Background #F4F6F8, Text #2C2C2C, Accent #EB5757
- **Secundárias:** Shadow Light #FFFFFF, Shadow Dark #D1D9E6, Flow Line #EB5757

## 3. Efeitos Visuais

Soft circular containers, smooth matte digital surface, soft diffuse ambient lighting, gentle drop shadows (neumorphic effect).

## 4. AI Prompt Keywords

neumorphic landing page, soft ui, tech schematic, light background, soft shadows, clean layout, hub and spoke design.

## 5. CSS Technical

```css
background-color: #F4F6F8; color: #2C2C2C; font-family: 'Roboto', sans-serif; box-shadow: 10px 10px 20px #D1D9E6, -10px -10px 20px #FFFFFF; border-radius: 20px;
```

## 6. Design System Variables

```css
--bg-light: #F4F6F8, --text-dark: #2C2C2C, --accent-red: #EB5757, --shadow-neu-dark: #D1D9E6, --shadow-neu-light: #FFFFFF
```

## 7. Checklist de Implementação

- ☐ Neumorphic shadows (light/dark interact)
- ☐ Soft rounded corners
- ☐ Central hub layout
- ☐ Gradient flow lines
- ☐ Minimalist icons

## 8. Visual Theme & Atmosphere

Neumorphic Tech Schematic — Design technical com neumorphic, schematic, tech. Template e prompt pronto para IA. Estilo Neumorphic Tech Schematic representa uma tendência moderna em design UI/UX web com foco em technical.

- Density: 5/10 — Balanced
- Variance: 4/10 — Moderate
- Motion: 4/10 — Subtle

## 9. Color Palette & Roles

- **Background** (#F4F6F8) — Primary background surface
- **Text** (#2C2C2C) — Primary text color
- **Accent** (#EB5757) — Primary accent, CTAs and interactive elements
- **Shadow Light** (#FFFFFF) — Extended palette, decorative use
- **Shadow Dark** (#D1D9E6) — Deep contrast surface
- **Flow Line** (#EB5757) — Extended palette, decorative use

## 10. Typography Rules

- **Display / Hero:** Roboto — Weight 700, tight tracking, used for headline impact
- **Body:** Roboto — Weight 400, 16px/1.6 line-height, max 72ch per line
- **UI Labels / Captions:** Roboto — 0.875rem, weight 500, slight letter-spacing
- **Monospace:** JetBrains Mono — Used for code, metadata, and technical values

Scale:
- Hero: clamp(2.5rem, 5vw, 4rem)
- H1: 2.25rem
- H2: 1.5rem
- Body: 1rem / 1.6
- Small: 0.875rem

## 11. Component Stylings

- **Primary Button:** Rounded (20px) shape. Accent color fill. Hover: 8% darken + subtle lift shadow. Active: -1px translate tactile press. Font weight 600. No outer glows.
- **Secondary / Ghost Button:** Outline variant. 1.5px border in muted color. Text in primary color. Hover: subtle background fill.
- **Cards:** Rounded (20px) corners. Surface background. Subtle shadow (0 2px 12px rgba(0,0,0,0.06)). 1px border stroke.
- **Inputs:** Label above input. 1px border stroke. Focus ring: 2px accent color offset 2px. Error text below in semantic red. No floating labels.
- **Navigation:** Primary surface background. Active item: accent color indicator. Font weight 500 when active.
- **Skeletons:** Shimmer animation matching component dimensions. No circular spinners.
- **Empty States:** Icon-based composition with descriptive text and action button.

## 12. Layout Principles

- **Grid:** CSS Grid primary. Max-width containment: 1280px centered with 1.5rem side padding.
- **Spacing rhythm:** Balanced. Base unit: 0.5rem (8px).
- **Section vertical gaps:** clamp(4rem, 8vw, 8rem).
- **Hero layout:** Split-screen (text left, visual right).
- **Feature sections:** Zig-zag alternating text+image rows. No 3-equal-columns.
- **Mobile collapse:** All multi-column layouts collapse below 768px. No horizontal overflow.
- **z-index contract:** base (0) / sticky-nav (100) / overlay (200) / modal (300) / toast (500).

## 13. Motion & Interaction

- **Physics:** Ease-out curves, 200-300ms duration. Smooth and predictable.
- **Entry animations:** Fade + translate-Y (16px → 0) over 420ms ease-out. Staggered cascades for lists: 80ms between items.
- **Hover states:** Subtle color shift + shadow adjustment over 200ms.
- **Page transitions:** Fade only (200ms).
- **Performance:** Only transform and opacity animated. No layout-triggering properties.

## 14. Anti-Patterns (Banned)

- No emojis in UI — use icon system only (Lucide, Heroicons)
- No pure black (#000000) — use off-black or charcoal variants
- No oversaturated accent colors (saturation cap: 80%)
- No 3-column equal-width feature layouts — use zig-zag or asymmetric grid
- No `h-screen` — use `min-h-[100dvh]`
- No AI copywriting clichés: "Elevate", "Seamless", "Unleash", "Next-Gen"
- No broken external image links — use picsum.photos or inline SVG
- No generic lorem ipsum in demos

## Contexto Histórico

Estilo Neumorphic Tech Schematic representa uma tendência moderna em design UI/UX web com foco em technical.

## Caso de Uso

Landing pages, Websites modernas
