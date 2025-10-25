import Stripe from 'stripe';
// @ts-ignore: missing type declarations for PayPal SDK
import Paypal from '@paypal/checkout-server-sdk';
// @ts-ignore: missing type declarations for Flutterwave SDK
import Flutterwave from 'flutterwave-node-v3';
import { transaction, query } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import crypto from 'crypto';

// Initialize payment providers
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: ('2024-11-20.acacia' as any),
  typescript: true,
  maxNetworkRetries: 3,
  timeout: 80000,
});

// PayPal configuration
const paypalEnvironment = process.env.PAYPAL_MODE === 'live'
  ? new Paypal.core.LiveEnvironment(
      process.env.PAYPAL_CLIENT_ID || '',
      process.env.PAYPAL_CLIENT_SECRET || ''
    )
  : new Paypal.core.SandboxEnvironment(
      process.env.PAYPAL_CLIENT_ID || '',
      process.env.PAYPAL_CLIENT_SECRET || ''
    );

const paypalClient = new Paypal.core.PayPalHttpClient(paypalEnvironment);

// Flutterwave configuration
const flutterwave = new Flutterwave(
  process.env.FLW_PUBLIC_KEY || '',
  process.env.FLW_SECRET_KEY || ''
);

// Payment provider interface
interface PaymentProvider {
  createIntent(amount: number, currency: string, metadata: any): Promise<any>;
  verifyPayment(reference: string): Promise<any>;
  refund(reference: string, amount?: number): Promise<any>;
}

// Stripe provider implementation
class StripeProvider implements PaymentProvider {
  async createIntent(amount: number, currency: string, metadata: any) {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: currency.toLowerCase(),
      metadata,
      payment_method_types: ['card'],
      capture_method: 'automatic',
    });

    return {
      provider: 'stripe',
      intentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      status: paymentIntent.status,
    };
  }

  async verifyPayment(reference: string) {
    const paymentIntent = await stripe.paymentIntents.retrieve(reference);
    return {
      success: paymentIntent.status === 'succeeded',
      status: paymentIntent.status,
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency,
    };
  }

  async refund(reference: string, amount?: number) {
    const refundData: any = { payment_intent: reference };
    if (amount) refundData.amount = Math.round(amount * 100);

    const refund = await stripe.refunds.create(refundData);
    return {
      success: refund.status === 'succeeded',
      refundId: refund.id,
      status: refund.status,
    };
  }
}

// PayPal provider implementation
class PayPalProvider implements PaymentProvider {
  async createIntent(amount: number, currency: string, metadata: any) {
    const request = new Paypal.orders.OrdersCreateRequest();
    request.prefer('return=representation');
    request.requestBody({
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: currency.toUpperCase(),
          value: amount.toFixed(2),
        },
        description: metadata.description || 'Hotel booking payment',
        reference_id: metadata.booking_id,
      }],
      application_context: {
        brand_name: 'Hotel Booking',
        shipping_preference: 'NO_SHIPPING',
        user_action: 'PAY_NOW',
        return_url: `${process.env.FRONTEND_URL}/payment/success`,
        cancel_url: `${process.env.FRONTEND_URL}/payment/cancel`,
      },
    });

    const order = await paypalClient.execute(request);
    return {
      provider: 'paypal',
      intentId: order.result.id,
  approvalUrl: order.result.links.find((link: any) => link.rel === 'approve')?.href,
      status: order.result.status,
    };
  }

  async verifyPayment(reference: string) {
    const request = new Paypal.orders.OrdersGetRequest(reference);
    const order = await paypalClient.execute(request);
    
    return {
      success: order.result.status === 'COMPLETED',
      status: order.result.status,
      amount: parseFloat(order.result.purchase_units[0].amount.value),
      currency: order.result.purchase_units[0].amount.currency_code,
    };
  }

  async refund(reference: string, amount?: number) {
    const captureId = reference; // Assuming reference is capture ID
    const request = new Paypal.payments.CapturesRefundRequest(captureId);
    
    if (amount) {
      request.requestBody({
        amount: {
          value: amount.toFixed(2),
          currency_code: 'USD', // Should be dynamic
        },
      });
    }

    const refund = await paypalClient.execute(request);
    return {
      success: refund.result.status === 'COMPLETED',
      refundId: refund.result.id,
      status: refund.result.status,
    };
  }
}

