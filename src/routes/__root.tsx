import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import appCss from '../styles.css?url'
import { SearchModal } from '@/components/search/search-modal'
import { TerminalShortcutListener } from '@/components/terminal-shortcut-listener'
import { GlobalShortcutListener } from '@/components/global-shortcut-listener'
import { WorkspaceShell } from '@/components/workspace-shell'
import { MobilePromptTrigger } from '@/components/mobile-prompt/MobilePromptTrigger'
import { Toaster } from '@/components/ui/toast'
import { OnboardingTour } from '@/components/onboarding/onboarding-tour'
import { KeyboardShortcutsModal } from '@/components/keyboard-shortcuts-modal'
import { initializeSettingsAppearance } from '@/hooks/use-settings'
import {
  VorbiumOnboarding as HermesOnboarding,
  ONBOARDING_COMPLETE_EVENT,
  ONBOARDING_KEY,
} from '@/components/onboarding/vorbium-onboarding'
import { ErrorBoundary } from '@/components/error-boundary'
import { migrateVorbiumLocalStorage } from '@/lib/localstorage-migration'
import { getRootSurfaceState } from './-root-layout-state'


const APP_CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
  // Permitir embedding no Iudex (/vorbium) e em outros hosts locais de dev.
  "frame-ancestors 'self' http://localhost:3000 http://127.0.0.1:3000",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' ws: wss: http: https:",
  "worker-src 'self' blob:",
  "media-src 'self' blob: data:",
  "frame-src 'self' http: https:",
].join('; ')

const THEME_STORAGE_KEY = 'vorbium-theme'
const DEFAULT_THEME = 'vorbium-official'
const VALID_THEMES = [
  'vorbium-official',
  'vorbium-official-light',
  'vorbium-classic',
  'vorbium-classic-light',
  'vorbium-slate',
  'vorbium-slate-light',
  'vorbium-mono',
  'vorbium-mono-light',
  'hermes-nous',
  'hermes-nous-light',
]

const themeScript = `
(() => {
  window.process = window.process || { env: {}, platform: 'browser' };

  try {
    const root = document.documentElement
    const storedTheme = localStorage.getItem('${THEME_STORAGE_KEY}')
    const theme = ${JSON.stringify(VALID_THEMES)}.includes(storedTheme) ? storedTheme : '${DEFAULT_THEME}'
    const lightThemes = ['vorbium-official-light', 'vorbium-classic-light', 'vorbium-slate-light', 'vorbium-mono-light', 'hermes-nous-light']
    const isDark = !lightThemes.includes(theme)
    root.classList.remove('light', 'dark', 'system')
    root.classList.add(isDark ? 'dark' : 'light')
    root.setAttribute('data-theme', theme)
    root.style.setProperty('color-scheme', isDark ? 'dark' : 'light')

    // Demo mode
    try {
      if (new URLSearchParams(window.location.search).get('demo') === '1') {
        document.documentElement.setAttribute('data-demo', 'true');
      }
    } catch {}
  } catch {}
})()
`

