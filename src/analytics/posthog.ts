import posthog from 'posthog-js'

const POSTHOG_KEY = import.meta.env.VITE_PUBLIC_POSTHOG_KEY
const POSTHOG_HOST = import.meta.env.VITE_PUBLIC_POSTHOG_HOST

export const initPostHog = () => {
  if (!POSTHOG_KEY || !POSTHOG_HOST) {
    console.warn('PostHog env vars are missing')
    return
  }

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,

    // automatically track page views / page leave
    capture_pageview: false, // we'll handle page views manually for React routing
    capture_pageleave: true,

    // session replay can be enabled later if you want
    autocapture: true,

    // good defaults
    persistence: 'localStorage',
    loaded: (ph) => {
      if (import.meta.env.DEV) ph.debug()
    }
  })
}

export default posthog