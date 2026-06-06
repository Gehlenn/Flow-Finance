import { track } from '@vercel/analytics';
import { API_ENDPOINTS, getAuthHeaders, getStoredWorkspaceId } from '../config/api.config';
import { addBreadcrumb } from '../config/sentry';
import { logWarn } from '../utils/logger';

type AnalyticsValue = string | number | boolean | null | undefined;

export type ProductAnalyticsEvent =
  | 'activation_first_transaction'
  | 'activation_first_dashboard_useful'
  | 'ai_consultation_completed'
  | 'ai_fallback_observed'
  | 'weekly_cash_review_completed'
  | 'billing_checkout_started'
  | 'billing_checkout_redirected'
  | 'billing_checkout_failed'
  | 'billing_portal_started'
  | 'billing_portal_redirected'
  | 'billing_portal_failed'
  | 'integration_error_observed';

export type ProductAnalyticsProperties = Record<string, AnalyticsValue>;

const STORAGE_PREFIX = 'flow:product-analytics:v1';
const SENSITIVE_PROPERTY_PATTERN = /(^id$|_id$|workspace|tenant|user|email|name)/i;

function sanitizeProperties(properties: ProductAnalyticsProperties = {}): ProductAnalyticsProperties {
  return Object.fromEntries(
    Object.entries(properties).filter(([key, value]) => {
      if (SENSITIVE_PROPERTY_PATTERN.test(key)) {
        return false;
      }

      return (
        value === null ||
        value === undefined ||
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
      );
    }),
  );
}

function getStorageKey(eventName: ProductAnalyticsEvent, scope: string): string {
  return `${STORAGE_PREFIX}:${eventName}:${hashScope(scope)}`;
}

function hashScope(scope: string): string {
  let hash = 2166136261;
  for (let index = 0; index < scope.length; index += 1) {
    hash ^= scope.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `scope_${(hash >>> 0).toString(36)}`;
}

function hasTracked(eventName: ProductAnalyticsEvent, scope: string): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    return window.localStorage.getItem(getStorageKey(eventName, scope)) === '1';
  } catch {
    return false;
  }
}

function markTracked(eventName: ProductAnalyticsEvent, scope: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(getStorageKey(eventName, scope), '1');
  } catch {
    // Non-critical: analytics dedupe must never block product flows.
  }
}

function canPersistRemotely(): boolean {
  return typeof window !== 'undefined' && Boolean(getStoredWorkspaceId());
}

function persistProductEventRemotely(
  eventName: ProductAnalyticsEvent,
  properties: ProductAnalyticsProperties,
): void {
  const workspaceId = getStoredWorkspaceId();
  if (!canPersistRemotely() || !workspaceId) {
    return;
  }

  const headers = getAuthHeaders({ workspaceId });

  void fetch(API_ENDPOINTS.FINANCE.EVENTS, {
    method: 'POST',
    credentials: 'include',
    headers,
    body: JSON.stringify({
      type: eventName,
      aggregateType: 'product_analytics',
      payload: properties,
      metadata: {
        source: 'product_analytics',
        eventName,
      },
      occurredAt: new Date().toISOString(),
    }),
  }).catch((error) => {
    logWarn('[ProductAnalytics] Failed to persist product event remotely', {
      error,
      eventName,
      workspaceId,
      fallback: 'product-analytics-remote-persist-failed',
    });
  });
}

export function trackProductEvent(
  eventName: ProductAnalyticsEvent,
  properties: ProductAnalyticsProperties = {},
): void {
  const sanitized = sanitizeProperties(properties);
  addBreadcrumb(eventName, 'product-analytics', 'info');

  try {
    track(eventName, sanitized);
  } catch (error) {
    logWarn('[ProductAnalytics] Failed to track product event', {
      error,
      eventName,
      fallback: 'product-analytics-track-failed',
    });
  }

  persistProductEventRemotely(eventName, sanitized);
}

export function trackProductEventOnce(
  eventName: ProductAnalyticsEvent,
  scope: string | null | undefined,
  properties: ProductAnalyticsProperties = {},
): boolean {
  const effectiveScope = scope || 'local';
  if (hasTracked(eventName, effectiveScope)) {
    return false;
  }

  trackProductEvent(eventName, properties);
  markTracked(eventName, effectiveScope);
  return true;
}
