const Order = require("../../models/Order");
const User = require("../../models/User");
const OrderItem = require("../../models/orderItems");
const Variant =require("../../models/Variant");
const WalletTransaction = require("../../models/WalletTransaction");
const mongoose = require("mongoose");

const ALLOWED_SORT_FIELDS = [
  "order_number",
  "total_amount",
  "status",
  "delivery_date",
  "createdAt",
];

const adminOrderController = {
  // List all orders with search and pagination
  async getOrders(req, res) {
    try {
      const {
        page = 1,
        search = "",
        sortBy = "createdAt",
        sortOrder = "desc",
        status = "",
      } = req.query;

      const limit = 7;
      const skip = (page - 1) * limit;

      const query = {};
      if (search) {
        query.order_number = { $regex: search.trim(), $options: "i" };
      }
      if (status) {
        query.status = status;
      }

      const validSortBy = ALLOWED_SORT_FIELDS.includes(sortBy)
        ? sortBy
        : "createdAt";
      const validSortOrder = sortOrder === "asc" ? 1 : -1;

      const sortOptions = { [validSortBy]: validSortOrder };

      const orders = await Order.find(query)
        .select(
          "order_number total_amount status delivery_date createdAt user_id"
        )
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .lean();

      const total = await Order.countDocuments(query);
      const totalPages = Math.ceil(total / limit);

      orders.forEach((order) => {
        if (order.total_amount && typeof order.total_amount !== "string") {
          try {
            order.total_amount_display = parseFloat(
              order.total_amount.toString()
            ).toFixed(2);
          } catch (e) {
            order.total_amount_display = "N/A";
          }
        } else if (typeof order.total_amount === "number") {
          order.total_amount_display = order.total_amount.toFixed(2);
        } else {
          order.total_amount_display = order.total_amount || "0.00";
        }
      });

      res.render("orders/orderAdmin", {
        orders,
        currentPage: parseInt(page),
        totalPages,
        searchQuery: search,
        filterStatus: status,
        currentSort: {
          sortBy: validSortBy,
          sortOrder: sortOrder === "asc" ? "asc" : "desc",
        },
        messages: req.flash(),
        buildQueryString: (newParams = {}) => {
          const currentParams = { page, search, sortBy, sortOrder, status };
          const allParams = { ...currentParams, ...newParams };
          Object.keys(allParams).forEach((key) => {
            if (!allParams[key] && key !== "page") {
              delete allParams[key];
            }
            if (key !== "page" && newParams.hasOwnProperty(key)) {
              allParams.page = 1;
            }
          });
          return new URLSearchParams(allParams).toString();
        },
      });
    } catch (error) {
      console.error("Error fetching orders:", error);
      req.flash("error", "Failed to load orders. Please try again.");
      res.redirect(req.baseUrl || "/admin/orders");
    }
  },

  // Get single order details
  async getOrderDetails(req, res) {
    try {
      const order = await Order.findById(req.params.id)
        .populate({
          path: "order_items",
          populate: {
            path: "variant_id",
            model: "Variant",
            populate: {
              path: "product_id",
              model: "Product",
            },
          },
        })
        .populate("user_id") // Populate user details
        .populate("address_id") // Populate delivery address
        .lean();
  
      if (!order) {
        req.flash("error", "Order not found");
        return res.redirect("/admin/orders");
      }
  
      res.render("orders/detailAdmin", {
        order,
      });
    } catch (error) {
      console.error("Error fetching order details:", error);
      req.flash("error", "Failed to load order details. Please try again.");
      res.redirect("/admin/orders");
    }
  },

  // Update order status
  async  updateOrderStatus(req, res) {
    try {
    
        const { id, status } = req.body;
        const order = await Order.findById(id)
            .populate({
                path: 'order_items',
                select: 'variant_id quantity status',
            })
            .select('status order_items total_amount pay_method user_id order_number');

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (order.status === 'cancelled' || order.status === 'delivered') {
            return res.status(400).json({
                success: false,
                message: 'Cannot update status of cancelled or delivered order',
            });
        }

        // Update order status
        order.status = status;
        if (status === 'delivered') {
            order.delivered_date = new Date();
            const deadlineDate = new Date(order.delivered_date);
            deadlineDate.setDate(deadlineDate.getDate() + 7);
            order.return_deadline = deadlineDate;
        }

        await order.save();

        // Handle refund and restocking for 'return_allowed' status
        if (status === 'return_allowed') {
            // Update order items and restock variants
            await Promise.all(
                order.order_items.map(async (item) => {
                    if (item.status !== 'returned') {
                        await OrderItem.updateOne(
                            { _id: item._id },
                            { status: 'returned' }
                        );
                    }

                    if (item.variant_id && item.quantity > 0) {
                        const updatedVariant = await Variant.updateOne(
                            { _id: item.variant_id },
                            { $inc: { quantity: item.quantity } }
                        );

                        if (updatedVariant.matchedCount === 0) {
                            console.warn(
                                `Variant ${item.variant_id} not found during restock for order item ${item._id}. Stock may be inaccurate.`
                            );
                        } else if (updatedVariant.modifiedCount === 0) {
                            console.warn(
                                `Variant ${item.variant_id} stock was not modified during restock (matchedCount=1, modifiedCount=0).`
                            );
                        } else {
                            console.log(`Variant ${item.variant_id} stock updated.`);
                        }
                    } else {
                        console.warn(
                            `OrderItem ${item._id} missing variant_id or quantity <= 0, skipping stock update.`
                        );
                    }
                })
            );

            // Handle wallet refund for all payment methods
            const refundAmount = parseFloat(order.total_amount); // Convert Decimal128 to number

            // Update user's wallet balance
            const user = await User.findByIdAndUpdate(
                order.user_id,
                { $inc: { wallet: refundAmount } },
                { new: true }
            );

            if (!user) {
                throw new Error('User not found for wallet update.');
            }

            // Create a wallet transaction record
            const walletTransaction = new WalletTransaction({
                user_id: order.user_id,
                order_id: id,
                transaction_type: 'refund',
                amount: refundAmount,
                balance: user.wallet, // Updated wallet balance
                description: `Refund for return of order ${order.order_number} approved by admin`,
                status: 'completed',
            });

            await walletTransaction.save();

            // Update order's refunded_amount
            await Order.findByIdAndUpdate(id, {
                $set: { refunded_amount: refundAmount },
            });
        }

        if (status === 'return_allowed') {
            return res.status(200).json({
                success: true,
                message: 'Status updated successfully, stock updated, and refund processed',
                redirectUrl: `/admin/orders/${id}`,
            });
        }
        if (status === 'no_return') {
          return res.status(200).json({
              success: true,
              message: 'Status updated successfully, user cannot return the product',
              redirectUrl: `/admin/orders/${id}`,
          });}
        res.redirect(`/admin/orders/${id}`);
    } catch (error) {
        console.error('Error updating order status:', error);

        // Attempt rollback of order status
        try {
            const checkOrder = await Order.findById(id);
            if (checkOrder && checkOrder.status === status) {
                await Order.updateOne(
                    { _id: id },
                    {
                        status: checkOrder.status === 'return_allowed' ? 'return_requested' : 'confirmed',
                        delivered_date: checkOrder.delivered_date || null,
                        return_deadline: checkOrder.return_deadline || null,
                        cancellation_reason: `Rollback due to error: ${error.message}`.substring(0, 200),
                    }
                );
            }
        } catch (rollbackError) {
            console.error(`Rollback attempt for order ${id} failed:`, rollbackError);
        }

        res.status(500).json({
            success: false,
            message: `Failed to update status: ${error.message || 'Please try again.'}`,
        });
    }
},

  // Cancel order
  async  cancelOrder(req, res) {
    try {
        const { id } = req.body;
        const order = await Order.findById(id)
            .populate({
                path: 'order_items',
                select: 'variant_id quantity status',
            })
            .select('status order_items total_amount pay_method user_id order_number');

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (order.status === 'cancelled') {
            return res.status(400).json({ success: false, message: 'Order already cancelled' });
        }

        if (order.status === 'delivered') {
            return res.status(400).json({ success: false, message: 'Cannot cancel delivered order' });
        }

        // Update order status to cancelled"四

        order.status = 'cancelled';
        order.cancelled_at = new Date();
        await order.save();

        // Update order items and restock variants
        await Promise.all(
            order.order_items.map(async (item) => {
                if (item.status !== 'cancelled') {
                    await OrderItem.updateOne(
                        { _id: item._id },
                        { status: 'cancelled' }
                    );
                }

                if (item.variant_id && item.quantity > 0) {
                    const updatedVariant = await Variant.updateOne(
                        { _id: item.variant_id },
                        { $inc: { quantity: item.quantity } }
                    );

                    if (updatedVariant.matchedCount === 0) {
                        console.warn(
                            `Variant ${item.variant_id} not found during restock for order item ${item._id}. Stock may be inaccurate.`
                        );
                    } else if (updatedVariant.modifiedCount === 0) {
                        console.warn(
                            `Variant ${item.variant_id} stock was not modified during restock (matchedCount=1, modifiedCount=0).`
                        );
                    } else {
                        console.log(`Variant ${item.variant_id} stock updated.`);
                    }
                } else {
                    console.warn(
                        `OrderItem ${item._id} missing variant_id or quantity <= 0, skipping stock update.`
                    );
                }
            })
        );

        // Handle wallet refund for 'wallet' or 'razorpay' payment methods
        if (['wallet', 'razorpay'].includes(order.pay_method)) {
            const refundAmount = parseFloat(order.total_amount); // Convert Decimal128 to number

            // Update user's wallet balance
            const user = await User.findByIdAndUpdate(
                order.user_id,
                { $inc: { wallet: refundAmount } },
                { new: true }
            );

            if (!user) {
                throw new Error('User not found for wallet update.');
            }

            // Create a wallet transaction record
            const walletTransaction = new WalletTransaction({
                user_id: order.user_id,
                order_id: id,
                transaction_type: 'refund',
                amount: refundAmount,
                balance: user.wallet, // Updated wallet balance
                description: `Refund for cancelled order ${order.order_number} by admin`,
                status: 'completed',
            });

            await walletTransaction.save();

            // Update order's refunded_amount
            await Order.findByIdAndUpdate(id, {
                $set: { refunded_amount: refundAmount },
            });
        }

        req.flash('success', 'Order cancelled successfully, stock updated, and refund processed if applicable.');
        res.json({ success: true });
    } catch (error) {
        console.error('Error cancelling order:', error);

        // Attempt rollback of order status
        try {
            const checkOrder = await Order.findById(id);
            if (checkOrder && checkOrder.status === 'cancelled') {
                await Order.updateOne(
                    { _id: id },
                    {
                        status: 'confirmed',
                        cancelled_at: null,
                        cancellation_reason: `Rollback due to error: ${error.message}`.substring(0, 200),
                    }
                );
            }
        } catch (rollbackError) {
            console.error(`Rollback attempt for order  failed:`, rollbackError);
        }

        res.status(500).json({ success: false, message: `Failed to cancel order: ${error.message || 'Please try again.'}` });
    }
},
};

module.exports = adminOrderController;
