# Design System: Portfolio Dev Full-Stack

## 1. Definição do Estilo

- **Nome:** Portfolio Dev Full-Stack
- **Tipo:** Minimal, Dark, Professional
- **Keywords:** developer portfolio, full-stack, projects gallery, clean layout, minimal, dark and cyan, code, tech stack, personal brand
- **Era:** 2020s Developer
- **Light/Dark:** ✗ No / ✓ Full

## 2. Paleta de Cores

- **Primárias:** Black #000000, Dark Grey #1A1A1A, Cyan #00BCD4
- **Secundárias:** White #FFFFFF, Light Grey #E0E0E0, Charcoal #333333

## 3. Efeitos Visuais

Layout duas colunas desktop (bio/projetos), cards de projetos com tech stack badges, hover com underline animado e escala suave, CSS grid/flex para galeria.

## 4. AI Prompt Keywords

developer portfolio, full-stack, projects gallery, clean layout, minimal, dark and cyan, code, tech stack, personal brand.

## 5. CSS Technical

```css
background: #1A1A1A, color: #FFFFFF, border-radius: 8px, box-shadow: 0 2px 10px rgba(0,0,0,0.3), font-family: 'JetBrains Mono, monospace', accent color: #00BCD4, animated underline on hover, tech badges with border.
```

## 6. Design System Variables

```css
--black: #000000, --dark-bg: #1A1A1A, --cyan: #00BCD4, --white: #FFFFFF, --radius-card: 8px, --font-dev: 'JetBrains Mono, monospace'.
```

## 7. Checklist de Implementação

- ☐ Navbar + Hero (bio + CTA)
- ☐ Projetos + Stack/Skills
- ☐ Experiência + Depoimentos
- ☐ CTA 'Fale comigo'
- ☐ Meta tags SEO
- ☐ Background escuro legível
- ☐ Microinterações discretas
- ☐ Ícones SVG (Git
- terminal
- frameworks).

## 8. Visual Theme & Atmosphere

Portfolio Dev Full-Stack — Design thematic com developer portfolio, full-stack, projects gallery. Template e prompt pronto para IA. Estilo Portfolio Dev Full-Stack representa uma tendência moderna em design UI/UX web com foco em thematic.

- Density: 3/10 — Airy
- Variance: 3/10 — Restrained
- Motion: 4/10 — Subtle

## 9. Color Palette & Roles

- **Black** (#000000) — Dark surface, primary background
- **Dark Grey** (#1A1A1A) — Dark surface, primary background
- **Cyan** (#00BCD4) — Accent highlight, links and focus states
- **White** (#FFFFFF) — Secondary surface
- **Light Grey** (#E0E0E0) — Secondary text, borders, muted elements
- **Charcoal** (#333333) — Deep contrast surface

## 10. Typography Rules

- **Display / Hero:** JetBrains Mono — Weight 700, tight tracking, used for headline impact
- **Body:** JetBrains Mono — Weight 400, 16px/1.6 line-height, max 72ch per line
- **UI Labels / Captions:** JetBrains Mono — 0.875rem, weight 500, slight letter-spacing
- **Monospace:** JetBrains Mono — Used for code, metadata, and technical values

Scale:
- Hero: clamp(2.5rem, 5vw, 4rem)
- H1: 2.25rem
- H2: 1.5rem
- Body: 1rem / 1.6
- Small: 0.875rem

## 11. Component Stylings

- **Primary Button:** Rounded (8px) shape. Accent color fill. Hover: 8% darken + subtle lift shadow. Active: -1px translate tactile press. Font weight 600. No outer glows.
- **Secondary / Ghost Button:** Outline variant. 1.5px border in muted color. Text in primary color. Hover: subtle background fill.
- **Cards:** Rounded (8px) corners. Surface background. Subtle shadow (0 2px 12px rgba(0,0,0,0.06)). 1px border stroke.
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
- No decorative gradients — flat color only
- No shadows heavier than 0 2px 8px rgba(0,0,0,0.08)
- No pure white (#FFFFFF) backgrounds — use off-white or dark surfaces
- No oversaturated accent colors (saturation cap: 80%)
- No 3-column equal-width feature layouts — use zig-zag or asymmetric grid
- No `h-screen` — use `min-h-[100dvh]`
- No AI copywriting clichés: "Elevate", "Seamless", "Unleash", "Next-Gen"
- No broken external image links — use picsum.photos or inline SVG
- No generic lorem ipsum in demos

## Contexto Histórico

Estilo Portfolio Dev Full-Stack representa uma tendência moderna em design UI/UX web com foco em thematic.

## Caso de Uso

Landing pages, Websites modernas
