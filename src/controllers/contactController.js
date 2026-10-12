import validator from 'validator';
import { ContactInquiry } from '../models/ContactInquiry.js';
import { sendMail } from '../services/mailer.js';

// @desc    Submit a customer contact inquiry
// @route   POST /api/v1/contact
// @access  Public
export const submitContactInquiry = async (req, res, next) => {
  try {
    const { name, email, phone, orderNumber, subject, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and message are mandatory fields',
      });
    }
    if (!validator.isEmail(String(email))) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address' });
    }
    // Honeypot field – bots fill hidden inputs
    if (req.body.website) {
      return res.status(201).json({ success: true, message: 'Thank you!' });
    }

    const inquiry = await ContactInquiry.create({
      name: String(name).trim().slice(0, 80),
      email: String(email).trim().toLowerCase(),
      phone: String(phone || '').slice(0, 20),
      orderNumber: String(orderNumber || '').slice(0, 30),
      subject: String(subject || 'General Inquiry').slice(0, 120),
      message: String(message).slice(0, 3000),
    });

    if (process.env.ADMIN_NOTIFY_EMAIL) {
      sendMail({
        to: process.env.ADMIN_NOTIFY_EMAIL,
        subject: `📩 Website enquiry: ${inquiry.subject} – ${inquiry.name}`,
        html: `<p><b>${inquiry.name}</b> (${inquiry.email}${inquiry.phone ? `, ${inquiry.phone}` : ''})${inquiry.orderNumber ? ` · Order ${inquiry.orderNumber}` : ''}</p><p style="white-space:pre-wrap">${validator.escape(inquiry.message)}</p>`,
      }).catch(() => {});
    }

    res.status(201).json({
      success: true,
      message: 'Thank you! Your message has been received. Our support team will get back to you shortly.',
      data: {
        id: inquiry._id,
        createdAt: inquiry.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all inquiries (Admin)
// @route   GET /api/v1/contact
// @access  Private/Admin
export const getContactInquiries = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const skip = (Number(page) - 1) * Number(limit);
    const inquiries = await ContactInquiry.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await ContactInquiry.countDocuments(filter);

    res.status(200).json({
      success: true,
      count: inquiries.length,
      total,
      data: inquiries,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update inquiry status (Admin)
// @route   PATCH /api/v1/contact/:id
// @access  Private/Admin
export const updateInquiryStatus = async (req, res, next) => {
  try {
    const { status, adminNotes } = req.body;
    const inquiry = await ContactInquiry.findById(req.params.id);

    if (!inquiry) {
      return res.status(400).json({
        success: false,
        message: 'Inquiry not found',
      });
    }

    if (status) inquiry.status = status;
    if (adminNotes !== undefined) inquiry.adminNotes = adminNotes;

    await inquiry.save();

    res.status(200).json({
      success: true,
      message: 'Inquiry status updated successfully',
      data: inquiry,
    });
  } catch (error) {
    next(error);
  }
};
