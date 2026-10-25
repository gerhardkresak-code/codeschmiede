// Einstellungen der Programmierumgebung (Symbole aus dem einheitlichen Lucide-Set, siehe docs/DESIGN.md)
import {
  Users, Cone, Trophy, ClipboardList, BookOpen, Calendar, MessageSquare, Home, CupSoda, Shirt, Gavel, PenLine, Euro,
  Handshake, UsersRound, Sprout, Target, ChartColumn, Palette, Globe, FileText, Settings, Archive, Wrench, Layers, Lightbulb,
  BadgeCheck, Timer, TrendingUp, Contact, CreditCard, Wallet, Network, Map as MapIcon, Vote, ListTodo, Shield, CalendarRange, KeyRound, Star, Ticket, Building2, Database,
} from "lucide-react";

// Symbolname in ws_gruppen.symbol -> Lucide-Symbol
export const WS_ICON = {
  users: Users, cone: Cone, trophy: Trophy, board: ClipboardList, book: BookOpen, calendar: Calendar,
  "message-square": MessageSquare, home: Home, "cup-soda": CupSoda, shirt: Shirt, gavel: Gavel, pen: PenLine, euro: Euro,
  handshake: Handshake, "users-round": UsersRound, sprout: Sprout, target: Target, "chart-column": ChartColumn,
  palette: Palette, globe: Globe, "file-text": FileText, settings: Settings, archive: Archive, wrench: Wrench, layers: Layers, lightbulb: Lightbulb,
  // seit 0.9.12 (Aufbau wie in der App): Symbole der Menüpunkte
  "badge-check": BadgeCheck, timer: Timer, "trending-up": TrendingUp, contact: Contact, "credit-card": CreditCard, wallet: Wallet, network: Network,
  map: MapIcon, vote: Vote, "list-todo": ListTodo, shield: Shield, "calendar-range": CalendarRange, "key-round": KeyRound, star: Star,
  "book-open": BookOpen, ticket: Ticket, building: Building2, database: Database,
};

export const STAND = {
  live: { label: "Live", cls: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400" },
  test: { label: "Im Test", cls: "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300" },
  arbeit: { label: "In Arbeit", cls: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
  entwurf: { label: "Entwurf", cls: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  geplant: { label: "Geplant", cls: "border border-slate-300 text-slate-500 dark:border-slate-700" },
  altlast: { label: "Altlast", cls: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" },
};

export const ROLLEN = { admin: "Admin", entwickler: "Entwickler", texter: "Texter", leser: "Leser" };
export const BEREICH_RECHTE = { auftraege: "Aufträge geben", freigeben: "Freigeben", loeschen: "Löschen" };
