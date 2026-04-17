export type ThemeId =
  | 'vorbium-official'
  | 'vorbium-official-light'
  | 'vorbium-classic'
  | 'vorbium-classic-light'
  | 'vorbium-slate'
  | 'vorbium-slate-light'
  | 'vorbium-mono'
  | 'vorbium-mono-light'

export const THEMES: Array<{
  id: ThemeId
  label: string
  description: string
  icon: string
}> = [
  {
    id: 'vorbium-official',
    label: 'Vorbium Official',
    description: 'Navy and indigo flagship theme',
    icon: '⚕',
  },
  {
    id: 'vorbium-official-light',
    label: 'Vorbium Official Light',
    description: 'Soft indigo light palette',
    icon: '⚕',
  },
  {
    id: 'vorbium-classic',
    label: 'Vorbium Classic',
    description: 'Bronze accents on dark charcoal',
    icon: '🔶',
  },
  {
    id: 'vorbium-classic-light',
    label: 'Classic Light',
    description: 'Warm parchment with bronze accents',
    icon: '🔶',
  },
  {
    id: 'vorbium-slate',
    label: 'Slate',
    description: 'Cool blue developer theme',
    icon: '🔷',
  },
  {
    id: 'vorbium-slate-light',
    label: 'Slate Light',
    description: 'GitHub-light palette with blue accents',
    icon: '🔷',
  },
  {
    id: 'vorbium-mono',
    label: 'Mono',
    description: 'Clean monochrome grayscale',
    icon: '◐',
  },
  {
    id: 'vorbium-mono-light',
    label: 'Mono Light',
    description: 'Bright monochrome grayscale',
    icon: '◐',
  },
]

const STORAGE_KEY = 'vorbium-theme'
const DEFAULT_THEME: ThemeId = 'vorbium-official'
const THEME_SET = new Set<ThemeId>(THEMES.map((theme) => theme.id))
const LIGHT_THEME_MAP: Record<
  Exclude<ThemeId, `${string}-light`>,
  Extract<ThemeId, `${string}-light`>
> = {
  'vorbium-official': 'vorbium-official-light',
  'vorbium-classic': 'vorbium-classic-light',
  'vorbium-slate': 'vorbium-slate-light',
  'vorbium-mono': 'vorbium-mono-light',
}
const DARK_THEME_MAP: Record<
  Extract<ThemeId, `${string}-light`>,
  Exclude<ThemeId, `${string}-light`>
> = {
  'vorbium-official-light': 'vorbium-official',
  'vorbium-classic-light': 'vorbium-classic',
  'vorbium-slate-light': 'vorbium-slate',
  'vorbium-mono-light': 'vorbium-mono',
}

const LIGHT_THEMES = new Set<ThemeId>([
  'vorbium-official-light',
  'vorbium-classic-light',
  'vorbium-slate-light',
  'vorbium-mono-light',
])

export function isValidTheme(
  value: string | null | undefined,
): value is ThemeId {
  return typeof value === 'string' && THEME_SET.has(value as ThemeId)
}

export function isDarkTheme(theme: ThemeId): boolean {
  return !LIGHT_THEMES.has(theme)
}

export function getThemeVariant(
  theme: ThemeId,
  mode: 'light' | 'dark',
): ThemeId {
  if (mode === 'light') {
    return isDarkTheme(theme)
      ? LIGHT_THEME_MAP[theme as keyof typeof LIGHT_THEME_MAP]
      : theme
  }

  return isDarkTheme(theme)
    ? theme
    : DARK_THEME_MAP[theme as keyof typeof DARK_THEME_MAP]
}

export function getTheme(): ThemeId {
  if (typeof window === 'undefined') return DEFAULT_THEME
  const stored = localStorage.getItem(STORAGE_KEY)
  return isValidTheme(stored) ? stored : DEFAULT_THEME
}

export function setTheme(theme: ThemeId): void {
  const root = document.documentElement
  root.setAttribute('data-theme', theme)
  root.classList.remove('light', 'dark', 'system')
  const nextMode = isDarkTheme(theme) ? 'dark' : 'light'
  root.classList.add(nextMode)
  root.style.setProperty('color-scheme', nextMode)
  localStorage.setItem(STORAGE_KEY, theme)
}
