import { track } from '@vercel/analytics';
import { API_ENDPOINTS, getAuthHeaders, getStoredWorkspaceId } from '../config/api.config';
import { addBreadcrumb } from '../config/sentry';
import { logWarn } from '../utils/logger';
import {
  sanitizeAnalyticsPropertiesForEvent,
  type ProductAnalyticsEvent,
  type ProductAnalyticsProperties,
} from './productAnalyticsContract';

export type {
  ProductAnalyticsEvent,
  ProductAnalyticsProperties,
} from './productAnalyticsContract';
const STORAGE_PREFIX = 'flow:product-analytics:v1';

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
    return;
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
  const sanitized = sanitizeAnalyticsPropertiesForEvent(eventName, properties);
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
