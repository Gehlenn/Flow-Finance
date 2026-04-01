import crypto from 'crypto';
import { AppError } from '../../middleware/errorHandler';
import {
  findWorkspaceByBillingCustomerIdAsync,
  getLastWorkspaceForUserAsync,
  getWorkspaceAsync,
  listWorkspacesForUserAsync,
  updateWorkspaceBilling,
} from '../admin/workspaceStore';
import { Workspace } from '../../types';

type StripeCheckoutInput = {
  userId: string;
  email?: string;
  returnUrl: string;
  workspaceId?: string;
};

type StripePortalInput = {
  userId: string;
  returnUrl: string;
  workspaceId?: string;
};

type StripeWebhookEvent = {
  id: string;
  type: string;
  data: {
    object: {
      customer?: string;
      metadata?: Record<string, string>;
      customer_email?: string;
      subscription?: string;
      items?: {
        data?: Array<{
          price?: {
            id?: string;
          };
        }>;
      };
    };
  };
};

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new AppError(503, `${name} is not configured`);
  }
  return value;
}

async function resolveWorkspaceForUser(userId: string, workspaceId?: string): Promise<Workspace> {
  if (workspaceId) {
    const workspace = await getWorkspaceAsync(workspaceId);
    if (workspace) {
      return workspace;
    }
  }

  const lastWorkspace = await getLastWorkspaceForUserAsync(userId);
  if (lastWorkspace) {
    return lastWorkspace;
  }

  const userWorkspaces = await listWorkspacesForUserAsync(userId);
  if (userWorkspaces.length === 1) {
    return userWorkspaces[0];
  }

  if (userWorkspaces.length > 1) {
    throw new AppError(409, 'Multiple workspaces found for user; explicit workspaceId is required');
  }

  throw new AppError(404, 'Workspace not found for Stripe billing context');
}

function encodeBody(payload: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(payload)) {
    if (value !== undefined) {
      params.append(key, value);
    }
  }
  return params.toString();
}

async function stripePost<T>(path: string, payload: Record<string, string | undefined>): Promise<T> {
  const secretKey = getRequiredEnv('STRIPE_SECRET_KEY');
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: encodeBody(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new AppError(502, `Stripe API error (${path})`, { status: response.status, body });
  }

  return await response.json() as T;
}

export async function createStripeCheckoutSession(input: StripeCheckoutInput): Promise<{ id: string; url: string | null }> {
  const priceId = getRequiredEnv('STRIPE_PRICE_PRO_MONTHLY');
  const successUrl = `${input.returnUrl}${input.returnUrl.includes('?') ? '&' : '?'}billing=success`;
  const cancelUrl = `${input.returnUrl}${input.returnUrl.includes('?') ? '&' : '?'}billing=cancel`;
  const workspace = await resolveWorkspaceForUser(input.userId, input.workspaceId);
  const knownCustomer = workspace.billingCustomerId;

  const session = await stripePost<{ id: string; url: string | null; customer?: string }>('checkout/sessions', {
    mode: 'subscription',
    'line_items[0][price]': priceId,
    'line_items[0][quantity]': '1',
    success_url: successUrl,
    cancel_url: cancelUrl,
    customer: knownCustomer,
    customer_email: knownCustomer ? undefined : input.email,
    'metadata[userId]': input.userId,
    'metadata[workspaceId]': workspace.workspaceId,
  });

  if (session.customer) {
    updateWorkspaceBilling(workspace.workspaceId, {
      billingCustomerId: session.customer,
    });
  }

  return { id: session.id, url: session.url || null };
}

export async function createStripePortalSession(input: StripePortalInput): Promise<{ url: string }> {
  const workspace = await resolveWorkspaceForUser(input.userId, input.workspaceId);
  const customerId = workspace.billingCustomerId;
  if (!customerId) {
    throw new AppError(404, 'Stripe customer not found for workspace');
  }

  const session = await stripePost<{ url: string }>('billing_portal/sessions', {
    customer: customerId,
    return_url: input.returnUrl,
  });

  return { url: session.url };
}

export function verifyStripeWebhookSignature(rawBody: string, stripeSignature?: string): boolean {
  const webhookSecret = getRequiredEnv('STRIPE_WEBHOOK_SECRET');
  if (!stripeSignature) {
    return false;
  }

  const timestampPart = stripeSignature.split(',').find((part) => part.startsWith('t='));
  const signaturePart = stripeSignature.split(',').find((part) => part.startsWith('v1='));

  if (!timestampPart || !signaturePart) {
    return false;
  }

  const timestamp = timestampPart.replace('t=', '').trim();
  const signature = signaturePart.replace('v1=', '').trim();
  const signedPayload = `${timestamp}.${rawBody}`;
  const expectedSignature = crypto.createHmac('sha256', webhookSecret).update(signedPayload).digest('hex');

  const expected = Buffer.from(expectedSignature, 'utf8');
  const provided = Buffer.from(signature, 'utf8');

  return expected.length === provided.length && crypto.timingSafeEqual(expected, provided);
}

export function parseStripeWebhookEvent(rawBody: string): StripeWebhookEvent {
  try {
    return JSON.parse(rawBody) as StripeWebhookEvent;
  } catch {
    throw new AppError(400, 'Invalid Stripe webhook JSON payload');
  }
}

export async function rememberStripeCustomer(userId: string, customerId: string): Promise<void> {
  const workspace = await resolveWorkspaceForUser(userId);
  if (workspace.workspaceId && customerId) {
    updateWorkspaceBilling(workspace.workspaceId, {
      billingCustomerId: customerId,
    });
  }
}

export function rememberStripeCustomerForWorkspace(workspaceId: string, customerId: string): void {
  if (!workspaceId || !customerId) {
    return;
  }

  updateWorkspaceBilling(workspaceId, {
    billingCustomerId: customerId,
  });
}

export async function findWorkspaceForStripeCustomer(customerId: string): Promise<Workspace | undefined> {
  return await findWorkspaceByBillingCustomerIdAsync(customerId);
}

export function getPlanFromStripeEvent(event: StripeWebhookEvent): 'free' | 'pro' | null {
  const configuredProPrice = process.env.STRIPE_PRICE_PRO_MONTHLY;

  if (event.type === 'customer.subscription.deleted') {
    return 'free';
  }

  const priceId = event.data.object.items?.data?.[0]?.price?.id;
  if (!priceId) {
    return null;
  }

  if (configuredProPrice && priceId === configuredProPrice) {
    return 'pro';
  }

  return null;
}

export function resetStripeServiceForTests(): void {
  // No-op: state is persisted in the workspace store.
}
