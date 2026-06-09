// Mapa de ícones permitidos no Portal (avisos e atalhos).
import {
  Megaphone, Cake, AlertTriangle, Bell, CalendarDays, TrendingUp,
  Plane, FileText, ReceiptText, GraduationCap, HeartHandshake, Clock,
  CheckCircle2, Star, Gift, Info,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const PORTAL_ICONS: Record<string, LucideIcon> = {
  Megaphone, Cake, AlertTriangle, Bell, CalendarDays, TrendingUp,
  Plane, FileText, ReceiptText, GraduationCap, HeartHandshake, Clock,
  CheckCircle2, Star, Gift, Info,
};

export const PORTAL_ICON_NAMES = Object.keys(PORTAL_ICONS);

export function portalIcon(name: string): LucideIcon {
  return PORTAL_ICONS[name] ?? Info;
}

export const PORTAL_TONES: { value: string; label: string; className: string }[] = [
  { value: "sky", label: "Azul", className: "text-sky-600" },
  { value: "emerald", label: "Verde", className: "text-emerald-600" },
  { value: "violet", label: "Roxo", className: "text-violet-600" },
  { value: "amber", label: "Âmbar", className: "text-amber-600" },
  { value: "rose", label: "Vermelho", className: "text-rose-600" },
];

export function toneClass(tone: string): string {
  return PORTAL_TONES.find((t) => t.value === tone)?.className ?? "text-sky-600";
}