const themeColorScript = `
(() => {
  try {
    const root = document.documentElement
    const theme = root.getAttribute('data-theme') || '${DEFAULT_THEME}'
    const colors = {
      'vorbium-official': '#0A0E1A',
      'vorbium-official-light': '#F6F8FC',
      'vorbium-classic': '#0d0f12',
      'vorbium-classic-light': '#F5F2ED',
      'vorbium-slate': '#0d1117',
      'vorbium-slate-light': '#F6F8FA',
      'vorbium-mono': '#111111',
      'vorbium-mono-light': '#FAFAFA',
      'hermes-nous': '#031A1A',
      'hermes-nous-light': '#F8FAF8',
    }
    const nextColor = colors[theme] || colors['${DEFAULT_THEME}']
    const isDark = !['vorbium-official-light', 'vorbium-classic-light', 'vorbium-slate-light', 'vorbium-mono-light', 'hermes-nous-light'].includes(String(theme))

    let meta = document.querySelector('meta[name="theme-color"]')
    if (!meta) {
      meta = document.createElement('meta')
      meta.setAttribute('name', 'theme-color')
      document.head.appendChild(meta)
    }
    meta.setAttribute('content', nextColor)
    root.style.setProperty('color-scheme', isDark ? 'dark' : 'light')
  } catch {}
})()
`

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content:
          'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover, interactive-widget=resizes-visual',
      },
      {
        title: 'Vorbium Engine',
      },
      {
        name: 'description',
        content:
          'Vorbium Engine — workspace jurídico com chat, ferramentas, arquivos, memória e automações.',
      },
      {
        property: 'og:image',
        content: '/cover.png',
      },
      {
        property: 'og:image:type',
        content: 'image/png',
      },
      {
        name: 'twitter:card',
        content: 'summary_large_image',
      },
      {
        name: 'twitter:image',
        content: '/cover.png',
      },
      // PWA meta tags
      {
        name: 'theme-color',
        content: '#0A0E1A',
      },
      {
        name: 'apple-mobile-web-app-capable',
        content: 'yes',
      },
      {
        name: 'apple-mobile-web-app-status-bar-style',
        content: 'default',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
      {
        rel: 'icon',
        type: 'image/svg+xml',
        href: '/vorbium-favicon.svg',
      },
      // PWA manifest and icons
      {
        rel: 'manifest',
        href: '/manifest.json',
      },
      {
        rel: 'apple-touch-icon',
        href: '/apple-touch-icon.png',
        sizes: '180x180',
      },
    ],
  }),

  shellComponent: RootDocument,
  component: RootLayout,
  errorComponent: function RootError({ error }) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center bg-primary-50">
        <h1 className="text-2xl font-semibold text-primary-900 mb-4">
          Something went wrong
        </h1>
        <pre className="p-4 bg-primary-100 rounded-lg text-sm text-primary-700 max-w-full overflow-auto mb-6">
          {error instanceof Error ? error.message : String(error)}
        </pre>
        <button
          onClick={() => (window.location.href = '/')}
          className="px-4 py-2 bg-accent-500 text-white rounded-lg hover:bg-accent-600 transition-colors"
        >
          Return Home
        </button>
      </div>
    )
  },
})

const queryClient = new QueryClient()

export function getRootLayoutMode(onboardingComplete: string | null): 'onboarding' | 'workspace' {
  return onboardingComplete === 'true' ? 'workspace' : 'onboarding'
}

export function wrapInlineScript(source: string): string {
  return `(() => {\n  try {\n${source}\n  } catch (error) {\n    console.error('Inline bootstrap script failed', error)\n  }\n})()`
}

type ServiceWorkerLike = {
  getRegistrations: () => Promise<ReadonlyArray<{ unregister: () => boolean | Promise<boolean> | void | Promise<void> }>>
}

type CachesLike = {
  keys: () => Promise<Array<string>>
  delete: (name: string) => Promise<boolean> | boolean
}

export async function unregisterServiceWorkers({
  serviceWorker,
  cachesApi,
}: {
  serviceWorker?: ServiceWorkerLike
  cachesApi?: CachesLike
}): Promise<void> {
  await serviceWorker
    ?.getRegistrations()
    .then((registrations) =>
      Promise.allSettled(
        registrations.map((registration) => registration.unregister()),
      ),
    )
    .catch(() => undefined)

  await cachesApi
    ?.keys()
    .then((names) => Promise.allSettled(names.map((name) => cachesApi.delete(name))))
    .catch(() => undefined)
}

