import mongoose from 'mongoose';

const contactInquirySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide your full name'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Please provide your email address'],
      trim: true,
      lowercase: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        'Please provide a valid email address',
      ],
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    orderNumber: {
      type: String,
      trim: true,
      default: '',
    },
    subject: {
      type: String,
      required: [true, 'Please select or provide an inquiry subject'],
      enum: [
        'Order & Tracking Inquiry',
        'Product & Fragrance Consultation',
        'Skincare Guidance',
        'Wholesale & Corporate Gifting',
        'Return & Replacement Request',
        'Grievance & Feedback',
        'General Inquiry',
      ],
      default: 'General Inquiry',
    },
    message: {
      type: String,
      required: [true, 'Please provide your message or inquiry'],
      trim: true,
      maxlength: [3000, 'Message cannot exceed 3000 characters'],
    },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'resolved'],
      default: 'pending',
    },
    adminNotes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

contactInquirySchema.index({ email: 1, createdAt: -1 });
contactInquirySchema.index({ status: 1 });

export const ContactInquiry = mongoose.model('ContactInquiry', contactInquirySchema);
