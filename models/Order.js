const mongoose = require("mongoose");

const OrderSchema = new mongoose.Schema(
  {
    order_number: {
      type: String,
      unique: true,
      required: true,
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
      enum: ["confirmed", "intransit", "delivered", "cancelled","return_requested","return_allowed"],
      default: "confirmed",
    },
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

OrderSchema.pre("validate", async function (next) {
  if (this.isNew && !this.order_number) {
    try {
      const lastOrder = await mongoose
        .model("orders")
        .findOne()
        .sort({ createdAt: -1 });

      const lastNumber =
        lastOrder && lastOrder.order_number
          ? parseInt(lastOrder.order_number.split("-")[1])
          : 0;

      this.order_number = `ORD-${String(lastNumber + 1).padStart(6, "0")}`;
    } catch (error) {
      return next(error);
    }
  }
  next();
});

module.exports = mongoose.model("orders", OrderSchema);