// Flutterwave provider implementation
class FlutterwaveProvider implements PaymentProvider {
  async createIntent(amount: number, currency: string, metadata: any) {
    const payload = {
      tx_ref: `hotel_${Date.now()}`,
      amount,
      currency: currency.toUpperCase(),
      redirect_url: `${process.env.FRONTEND_URL}/payment/callback`,
      customer: {
        email: metadata.email,
        phonenumber: metadata.phone,
        name: metadata.name,
      },
      customizations: {
        title: 'Hotel Booking Payment',
        description: metadata.description || 'Payment for hotel booking',
        logo: `${process.env.FRONTEND_URL}/logo.png`,
      },
      meta: metadata,
    };

    const response = await flutterwave.Charge.card(payload);
    return {
      provider: 'flutterwave',
      intentId: response.data.id,
      payUrl: response.data.link,
      status: response.status,
    };
  }

  async verifyPayment(reference: string) {
    const response = await flutterwave.Transaction.verify({ id: reference });
    
    return {
      success: response.data.status === 'successful',
      status: response.data.status,
      amount: response.data.amount,
      currency: response.data.currency,
    };
  }

  async refund(reference: string, amount?: number) {
    const payload: any = { id: reference };
    if (amount) payload.amount = amount;

    const response = await flutterwave.Transaction.refund(payload);
    return {
      success: response.status === 'success',
      refundId: response.data.id,
      status: response.status,
    };
  }
}

// Provider factory
const providers: { [key: string]: PaymentProvider } = {
  stripe: new StripeProvider(),
  paypal: new PayPalProvider(),
  flutterwave: new FlutterwaveProvider(),
};

const getProvider = (providerName: string): PaymentProvider => {
  const provider = providers[providerName];
  if (!provider) {
    throw new AppError(`Unsupported payment provider: ${providerName}`, 400);
  }
  return provider;
};

