// Central icon map — the design system bans emojis in UI, so everything routes
// through Lucide here. Use <Icon name="..." /> anywhere a glyph is needed.
import {
  FlaskConical, Calculator, Code2, ScanSearch, Tags, Puzzle, Megaphone, Radar,
  PenLine, BadgeCheck, Bot, Palette, Check, X, ChevronRight, ChevronDown, Info,
  TriangleAlert, Target, Gauge, BarChart3, LayoutDashboard, ListChecks, Hammer,
  Play, Server, BookOpen, Plus, Pencil, Trash2, Trophy, Eye, Zap,
  type LucideIcon,
} from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  flask: FlaskConical, calculator: Calculator, code: Code2, scan: ScanSearch,
  tags: Tags, puzzle: Puzzle, megaphone: Megaphone, radar: Radar, pen: PenLine,
  "badge-check": BadgeCheck, bot: Bot, palette: Palette,
  check: Check, x: X, "chevron-right": ChevronRight, "chevron-down": ChevronDown,
  info: Info, warn: TriangleAlert, target: Target, gauge: Gauge,
  chart: BarChart3, dashboard: LayoutDashboard, checks: ListChecks, hammer: Hammer,
  play: Play, server: Server, book: BookOpen, plus: Plus, pencil: Pencil,
  trash: Trash2, trophy: Trophy, eye: Eye, zap: Zap,
};

export function Icon({ name, size = 18, className, strokeWidth = 2, style }:
  { name: string; size?: number; className?: string; strokeWidth?: number; style?: React.CSSProperties }) {
  const C = MAP[name] ?? FlaskConical;
  return <C size={size} className={className} strokeWidth={strokeWidth}
    style={{ flexShrink: 0, ...style }} aria-hidden />;
}
