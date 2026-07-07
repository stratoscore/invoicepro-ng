import posthog from '../analytics/posthog'

type EventProperties = Record<string, unknown>

export const trackEvent = (
  eventName: string,
  properties: EventProperties = {}
) => {
  posthog.capture(eventName, {
    ...properties,
    app: 'invoicepro_ng',
    environment: import.meta.env.MODE,
    tracked_at: new Date().toISOString(),
  })
}

export const identifyUser = (userId: string, properties: EventProperties = {}) => {
  posthog.identify(userId, properties)
}

export const resetAnalytics = () => {
  posthog.reset()
}