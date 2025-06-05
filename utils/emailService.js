const nodemailer = require('nodemailer');
const { logger } = require('../middleware/logger');
const { formatCurrency, formatDate } = require('./helpers');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  // Initialize email transporter
  initializeTransporter() {
    try {
      // Configure based on environment
      if (process.env.NODE_ENV === 'production') {
        // Production email service (e.g., SendGrid, Mailgun, etc.)
        this.transporter = nodemailer.createTransporter({
          service: process.env.EMAIL_SERVICE || 'Gmail',
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD
          }
        });
      } else {
        // Development: Use Ethereal Email for testing
        this.transporter = nodemailer.createTransporter({
          host: 'smtp.ethereal.email',
          port: 587,
          auth: {
            user: 'ethereal.user@ethereal.email',
            pass: 'ethereal.pass'
          }
        });
      }

      logger.info('Email service initialized');
    } catch (error) {
      logger.error('Failed to initialize email service', { error: error.message });
    }
  }

  // Send email
  async sendEmail(to, subject, htmlContent, textContent = '') {
    try {
      if (!this.transporter) {
        throw new Error('Email transporter not initialized');
      }

      const mailOptions = {
        from: process.env.EMAIL_FROM || 'CampingHub <noreply@campinghub.com>',
        to,
        subject,
        html: htmlContent,
        text: textContent || this.stripHtml(htmlContent)
      };

      const result = await this.transporter.sendMail(mailOptions);
      
      logger.info('Email sent successfully', {
        to,
        subject,
        messageId: result.messageId
      });

      return result;
    } catch (error) {
      logger.error('Failed to send email', {
        to,
        subject,
        error: error.message
      });
      throw error;
    }
  }

  // Strip HTML tags for text version
  stripHtml(html) {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }

  // Generate email template wrapper
  generateEmailTemplate(title, content, footerContent = '') {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
                background-color: #f4f4f4;
            }
            .email-container {
                background-color: white;
                padding: 30px;
                border-radius: 8px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .header {
                text-align: center;
                margin-bottom: 30px;
                padding-bottom: 20px;
                border-bottom: 2px solid #4CAF50;
            }
            .logo {
                font-size: 24px;
                font-weight: bold;
                color: #4CAF50;
                margin-bottom: 10px;
            }
            .content {
                margin-bottom: 30px;
            }
            .button {
                display: inline-block;
                padding: 12px 24px;
                background-color: #4CAF50;
                color: white;
                text-decoration: none;
                border-radius: 4px;
                margin: 20px 0;
            }
            .footer {
                text-align: center;
                padding-top: 20px;
                border-top: 1px solid #eee;
                color: #666;
                font-size: 12px;
            }
            .booking-details {
                background-color: #f9f9f9;
                padding: 20px;
                border-radius: 4px;
                margin: 20px 0;
            }
        </style>
    </head>
    <body>
        <div class="email-container">
            <div class="header">
                <div class="logo">🏕️ CampingHub</div>
                <h1>${title}</h1>
            </div>
            <div class="content">
                ${content}
            </div>
            <div class="footer">
                ${footerContent || `
                    <p>This email was sent by CampingHub. If you have any questions, please contact our support team.</p>
                    <p>&copy; ${new Date().getFullYear()} CampingHub. All rights reserved.</p>
                `}
            </div>
        </div>
    </body>
    </html>
    `;
  }

  // Welcome email for new users
  async sendWelcomeEmail(user) {
    const content = `
      <h2>Welcome to CampingHub, ${user.firstName}!</h2>
      <p>Thank you for joining our community of outdoor enthusiasts. We're excited to help you discover amazing camping spots and create unforgettable memories.</p>
      
      <p>Here's what you can do with your CampingHub account:</p>
      <ul>
        <li>🔍 Search and discover unique camping spots</li>
        <li>📅 Book your perfect camping getaway</li>
        <li>⭐ Leave reviews and help other campers</li>
        <li>💼 Become a host and share your own camping spot</li>
      </ul>
      
      <p>Ready to start exploring?</p>
      <a href="${process.env.FRONTEND_URL || 'http://localhost:8080'}/spots" class="button">Browse Camping Spots</a>
      
      <p>If you have any questions, our support team is here to help!</p>
    `;

    const htmlContent = this.generateEmailTemplate('Welcome to CampingHub!', content);
    
    await this.sendEmail(
      user.email,
      'Welcome to CampingHub - Start Your Adventure!',
      htmlContent
    );
  }

  // Booking confirmation email
  async sendBookingConfirmationEmail(booking, user, spot) {
    const checkInDate = formatDate(booking.checkIn);
    const checkOutDate = formatDate(booking.checkOut);
    const totalPrice = formatCurrency(booking.totalPrice);

    const content = `
      <h2>Booking Confirmed! 🎉</h2>
      <p>Hi ${user.firstName},</p>
      <p>Great news! Your booking has been confirmed. Get ready for an amazing camping experience!</p>
      
      <div class="booking-details">
        <h3>Booking Details</h3>
        <p><strong>Camping Spot:</strong> ${spot.title}</p>
        <p><strong>Location:</strong> ${spot.location}</p>
        <p><strong>Check-in:</strong> ${checkInDate}</p>
        <p><strong>Check-out:</strong> ${checkOutDate}</p>
        <p><strong>Guests:</strong> ${booking.guests}</p>
        <p><strong>Total Price:</strong> ${totalPrice}</p>
        <p><strong>Booking ID:</strong> #${booking.id}</p>
      </div>
      
      <h3>What's Next?</h3>
      <ul>
        <li>📱 Save this confirmation email for your records</li>
        <li>📍 Plan your route to the camping spot</li>
        <li>🎒 Start packing your camping gear</li>
        <li>📞 Contact the host if you have any questions</li>
      </ul>
      
      <a href="${process.env.FRONTEND_URL}/bookings/${booking.id}" class="button">View Booking Details</a>
      
      <p>We hope you have a wonderful time camping!</p>
    `;

    const htmlContent = this.generateEmailTemplate('Booking Confirmed', content);
    
    await this.sendEmail(
      user.email,
      `Booking Confirmed - ${spot.title}`,
      htmlContent
    );
  }

  // Booking cancellation email
  async sendBookingCancellationEmail(booking, user, spot) {
    const checkInDate = formatDate(booking.checkIn);
    const checkOutDate = formatDate(booking.checkOut);

    const content = `
      <h2>Booking Cancelled</h2>
      <p>Hi ${user.firstName},</p>
      <p>Your booking has been successfully cancelled as requested.</p>
      
      <div class="booking-details">
        <h3>Cancelled Booking Details</h3>
        <p><strong>Camping Spot:</strong> ${spot.title}</p>
        <p><strong>Location:</strong> ${spot.location}</p>
        <p><strong>Check-in:</strong> ${checkInDate}</p>
        <p><strong>Check-out:</strong> ${checkOutDate}</p>
        <p><strong>Booking ID:</strong> #${booking.id}</p>
      </div>
      
      <p>If you paid for this booking, any applicable refund will be processed according to the cancellation policy within 5-7 business days.</p>
      
      <p>We're sorry to see this trip won't be happening, but we hope to help you plan another adventure soon!</p>
      
      <a href="${process.env.FRONTEND_URL}/spots" class="button">Find Another Spot</a>
    `;

    const htmlContent = this.generateEmailTemplate('Booking Cancelled', content);
    
    await this.sendEmail(
      user.email,
      `Booking Cancelled - ${spot.title}`,
      htmlContent
    );
  }

  // New booking notification for owners
  async sendNewBookingNotificationToOwner(booking, guest, spot, owner) {
    const checkInDate = formatDate(booking.checkIn);
    const checkOutDate = formatDate(booking.checkOut);
    const totalPrice = formatCurrency(booking.totalPrice);

    const content = `
      <h2>New Booking Received! 💰</h2>
      <p>Hi ${owner.firstName},</p>
      <p>Congratulations! You have a new booking for your camping spot.</p>
      
      <div class="booking-details">
        <h3>Booking Details</h3>
        <p><strong>Camping Spot:</strong> ${spot.title}</p>
        <p><strong>Guest:</strong> ${guest.firstName} ${guest.lastName}</p>
        <p><strong>Check-in:</strong> ${checkInDate}</p>
        <p><strong>Check-out:</strong> ${checkOutDate}</p>
        <p><strong>Guests:</strong> ${booking.guests}</p>
        <p><strong>Total Earnings:</strong> ${totalPrice}</p>
        <p><strong>Booking ID:</strong> #${booking.id}</p>
      </div>
      
      <p>Please ensure your camping spot is ready for the guests' arrival. You can contact the guest if needed through the platform.</p>
      
      <a href="${process.env.FRONTEND_URL}/owner/bookings/${booking.id}" class="button">View Booking</a>
    `;

    const htmlContent = this.generateEmailTemplate('New Booking Received', content);
    
    await this.sendEmail(
      owner.email,
      `New Booking - ${spot.title}`,
      htmlContent
    );
  }

  // Password reset email
  async sendPasswordResetEmail(user, resetToken) {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    const content = `
      <h2>Password Reset Request</h2>
      <p>Hi ${user.firstName},</p>
      <p>You requested to reset your password for your CampingHub account. Click the button below to create a new password:</p>
      
      <a href="${resetUrl}" class="button">Reset My Password</a>
      
      <p>This link will expire in 1 hour for security reasons.</p>
      
      <p>If you didn't request this password reset, please ignore this email. Your account remains secure.</p>
      
      <p><strong>Security Tip:</strong> Never share your password with anyone, and always use a strong, unique password.</p>
    `;

    const htmlContent = this.generateEmailTemplate('Password Reset Request', content);
    
    await this.sendEmail(
      user.email,
      'Reset Your CampingHub Password',
      htmlContent
    );
  }

  // Review reminder email
  async sendReviewReminderEmail(booking, user, spot) {
    const content = `
      <h2>How was your camping experience? ⭐</h2>
      <p>Hi ${user.firstName},</p>
      <p>We hope you had a wonderful time at ${spot.title}! Your experience matters to us and helps other campers make informed decisions.</p>
      
      <p>Would you take a moment to share your experience by leaving a review?</p>
      
      <a href="${process.env.FRONTEND_URL}/bookings/${booking.id}/review" class="button">Leave a Review</a>
      
      <p>Your review helps:</p>
      <ul>
        <li>🏕️ Other campers choose the perfect spot</li>
        <li>📈 Hosts improve their camping experiences</li>
        <li>🌟 Build a trusted community</li>
      </ul>
      
      <p>Thank you for being part of the CampingHub community!</p>
    `;

    const htmlContent = this.generateEmailTemplate('Share Your Experience', content);
    
    await this.sendEmail(
      user.email,
      `How was your stay at ${spot.title}?`,
      htmlContent
    );
  }
}

// Create and export a singleton instance
const emailService = new EmailService();

module.exports = emailService;