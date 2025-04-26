const mongoose = require("mongoose");

const OrderSchema = new mongoose.Schema(
  {
    order_number: {
      type: String,
      unique: true,
      required: true,
      index: true,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    address_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Address",
      required: true,
    },
    coupon_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "coupons",
      default: null,
    },
    payment_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "payments",
      required: true,
    },
    offer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "offers",
      default: null,
    },
    order_items: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "order_items",
        required: true,
      },
    ],
    delivery_charge: {
      type: Number,
      default: 0,
    },
    delivery_date: {
      type: Date,
      default: null,
    },
    delivered_date: {
      type: Date,
      default: null,
    },
    amount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["confirmed", "intransit", "delivered", "cancelled", "return_requested", "return_allowed", "no_return", "payment_failed"],
      default: "confirmed",
    },
    pay_method: { type: String, enum: ['cod', 'razorpay', 'wallet'], required: true },
    total_amount: {
      type: mongoose.Decimal128,
      required: true,
    },
    refunded_amount: {
      type: mongoose.Decimal128,
      default: 0.0,
    },
    return_reason: {
      type: String,
      trim: true,
    },
    return_deadline: {
      type: Date,
      default: null,
    },
    cancelled_at: {
      type: Date,
      default: null,
    },
    cancellation_reason: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

// Create a separate counter schema for tracking order numbers
const CounterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 }
});

// Create the counter model if it doesn't exist already
let Counter;
try {
  Counter = mongoose.model('counter');
} catch (error) {
  Counter = mongoose.model('counter', CounterSchema);
}

// IMPORTANT: Change from pre("save") to pre("validate") to ensure order_number is set before validation
OrderSchema.pre("validate", async function (next) {
  if (this.isNew && !this.order_number) {
    try {
      // Get current date components
      const now = new Date();
      const year = now.getFullYear().toString().slice(2); // Last two digits of year
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const date = String(now.getDate()).padStart(2, '0');
      const datePrefix = `${year}${month}${date}`;
      
      // Increment the counter atomically
      const counter = await Counter.findByIdAndUpdate(
        { _id: 'orderId' },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );
      
      // Generate order number with format: ORD-YYMMDD-SEQUENCE
      this.order_number = `ORD-${datePrefix}-${String(counter.seq).padStart(6, '0')}`;
    } catch (error) {
      return next(error);
    }
  }
  next();
});

// Virtual getter for extracting order date from order number
OrderSchema.virtual('orderDate').get(function() {
  if (!this.order_number) return null;
  
  const datePart = this.order_number.split('-')[1];
  if (datePart && datePart.length === 6) {
    const year = parseInt('20' + datePart.substring(0, 2));
    const month = parseInt(datePart.substring(2, 4)) - 1;
    const day = parseInt(datePart.substring(4, 6));
    return new Date(year, month, day);
  }
  return null;
});

// Add a method to regenerate order number if needed
OrderSchema.methods.regenerateOrderNumber = async function() {
  const now = new Date();
  const year = now.getFullYear().toString().slice(2);
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const date = String(now.getDate()).padStart(2, '0');
  const datePrefix = `${year}${month}${date}`;
  
  const counter = await Counter.findByIdAndUpdate(
    { _id: 'orderId' },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  
  this.order_number = `ORD-${datePrefix}-${String(counter.seq).padStart(6, '0')}`;
  return this.order_number;
};



// Add compound index for common query patterns
OrderSchema.index({ user_id: 1, createdAt: -1 });
OrderSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("orders", OrderSchema);