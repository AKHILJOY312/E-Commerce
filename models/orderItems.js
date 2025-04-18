const mongoose = require("mongoose");

const OrderItemSchema = new mongoose.Schema(
  {
    product_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    variant_id: {
      type:  mongoose.Schema.Types.ObjectId,
      ref: 'Variant', // Reference the Variant model
      required: true // An order item must correspond to a specific variant
  },
    order_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "orders",
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    price: {
      type: Number,
      required: true,
    },
    total_price: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["confirmed", "intransit", "delivered", "cancelled"],
      default: "confirmed",
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
    updated_at: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.models.order_items || mongoose.model("order_items", OrderItemSchema);