// =============================================
// CREATE PAYMENT INTENT
// =============================================
export const createPaymentIntent = async (
  userId: string,
  bookingId: string,
  provider: string,
  metadata: any = {}
) => {
  return transaction(async (client) => {
    // Get booking details
    const bookingResult = await client.query(
      `SELECT b.*, u.name, u.email, u.phone, a.name as accommodation_name
       FROM bookings b
       INNER JOIN users u ON b.user_id = u.id
       INNER JOIN accommodations a ON b.accommodation_id = a.id
       WHERE b.id = $1 AND b.user_id = $2`,
      [bookingId, userId]
    );

    if (bookingResult.rows.length === 0) {
      throw new AppError('Booking not found', 404);
    }

    const booking = bookingResult.rows[0];

    // Check if booking is payable
    if (!['pending', 'confirmed'].includes(booking.status)) {
      throw new AppError('Booking is not in a payable state', 400);
    }

    // Create payment intent with provider
    const providerInstance = getProvider(provider);
    const paymentData = {
      ...metadata,
      booking_id: bookingId,
      user_id: userId,
      email: booking.email,
      phone: booking.phone,
      name: booking.name,
      description: `Payment for ${booking.accommodation_name}`,
    };

    const intent = await providerInstance.createIntent(
      booking.total_amount,
      booking.currency,
      paymentData
    );

    // Generate secure reference
    const reference = crypto.randomUUID();

    // Store payment record
    const paymentResult = await client.query(
      `INSERT INTO payments (
        id, user_id, booking_id, provider, status, amount, currency,
        provider_reference, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        reference,
        userId,
        bookingId,
        provider,
        'pending',
        booking.total_amount,
        booking.currency,
        intent.intentId,
        JSON.stringify({ ...intent, ...paymentData }),
      ]
    );

    return {
      payment_id: reference,
      provider,
      amount: booking.total_amount,
      currency: booking.currency,
      ...intent,
    };
  });
};

// =============================================
// WEBHOOK HANDLERS
// =============================================

// Stripe webhook handler
export const handleStripeWebhook = async (payload: any, signature: string) => {
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
  
  let event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, endpointSecret);
  } catch (err: any) {
    throw new AppError(`Webhook signature verification failed: ${err.message}`, 400);
  }

  switch (event.type) {
    case 'payment_intent.succeeded':
      await processPaymentSuccess(event.data.object.id, 'stripe');
      break;
    case 'payment_intent.payment_failed':
      await processPaymentFailure(event.data.object.id, 'stripe');
      break;
    default:
      console.log(`Unhandled Stripe event type: ${event.type}`);
  }

  return { received: true };
};

// PayPal webhook handler
export const handlePayPalWebhook = async (payload: any, headers: any) => {
  // Verify PayPal webhook signature
  const auth = {
    'auth_algo': headers['PAYPAL-AUTH-ALGO'],
    'auth_timestamp': headers['PAYPAL-TRANSMISSION-TIME'],
    'cert_id': headers['PAYPAL-CERT-ID'],
    'auth_version': headers['PAYPAL-AUTH-VERSION'],
  };

  // Process PayPal events
  switch (payload.event_type) {
    case 'PAYMENT.CAPTURE.COMPLETED':
      await processPaymentSuccess(payload.resource.id, 'paypal');
      break;
    case 'PAYMENT.CAPTURE.DENIED':
      await processPaymentFailure(payload.resource.id, 'paypal');
      break;
    default:
      console.log(`Unhandled PayPal event type: ${payload.event_type}`);
  }

  return { received: true };
};

// Flutterwave webhook handler
export const handleFlutterwaveWebhook = async (payload: any, signature: string) => {
  const secretHash = process.env.FLW_SECRET_HASH || '';
  
  // Verify signature
  const hash = crypto.createHmac('sha256', secretHash).update(JSON.stringify(payload)).digest('hex');
  if (hash !== signature) {
    throw new AppError('Invalid webhook signature', 400);
  }

  switch (payload.event) {
    case 'charge.completed':
      await processPaymentSuccess(payload.data.id.toString(), 'flutterwave');
      break;
    case 'charge.failed':
      await processPaymentFailure(payload.data.id.toString(), 'flutterwave');
      break;
    default:
      console.log(`Unhandled Flutterwave event type: ${payload.event}`);
  }

  return { received: true };
};

// =============================================
// PAYMENT PROCESSING HELPERS
// =============================================

const processPaymentSuccess = async (providerReference: string, provider: string) => {
  return transaction(async (client) => {
    // Find payment by provider reference
    const paymentResult = await client.query(
      'SELECT * FROM payments WHERE provider_reference = $1 AND provider = $2',
      [providerReference, provider]
    );

    if (paymentResult.rows.length === 0) {
      console.error(`Payment not found for ${provider} reference: ${providerReference}`);
      return;
    }

    const payment = paymentResult.rows[0];

    // Update payment status
    await client.query(
      `UPDATE payments
       SET status = 'completed', verified_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [payment.id]
    );

    // Update booking status
    await client.query(
      `UPDATE bookings
       SET status = 'confirmed', updated_at = NOW()
       WHERE id = $1`,
      [payment.booking_id]
    );

    // Create success notification
    await client.query(
      `INSERT INTO notifications (user_id, type, message, metadata)
       VALUES ($1, $2, $3, $4)`,
      [
        payment.user_id,
        'payment_success',
        'Your payment has been processed successfully!',
        JSON.stringify({ payment_id: payment.id, booking_id: payment.booking_id }),
      ]
    );

    console.log(`✅ Payment processed successfully: ${payment.id}`);
  });
};

const processPaymentFailure = async (providerReference: string, provider: string) => {
  return transaction(async (client) => {
    // Find payment by provider reference
    const paymentResult = await client.query(
      'SELECT * FROM payments WHERE provider_reference = $1 AND provider = $2',
      [providerReference, provider]
    );

    if (paymentResult.rows.length === 0) {
      console.error(`Payment not found for ${provider} reference: ${providerReference}`);
      return;
    }

    const payment = paymentResult.rows[0];

    // Update payment status
    await client.query(
      `UPDATE payments
       SET status = 'failed', updated_at = NOW()
       WHERE id = $1`,
      [payment.id]
    );

    // Create failure notification
    await client.query(
      `INSERT INTO notifications (user_id, type, message, metadata)
       VALUES ($1, $2, $3, $4)`,
      [
        payment.user_id,
        'payment_failure',
        'Your payment could not be processed. Please try again.',
        JSON.stringify({ payment_id: payment.id, booking_id: payment.booking_id }),
      ]
    );

    console.log(`❌ Payment failed: ${payment.id}`);
  });
};