function RootLayout() {
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(
    null,
  )

  useEffect(() => {
    migrateVorbiumLocalStorage()
    initializeSettingsAppearance()

    const syncOnboardingCompletion = () => {
      try {
        setOnboardingComplete(localStorage.getItem(ONBOARDING_KEY) === 'true')
      } catch {
        setOnboardingComplete(false)
      }
    }

    if (typeof window === 'undefined') {
      return undefined
    }

    syncOnboardingCompletion()

    const handleStorage = (event: StorageEvent) => {
      if (event.key && event.key !== ONBOARDING_KEY) return
      syncOnboardingCompletion()
    }

    const handleOnboardingCompleteChanged = () => {
      syncOnboardingCompletion()
    }

    window.addEventListener('storage', handleStorage)
    window.addEventListener(
      ONBOARDING_COMPLETE_EVENT,
      handleOnboardingCompleteChanged,
    )

    void unregisterServiceWorkers({
      serviceWorker: 'serviceWorker' in navigator ? navigator.serviceWorker : undefined,
      cachesApi: 'caches' in window ? caches : undefined,
    })

    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener(
        ONBOARDING_COMPLETE_EVENT,
        handleOnboardingCompleteChanged,
      )
    }
  }, [])

  const rootSurfaceState = getRootSurfaceState(onboardingComplete)

  return (
    <QueryClientProvider client={queryClient}>

      <Toaster />
      {rootSurfaceState.showOnboarding ? <HermesOnboarding /> : null}
      {rootSurfaceState.showWorkspaceShell ? (
        <>
          <GlobalShortcutListener />
          <TerminalShortcutListener />
          <WorkspaceShell>
            <ErrorBoundary
              className="h-full min-h-0 flex-1"
              title="Something went wrong"
              description="This page failed to render. Reload to try again."
            >
              <Outlet />
            </ErrorBoundary>
          </WorkspaceShell>
          <SearchModal />
          <KeyboardShortcutsModal />
          {rootSurfaceState.showPostOnboardingOverlays ? (
            <>
              <MobilePromptTrigger />
              <OnboardingTour />
            </>
          ) : null}
        </>
      ) : null}
    </QueryClientProvider>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta httpEquiv="Content-Security-Policy" content={APP_CSP} />
        <script
          dangerouslySetInnerHTML={{
            __html: wrapInlineScript(`
          // Polyfill crypto.randomUUID for non-secure contexts (HTTP access via LAN IP)
          if (typeof crypto !== 'undefined' && !crypto.randomUUID) {
            crypto.randomUUID = function() {
              return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, function(c) {
                return (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16);
              });
            };
          }
        `),
          }}
        />
        <script dangerouslySetInnerHTML={{ __html: wrapInlineScript(themeScript) }} />
        <HeadContent />
        <script
          dangerouslySetInnerHTML={{ __html: wrapInlineScript(themeColorScript) }}
        />
      </head>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: wrapInlineScript(`
          (function(){
            if (document.getElementById('splash-screen')) return;
            var bg = '#031A1A', txt = '#F8F1E3', muted = '#9CB2AE', accent = '#FFAC02';
            try {
              var theme = localStorage.getItem('${THEME_STORAGE_KEY}') || '${DEFAULT_THEME}';
              if (theme === 'hermes-nous') {
                bg = '#031A1A';
                txt = '#F8F1E3';
                muted = '#9CB2AE';
                accent = '#FFAC02';
              } else if (theme === 'hermes-nous-light') {
                bg = '#F8FAF8';
                txt = '#16315F';
                muted = '#6F7D96';
                accent = '#2557B7';
              } else if (theme === 'vorbium-classic') {
                bg = '#0d0f12';
                txt = '#eceff4';
                muted = '#7f8a96';
                accent = '#b98a44';
              } else if (theme === 'vorbium-official-light') {
                bg = '#F6F8FC';
                txt = '#111827';
                muted = '#4B5563';
                accent = '#4F46E5';
              } else if (theme === 'vorbium-classic-light') {
                bg = '#F5F2ED';
                txt = '#1a1f26';
                muted = '#6F675E';
                accent = '#b98a44';
              } else if (theme === 'vorbium-slate') {
                bg = '#0d1117';
                txt = '#c9d1d9';
                muted = '#8b949e';
                accent = '#7eb8f6';
              } else if (theme === 'vorbium-slate-light') {
                bg = '#F6F8FA';
                txt = '#24292f';
                muted = '#57606A';
                accent = '#3b82f6';
              } else if (theme === 'vorbium-mono') {
                bg = '#111111';
                txt = '#e6edf3';
                muted = '#888888';
                accent = '#aaaaaa';
              } else if (theme === 'vorbium-mono-light') {
                bg = '#FAFAFA';
                txt = '#1a1a1a';
                muted = '#666666';
                accent = '#666666';
              }
            } catch(e){}

            var isDark = !['vorbium-official-light','vorbium-classic-light','vorbium-slate-light','vorbium-mono-light','hermes-nous-light'].includes(theme);
            var quips = ["Consultando precedentes...","Carregando base legal...","Aquecendo o motor jurídico...","Calibrando ferramentas...","Invocando Vorbium...","Preparando o workspace...","Conectando sistemas...","Inicializando agente..."];
            var quip = quips[Math.floor(Math.random() * quips.length)];

            var d = document.createElement('div');
            d.id = 'splash-screen';
            d.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;background:'+bg+';transition:opacity 0.5s ease;';
            d.innerHTML = '<img src="/vorbium-avatar.webp" alt="Vorbium" style="width:80px;height:80px;margin-bottom:20px;border-radius:16px;filter:drop-shadow(0 8px 32px color-mix(in srgb,'+accent+' 45%, transparent))" />'
              + '<div style="font:600 26px/1 \'Inter\',system-ui,sans-serif;letter-spacing:-0.02em;color:'+txt+';margin-bottom:8px">Vorbium <span style="color:'+accent+'">Engine</span></div>'
              + '<div style="font:400 14px/1 system-ui,-apple-system,sans-serif;letter-spacing:0.04em;color:'+muted+'">Workspace Jurídico</div>'
              + '<div style="margin-top:28px;width:140px;height:3px;background:'+(isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)')+';border-radius:3px;overflow:hidden;position:relative"><div id=splash-bar style="width:0%;height:100%;background:'+accent+';border-radius:3px;transition:width 0.4s ease"></div></div>';
            document.body.prepend(d);

            var bar = document.getElementById('splash-bar');
            if (bar) {
              setTimeout(function(){ bar.style.width='15%' }, 300);
              setTimeout(function(){ bar.style.width='40%' }, 800);
              setTimeout(function(){ bar.style.width='65%' }, 1500);
              setTimeout(function(){ bar.style.width='85%' }, 2500);
              setTimeout(function(){ bar.style.width='92%' }, 3200);
            }

            window.__dismissSplash = function() {
              var el = document.getElementById('splash-screen');
              if (!el) return;
              if (bar) bar.style.width = '100%';
              setTimeout(function(){
                el.style.opacity = '0';
                setTimeout(function(){ el.remove(); }, 500);
              }, 300);
            };
            // Fallback: always dismiss after 5s
            setTimeout(function(){ window.__dismissSplash && window.__dismissSplash(); }, 5000);
            // Fast dismiss: returning users skip quickly
            try {
              if (localStorage.getItem('vorbium-vorbium-url') || localStorage.getItem('vorbium-url')) {
                setTimeout(function(){ window.__dismissSplash && window.__dismissSplash(); }, 600);
              }
            } catch(e) {}
          })()
        `),
          }}
        />
        <div className="root">{children}</div>
        <Scripts />
        <script
          dangerouslySetInnerHTML={{
            __html: wrapInlineScript(`
          (function(){
            var start = Date.now();
            function check() {
              var el = document.querySelector('nav, aside, .workspace-shell, [data-testid]');
              var elapsed = Date.now() - start;
              if (el && elapsed > 2500) { window.__dismissSplash && window.__dismissSplash(); }
              else { setTimeout(check, 200); }
            }
            setTimeout(check, 2500);
          })()
        `),
          }}
        />
      </body>
    </html>
  )
}
