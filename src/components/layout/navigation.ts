import {
  BarChart3,
  HelpCircle,
  LayoutDashboard,
  Link2,
  Mail,
  Megaphone,
  Send,
  Settings,
  Target,
  UserCircle,
  Users,
  type LucideIcon,
} from 'lucide-react';

/** Roles allowed to use the console (mirrors AuthContext Role). */
export type NavRole = 'admin' | 'agent' | 'viewer';

export interface NavItem {
  /** Plain-language label shown in the sidebar. */
  label: string;
  /** Router path (renamed for clarity; backend endpoint paths are unchanged). */
  path: string;
  icon: LucideIcon;
  /** One-line page explainer, rendered as the title-band subtitle. */
  explainer: string;
  /** Roles that may see this item. Defaults to admins and viewers. */
  roles?: NavRole[];
}

export interface NavSection {
  id: string;
  label: string;
  icon: LucideIcon;
  items: NavItem[];
  /** Roles that may see this section. Defaults to admins and viewers. */
  roles?: NavRole[];
}

/*
 * Single source of truth for navigation: rendered in both the desktop sidebar and
 * the mobile drawer, and also used to look up each page's title + explainer for
 * its title band (see pageMetaFor).
 */
export const navSections: NavSection[] = [
  {
    id: 'campaigns',
    label: 'Campaigns',
    icon: Megaphone,
    items: [
      {
        label: 'Home',
        path: '/',
        icon: LayoutDashboard,
        explainer: 'Your campaigns at a glance and what to do next.',
      },
      {
        label: 'Contacts',
        path: '/contacts',
        icon: Users,
        explainer: "People you can email who aren't app users yet — your leads list.",
      },
      {
        label: 'Audiences',
        path: '/audiences',
        icon: Target,
        explainer: 'Groups of people to send a campaign to, built from filters.',
      },
      {
        label: 'Email templates',
        path: '/templates',
        icon: Mail,
        explainer: "Reusable email designs with placeholders like the person's name.",
      },
      {
        label: 'Campaigns',
        path: '/campaigns',
        icon: Send,
        explainer: 'An email you send to an audience, with tracked links and results.',
      },
      {
        label: 'Tracked links',
        path: '/links',
        icon: Link2,
        explainer: 'Generate a link for any channel — clicks and signups are still counted.',
      },
      {
        label: 'Analytics',
        path: '/analytics',
        icon: BarChart3,
        explainer: 'Opens, clicks, and signups for each campaign.',
      },
    ],
  },
  {
    id: 'account',
    label: 'Account',
    icon: UserCircle,
    items: [
      {
        label: 'Settings',
        path: '/settings',
        icon: Settings,
        explainer: 'Sending setup, unsubscribes, and your account.',
      },
      {
        label: 'Help & glossary',
        path: '/help',
        icon: HelpCircle,
        explainer: 'Plain-language definitions and a guided walkthrough.',
      },
    ],
  },
];

const allItems: NavItem[] = navSections.flatMap((section) => section.items);

/** Normalise a pathname for comparison (strip trailing slashes; root stays "/"). */
export function normalisePath(pathname: string): string {
  return pathname.replace(/\/+$/, '') || '/';
}

/**
 * Whether a nav item is active for the current route. Non-root items also match
 * their sub-routes (e.g. /campaigns stays active on /campaigns/42), while "/" only
 * matches exactly.
 */
export function isItemActive(itemPath: string, pathname: string): boolean {
  const target = normalisePath(pathname);
  const ip = normalisePath(itemPath);
  if (ip === '/') return target === '/';
  return target === ip || target.startsWith(`${ip}/`);
}

/** Look up the nav item (title + explainer) for the current route. */
export function navItemForPath(pathname: string): NavItem | undefined {
  return allItems.find((item) => isItemActive(item.path, pathname));
}

/** The section id that contains the given route (for auto-expand). */
export function sectionIdForPath(pathname: string): string | undefined {
  return navSections.find((section) =>
    section.items.some((item) => isItemActive(item.path, pathname)),
  )?.id;
}

/**
 * Sections (and their items) visible to a given role. Unspecified `roles` default
 * to admin-only; the marketing console is admin-only today.
 */
export function visibleSections(role: NavRole | undefined): NavSection[] {
  if (!role) return [];
  return navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => (item.roles ?? ['admin', 'viewer']).includes(role)),
    }))
    .filter((section) => (section.roles ?? ['admin', 'viewer']).includes(role) && section.items.length > 0);
}
