/**
 * Approved animation asset registry (STEP 8.27)
 * Single source of truth for all integrated animation files.
 * Only approved assets are listed; unverified files remain on disk
 * but are never imported or rendered.
 *
 * For CC BY assets, attribution lives in attribution.md — never invented here.
 */

export type AnimationType = 'rive' | 'lottie';

export interface AnimationAsset {
  id: string;
  file: string; // under /animations/
  type: AnimationType;
  intendedUsage: string;
  loading: 'eager' | 'lazy';
  sizeKB: number;
  notes?: string;
  /** For Rive: known artboard / state machine hints (discovered via viewer). */
  rive?: {
    artboard?: string;
    stateMachines?: string[];
    inputs?: string[];
  };
  /** License / attribution is tracked in attribution.md, referenced here. */
  requiresAttribution?: boolean;
}

export const ANIMATION_REGISTRY = {
  // Lottie — approved
  'body-scan': {
    id: 'body-scan',
    file: 'body-scan.lottie',
    type: 'lottie',
    intendedUsage: 'Marketing/homepage anatomy introduction — secondary to 3D model',
    loading: 'lazy',
    sizeKB: 2.7,
  },
  'medical-technology': {
    id: 'medical-technology',
    file: 'medical technology.lottie',
    type: 'lottie',
    intendedUsage: 'Homepage technology/how-it-works section — product content first',
    loading: 'lazy',
    sizeKB: 93.3,
  },

  // Rive — approved
  'medical-data-graph': {
    id: 'medical-data-graph',
    file: 'medical-data-graph.riv',
    type: 'rive',
    intendedUsage:
      'Student progress/mastery analytics — data must be replaced or fallback to CSS chart',
    loading: 'lazy',
    sizeKB: 433.5,
    rive: { stateMachines: ['State Machine 1'] },
    notes: 'Source statistics are not medical claims — replace inputs if editable, else fallback.',
  },
  'ui-icon-set': {
    id: 'ui-icon-set',
    file: 'ui-icon-set.riv',
    type: 'rive',
    intendedUsage: 'Selective small interaction icons — do not replace entire icon system',
    loading: 'lazy',
    sizeKB: 9.9,
  },
  'menu-close-toggle': {
    id: 'menu-close-toggle',
    file: 'menu-close-toggle.riv',
    type: 'rive',
    intendedUsage: 'Responsive navigation menu/close toggle',
    loading: 'lazy',
    sizeKB: 1.0,
    notes:
      'STEP 8.28: no verifiable state-machine/input binding (only unverified "switch"/"toggleX" strings of unknown type) — React mobileOpen stays authoritative, Rive replays to mirror it.',
  },
  'theme-toggle': {
    id: 'theme-toggle',
    file: 'theme-toggle.riv',
    type: 'rive',
    intendedUsage: 'Theme control — only if state machine maps reliably to app theme state',
    loading: 'lazy',
    sizeKB: 4.1,
    notes:
      'STEP 8.28: still unused — app has no theme provider (dark-only) and the asset uses a "mode" view-model with Light/Dark/System states that cannot map safely without building theme architecture.',
  },
  'progress-bar': {
    id: 'progress-bar',
    file: 'progress-bar.riv',
    type: 'rive',
    intendedUsage: 'Actual progress context only — never generic loader; heavy asset',
    loading: 'lazy',
    sizeKB: 9226,
    notes:
      '9.2 MB — must be route/component-lazy, never global. Fallback to CSS ProgressRing if budget exceeded.',
  },
  'success-check': {
    id: 'success-check',
    file: 'success-check.riv',
    type: 'rive',
    intendedUsage: 'Quiz/learning completion feedback — compact, controlled',
    loading: 'lazy',
    sizeKB: 7.7,
    notes:
      'STEP 8.28: unverified "State Machine 1", no verifiable inputs — autoplays once, mounted only on the all-correct completion transition.',
  },
  'notification-bell': {
    id: 'notification-bell',
    file: 'notification-bell.riv',
    type: 'rive',
    intendedUsage: 'Notification trigger — map to real app notification state',
    loading: 'lazy',
    sizeKB: 3.3,
  },
  'search-interaction': {
    id: 'search-interaction',
    file: 'search-interaction.riv',
    type: 'rive',
    intendedUsage: 'Search trigger/input — authoritative search state stays in React',
    loading: 'lazy',
    sizeKB: 3.2,
    notes:
      'STEP 8.28: unverified "State Machine 1"/"ifActive" pair of unknown type — not wired. Decorative mark follows the real dropdown state.',
  },
  'bookmark-interaction': {
    id: 'bookmark-interaction',
    file: 'bookmark-interaction.riv',
    type: 'rive',
    intendedUsage: 'Save/bookmark/studied-structure interaction — visual only',
    loading: 'lazy',
    sizeKB: 5.8,
    notes:
      'STEP 8.28: unverified "Bookmark State Machine"/"Marked" strings of unknown type — not wired. Memoized mark reflects the authoritative studied keys.',
  },
} as const satisfies Record<string, AnimationAsset>;

export type AnimationId = keyof typeof ANIMATION_REGISTRY;

export function animationSrc(id: AnimationId): string {
  return `/animations/${encodeURIComponent(ANIMATION_REGISTRY[id].file)}`;
}

// Unverified — must stay unused until explicitly approved.
export const UNVERIFIED_LOTTIE = [
  'medical loading.lottie',
  'medical success.lottie',
  'medical analytics.lottie',
  'medical-hud.lottie',
  'technology-interface.lottie',
] as const;
