const Order = require("../../models/Order");
const User = require("../../models/User");
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
  async updateOrderStatus(req, res) {
    try {
      const { id, status } = req.body;
      const order = await Order.findById(id);

      if (!order) {
        return res
          .status(404)
          .json({ success: false, message: "Order not found" });
      }
      if (order.status === "cancelled" || order.status === "delivered") {
        return res
          .status(400)
          .json({
            success: false,
            message: "Cannot update status of cancelled or delivered order",
          });
      }

      // Update status and set delivery_date if status is "delivered"
      order.status = status;
      if (status === "delivered") {
        order.delivered_date = new Date(); // Set to current date when delivered
        const deadlineDate = new Date(order.delivered_date);
        deadlineDate.setDate(deadlineDate.getDate() + 7);
        order.return_deadline = deadlineDate;
      }

      await order.save();

      if(status === "return_allowed") {
        console.log("wprked")
        return res.status(200).json({
          success: true,
          message: "Status updated successfully",
          redirectUrl: `/admin/orders/${id}`,
        });
      }


      res.redirect(`/admin/orders/${id}`);
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ success: false, message: "Failed to update status" });
    }
  },

  // Cancel order
  async cancelOrder(req, res) {
    try {
      const { id } = req.body;
      const order = await Order.findById(id);
      if (!order) {
        return res
          .status(404)
          .json({ success: false, message: "Order not found" });
      }
      if (order.status === "cancelled") {
        return res
          .status(400)
          .json({ success: false, message: "Order already cancelled" });
      }
      if (order.status === "delivered") {
        return res
          .status(400)
          .json({ success: false, message: "Cannot cancel delivered order" });
      }
      order.status = "cancelled";
      order.cancelled_at = new Date();
      await order.save();
      req.flash("success", "Order cancelled successfully");
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ success: false, message: "Failed to cancel order" });
    }
  },
};

module.exports = adminOrderController;
