import nodemailer from 'nodemailer';
import { promisify } from 'util';
import { readFile } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Booking, User } from '../types/index.js';
import { AppError } from '../middleware/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const readFileAsync = promisify(readFile);

// Email configuration
const emailConfig = {
  service: process.env.EMAIL_SERVICE || 'gmail',
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
};

// Create transporter
const createTransporter = () => {
  if (!emailConfig.auth.user || !emailConfig.auth.pass) {
    console.warn('Email credentials not configured. Email service will not work.');
    return null;
  }

  return nodemailer.createTransport(emailConfig);
};

const transporter = createTransporter();

// =============================================
// EMAIL TEMPLATES
// =============================================

interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

// Load and compile email templates
const loadTemplate = async (templateName: string, data: Record<string, any>): Promise<EmailTemplate> => {
  try {
    const templatePath = path.join(__dirname, '../../templates/emails', `${templateName}.html`);
    let html = await readFileAsync(templatePath, 'utf-8');
    
    // Simple template replacement
    Object.keys(data).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      html = html.replace(regex, data[key] || '');
    });

    // Extract subject from template (should be in first comment: <!-- Subject: Your subject here -->)
    const subjectMatch = html.match(/<!-- Subject: (.+?) -->/);
    const subject: string = (subjectMatch && subjectMatch[1]) ? subjectMatch[1] : `${templateName} - mLodge Hotel`;

    // Generate text version by stripping HTML
    const text = html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

    return { subject, html, text };
  } catch (error) {
    // Fallback to simple text templates
    return getSimpleTemplate(templateName, data);
  }
};

// Fallback simple templates
const getSimpleTemplate = (templateName: string, data: Record<string, any>): EmailTemplate => {
  const templates = {
    'booking-confirmation': {
      subject: 'Booking Confirmation - mLodge Hotel',
      html: `
        <h2>Booking Confirmation</h2>
        <p>Dear ${data.userName},</p>
        <p>Your booking has been confirmed!</p>
        <div>
          <strong>Booking Details:</strong><br>
          Booking ID: ${data.bookingId}<br>
          Check-in: ${data.checkIn}<br>
          Check-out: ${data.checkOut}<br>
          Room: ${data.roomName}<br>
          Total Amount: $${data.totalAmount}
        </div>
        <p>We look forward to hosting you!</p>
        <p>Best regards,<br>The mLodge Hotel Team</p>
      `,
      text: `Booking Confirmation\n\nDear ${data.userName},\n\nYour booking has been confirmed!\n\nBooking Details:\nBooking ID: ${data.bookingId}\nCheck-in: ${data.checkIn}\nCheck-out: ${data.checkOut}\nRoom: ${data.roomName}\nTotal Amount: $${data.totalAmount}\n\nWe look forward to hosting you!\n\nBest regards,\nThe mLodge Hotel Team`
    },
    'booking-cancelled': {
      subject: 'Booking Cancelled - mLodge Hotel',
      html: `
        <h2>Booking Cancellation</h2>
        <p>Dear ${data.userName},</p>
        <p>Your booking has been cancelled as requested.</p>
        <div>
          <strong>Cancelled Booking:</strong><br>
          Booking ID: ${data.bookingId}<br>
          Room: ${data.roomName}<br>
          ${data.refundInfo ? `Refund: ${data.refundInfo}` : ''}
        </div>
        <p>If you have any questions, please contact us.</p>
        <p>Best regards,<br>The mLodge Hotel Team</p>
      `,
      text: `Booking Cancellation\n\nDear ${data.userName},\n\nYour booking has been cancelled as requested.\n\nCancelled Booking:\nBooking ID: ${data.bookingId}\nRoom: ${data.roomName}\n${data.refundInfo ? `Refund: ${data.refundInfo}` : ''}\n\nIf you have any questions, please contact us.\n\nBest regards,\nThe mLodge Hotel Team`
    },
    'payment-confirmation': {
      subject: 'Payment Confirmation - mLodge Hotel',
      html: `
        <h2>Payment Confirmed</h2>
        <p>Dear ${data.userName},</p>
        <p>We have received your payment for booking ${data.bookingId}.</p>
        <div>
          <strong>Payment Details:</strong><br>
          Amount Paid: $${data.amount}<br>
          Payment Method: ${data.paymentMethod}<br>
          Transaction ID: ${data.transactionId}
        </div>
        <p>Thank you for your payment!</p>
        <p>Best regards,<br>The mLodge Hotel Team</p>
      `,
      text: `Payment Confirmed\n\nDear ${data.userName},\n\nWe have received your payment for booking ${data.bookingId}.\n\nPayment Details:\nAmount Paid: $${data.amount}\nPayment Method: ${data.paymentMethod}\nTransaction ID: ${data.transactionId}\n\nThank you for your payment!\n\nBest regards,\nThe mLodge Hotel Team`
    },
    'password-reset': {
      subject: 'Password Reset - mLodge Hotel',
      html: `
        <h2>Password Reset Request</h2>
        <p>Dear ${data.userName},</p>
        <p>You requested a password reset for your account.</p>
        <p>Click the link below to reset your password:</p>
        <p><a href="${data.resetLink}">Reset Password</a></p>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
        <p>Best regards,<br>The mLodge Hotel Team</p>
      `,
      text: `Password Reset Request\n\nDear ${data.userName},\n\nYou requested a password reset for your account.\n\nClick the link below to reset your password:\n${data.resetLink}\n\nThis link will expire in 1 hour.\n\nIf you didn't request this, please ignore this email.\n\nBest regards,\nThe mLodge Hotel Team`
    },
    'welcome': {
      subject: 'Welcome to mLodge Hotel!',
      html: `
        <h2>Welcome to mLodge Hotel!</h2>
        <p>Dear ${data.userName},</p>
        <p>Thank you for creating an account with us!</p>
        <p>You can now book rooms, manage your reservations, and enjoy exclusive member benefits.</p>
        <p>If you have any questions, feel free to contact us.</p>
        <p>Best regards,<br>The mLodge Hotel Team</p>
      `,
      text: `Welcome to mLodge Hotel!\n\nDear ${data.userName},\n\nThank you for creating an account with us!\n\nYou can now book rooms, manage your reservations, and enjoy exclusive member benefits.\n\nIf you have any questions, feel free to contact us.\n\nBest regards,\nThe mLodge Hotel Team`
    },
  };

  const template = templates[templateName as keyof typeof templates];
  if (!template) {
    throw new AppError(`Email template '${templateName}' not found`, 500);
  }

  return template;
};

