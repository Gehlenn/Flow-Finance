import { describe, expect, it, vi, beforeEach } from 'vitest';

const stripeMocks = vi.hoisted(() => ({
  mockWarn: vi.fn(),
}));

vi.mock('../../src/config/logger', () => ({
  default: {
    warn: stripeMocks.mockWarn,
  },
}));

import { AppError } from '../../src/middleware/errorHandler';
import { parseStripeWebhookEvent, verifyStripeWebhookSignature } from '../../src/services/saas/stripeService';

describe('stripeService', () => {
  beforeEach(() => {
    stripeMocks.mockWarn.mockClear();
  });

  it('registra aviso contextual quando o webhook JSON e invalido', () => {
    let thrown: unknown;
    try {
      parseStripeWebhookEvent('not-json');
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(AppError);
    expect((thrown as AppError).statusCode).toBe(400);
    expect((thrown as AppError).message).toBe('Invalid Stripe webhook JSON payload');

    expect(stripeMocks.mockWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.any(Error),
        rawLength: 8,
      }),
      '[StripeService] Invalid webhook JSON payload'
    );
  });

  it('registra aviso contextual quando a assinatura do webhook esta ausente, malformada ou divergente', () => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';

    expect(verifyStripeWebhookSignature('raw-body', undefined)).toBe(false);
    expect(stripeMocks.mockWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        rawLength: 8,
        hasSignature: false,
        fallback: 'stripe-webhook-signature-missing',
      }),
      '[StripeService] Missing Stripe webhook signature header'
    );

    stripeMocks.mockWarn.mockClear();
    expect(verifyStripeWebhookSignature('raw-body', 't=123')).toBe(false);
    expect(stripeMocks.mockWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        rawLength: 8,
        hasSignature: true,
        hasTimestampPart: true,
        hasSignaturePart: false,
        fallback: 'stripe-webhook-signature-malformed',
      }),
      '[StripeService] Malformed Stripe webhook signature header'
    );

    stripeMocks.mockWarn.mockClear();
    expect(verifyStripeWebhookSignature('raw-body', 't=123,v1=deadbeef')).toBe(false);
    expect(stripeMocks.mockWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        rawLength: 8,
        hasSignature: true,
        fallback: 'stripe-webhook-signature-mismatch',
      }),
      '[StripeService] Stripe webhook signature mismatch'
    );

    stripeMocks.mockWarn.mockClear();
    expect(verifyStripeWebhookSignature('raw-body', `t=123,v1=${'a'.repeat(64)}`)).toBe(false);
    expect(stripeMocks.mockWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        rawLength: 8,
        hasSignature: true,
        providedLength: 64,
        fallback: 'stripe-webhook-signature-mismatch',
      }),
      '[StripeService] Stripe webhook signature mismatch'
    );
  });
});