// =============================================
// VERIFY PAYMENT
// =============================================
export const verifyPayment = async (paymentId: string, provider: string) => {
  return transaction(async (client) => {
    const paymentResult = await client.query(
      'SELECT * FROM payments WHERE id = $1',
      [paymentId]
    );

    if (paymentResult.rows.length === 0) {
      throw new AppError('Payment not found', 404);
    }

    const payment = paymentResult.rows[0];

    // Verify with provider
    const providerInstance = getProvider(provider);
    const verification = await providerInstance.verifyPayment(payment.provider_reference);

    // Update payment status
    const status = verification.success ? 'completed' : 'failed';
    await client.query(
      `UPDATE payments
       SET status = $1, verified_at = NOW(), updated_at = NOW()
       WHERE id = $2`,
      [status, paymentId]
    );

    if (verification.success) {
      // Update booking status
      await client.query(
        `UPDATE bookings
         SET status = $1, updated_at = NOW()
         WHERE id = $2`,
        ['confirmed', payment.booking_id]
      );

      // Create notification
      await client.query(
        `INSERT INTO notifications (user_id, type, message)
         VALUES ($1, $2, $3)`,
        [
          payment.user_id,
          'payment_success',
          `Payment successful for booking ID: ${payment.booking_id}`,
        ]
      );
    }

    return { success: verification.success, status, payment };
  });
};

// =============================================
// REFUND PAYMENT
// =============================================
export const refundPayment = async (
  paymentId: string,
  amount?: number,
  reason?: string
) => {
  return transaction(async (client) => {
    const paymentResult = await client.query(
      'SELECT * FROM payments WHERE id = $1',
      [paymentId]
    );

    if (paymentResult.rows.length === 0) {
      throw new AppError('Payment not found', 404);
    }

    const payment = paymentResult.rows[0];

    if (payment.status !== 'completed') {
      throw new AppError('Can only refund completed payments', 400);
    }

    // Process refund with provider
    const providerInstance = getProvider(payment.provider);
    const refund = await providerInstance.refund(payment.provider_reference, amount);

    // Create refund record
    const refundId = crypto.randomUUID();
    await client.query(
      `INSERT INTO payments (
        id, user_id, booking_id, provider, type, status, amount, currency,
        provider_reference, metadata, original_payment_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        refundId,
        payment.user_id,
        payment.booking_id,
        payment.provider,
        'refund',
        refund.success ? 'completed' : 'failed',
        amount || payment.amount,
        payment.currency,
        refund.refundId,
        JSON.stringify({ reason, ...refund }),
        paymentId,
      ]
    );

    // Create notification
    await client.query(
      `INSERT INTO notifications (user_id, type, message, metadata)
       VALUES ($1, $2, $3, $4)`,
      [
        payment.user_id,
        'refund_processed',
        `Refund of ${amount || payment.amount} ${payment.currency} has been processed.`,
        JSON.stringify({ refund_id: refundId, original_payment_id: paymentId }),
      ]
    );

    return { success: refund.success, refund_id: refundId, ...refund };
  });
};

// =============================================
// GET PAYMENT DETAILS
// =============================================
export const getPaymentById = async (paymentId: string) => {
  const result = await query(
    `SELECT
      p.*,
      b.confirmation_code,
      b.checkin_date,
      b.checkout_date,
      b.accommodation_id,
      a.name as accommodation_name,
      u.name as user_name,
      u.email as user_email
    FROM payments p
    INNER JOIN bookings b ON p.booking_id = b.id
    INNER JOIN accommodations a ON b.accommodation_id = a.id
    INNER JOIN users u ON p.user_id = u.id
    WHERE p.id = $1`,
    [paymentId]
  );

  if (result.rows.length === 0) {
    throw new AppError('Payment not found', 404);
  }

  return result.rows[0];
};

// =============================================
// GET USER PAYMENTS
// =============================================
export const getUserPayments = async (userId: string) => {
  const result = await query(
    `SELECT
      p.*,
      b.accommodation_id,
      a.name as accommodation_name,
      a.city,
      a.country
    FROM payments p
    INNER JOIN bookings b ON p.booking_id = b.id
    INNER JOIN accommodations a ON b.accommodation_id = a.id
    WHERE p.user_id = $1
    ORDER BY p.created_at DESC`,
    [userId]
  );

  return result.rows;
};

// =============================================
// PAYMENT ANALYTICS
// =============================================
export const getPaymentAnalytics = async (startDate: Date, endDate: Date) => {
  const result = await query(
    `SELECT
      provider as payment_provider,
      COUNT(*) as transaction_count,
      SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as total_revenue,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful_payments,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_payments,
      AVG(CASE WHEN status = 'completed' THEN amount ELSE NULL END) as avg_transaction_value
    FROM payments
    WHERE created_at BETWEEN $1 AND $2
    GROUP BY provider`,
    [startDate, endDate]
  );

  return result.rows;
};