// =============================================
// EMAIL SENDING FUNCTIONS
// =============================================

interface SendEmailOptions {
  to: string;
  template: string;
  data: Record<string, any>;
  from?: string;
}

export const sendEmail = async (options: SendEmailOptions): Promise<boolean> => {
  if (!transporter) {
    console.warn('Email service not configured. Cannot send email.');
    return false;
  }

  try {
    const { subject, html, text } = await loadTemplate(options.template, options.data);

    const mailOptions = {
      from: options.from || `"mLodge Hotel" <${emailConfig.auth.user}>`,
      to: options.to,
      subject,
      html,
      text,
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', result.messageId);
    return true;
  } catch (error) {
    console.error('Failed to send email:', error);
    return false;
  }
};

// =============================================
// BOOKING EMAIL FUNCTIONS
// =============================================

export const sendBookingConfirmation = async (user: User, booking: any, room: any): Promise<boolean> => {
  return sendEmail({
    to: user.email,
    template: 'booking-confirmation',
    data: {
      userName: user.name,
      bookingId: booking.id,
      checkIn: new Date(booking.check_in_date).toLocaleDateString(),
      checkOut: new Date(booking.check_out_date).toLocaleDateString(),
      roomName: room.name || room.type,
      totalAmount: booking.total_amount,
      nights: booking.nights,
      guests: booking.number_of_guests,
    },
  });
};

export const sendBookingCancellation = async (user: User, booking: any, refundInfo?: string): Promise<boolean> => {
  return sendEmail({
    to: user.email,
    template: 'booking-cancelled',
    data: {
      userName: user.name,
      bookingId: booking.id,
      roomName: booking.room_name || 'Room',
      refundInfo,
    },
  });
};

export const sendPaymentConfirmation = async (
  user: User,
  booking: any,
  payment: any
): Promise<boolean> => {
  return sendEmail({
    to: user.email,
    template: 'payment-confirmation',
    data: {
      userName: user.name,
      bookingId: booking.id,
      amount: payment.amount,
      paymentMethod: payment.provider,
      transactionId: payment.provider_reference,
    },
  });
};

// =============================================
// AUTH EMAIL FUNCTIONS
// =============================================

export const sendWelcomeEmail = async (user: User): Promise<boolean> => {
  return sendEmail({
    to: user.email,
    template: 'welcome',
    data: {
      userName: user.name,
    },
  });
};

export const sendPasswordResetEmail = async (user: User, resetToken: string): Promise<boolean> => {
  const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
  
  return sendEmail({
    to: user.email,
    template: 'password-reset',
    data: {
      userName: user.name,
      resetLink,
    },
  });
};

// =============================================
// REMINDER EMAIL FUNCTIONS
// =============================================

export const sendBookingReminder = async (user: User, booking: any): Promise<boolean> => {
  return sendEmail({
    to: user.email,
    template: 'booking-confirmation', // Reuse confirmation template
    data: {
      userName: user.name,
      bookingId: booking.id,
      checkIn: new Date(booking.check_in_date).toLocaleDateString(),
      checkOut: new Date(booking.check_out_date).toLocaleDateString(),
      roomName: booking.room_name || 'Room',
      totalAmount: booking.total_amount,
    },
  });
};

// =============================================
// BULK EMAIL FUNCTIONS
// =============================================

export const sendBulkEmails = async (emails: SendEmailOptions[]): Promise<{ success: number; failed: number }> => {
  let success = 0;
  let failed = 0;

  for (const email of emails) {
    const result = await sendEmail(email);
    if (result) {
      success++;
    } else {
      failed++;
    }
  }

  return { success, failed };
};

// =============================================
// EMAIL VERIFICATION
// =============================================

export const verifyEmailConnection = async (): Promise<boolean> => {
  if (!transporter) {
    return false;
  }

  try {
    await transporter.verify();
    console.log('Email service connection verified');
    return true;
  } catch (error) {
    console.error('Email service connection failed:', error);
    return false;
  }
};

export default {
  sendEmail,
  sendBookingConfirmation,
  sendBookingCancellation,
  sendPaymentConfirmation,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendBookingReminder,
  sendBulkEmails,
  verifyEmailConnection,
};