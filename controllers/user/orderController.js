const Cart = require('../../models/Cart');
const Address = require('../../models/Addresses');
const User = require('../../models/User');
const Variant = require('../../models/Variant');
const Product = require('../../models/Product');
const Order = require('../../models/Order');
const OrderItem = require('../../models/orderItems');
const mongoose = require('mongoose');
const PDFDocument = require('pdfkit');
const crypto = require("crypto");
const Transaction=require('../../models/WalletTransaction');
const Coupon = require('../../models/Coupon');
const CouponUsage= require('../../models/CouponUsage');
const Review = require('../../models/Review');


exports.getCheckoutPage = async (req, res) => {
  try {
    const userId = req.session.user_id;
   
    const cart = await Cart.findOne({ user_id: userId })
      .populate({
        path: 'products.product_id',
        model: 'Product'
      })
      .populate({
        path: 'products.variant_id',
        model: 'Variant'
      });
   
    // Fetch all addresses for the user
    const addresses = await Address.find({ user_id: userId }).lean();
    const defaultAddress = addresses.find(addr => addr.is_default) || addresses[0] || null;
    const user = await User.findById(userId);
   
    // Check if cart is empty and redirect to shop with message
    if (!cart || !cart.products || cart.products.length === 0) {
      req.flash('error', 'Your cart is empty. Please add items to your cart before checking out.');
      return res.redirect('/shop');
    }
   
    const availableProducts = cart.products.filter(item =>
      item.variant_id && item.variant_id.quantity > 0 &&
      item.quantity <= item.variant_id.quantity
    );
   
    // Check if there are no available products after filtering
    if (availableProducts.length === 0) {
      return res.redirect('/cart');
    }
   
    // Calculate subtotal
    let subtotal = availableProducts.reduce((sum, item) =>
      sum + (item.variant_id.sale_price * item.quantity), 0);
   
    // Check for coupon in session instead of cart
    let discount = 0;
    let couponApplied = null;
   
    // If there's an active coupon in session
    if (req.session.appliedCoupon) {
      // Fetch the coupon directly from the coupon database
      const coupon = await Coupon.findById(req.session.appliedCoupon.couponId);
      
      if (coupon && coupon.status && !coupon.is_deleted && 
          new Date() >= coupon.start_date && new Date() <= coupon.end_date) {
        
        // Check if minimum order value is met
        if (subtotal >= coupon.min_order_value) {
          couponApplied = {
            code: coupon.code,
            type: coupon.discount_type
          };
          
          // Calculate discount based on type
          if (coupon.discount_type === 'percentage') {
            discount = (subtotal * coupon.discount_value / 100);
            // Optional: Cap percentage discount if needed
            // discount = Math.min(discount, someMaxValue);
          } else { // fixed discount
            discount = coupon.discount_value;
          }
          
          // Ensure discount doesn't exceed subtotal
          discount = Math.min(discount, subtotal);
        }
      }
    }
   
    // Calculate shipping cost
    const shippingCost = subtotal > 1000 ? 0 : 50;
   
    // Calculate total including discount
    const total = subtotal - discount + shippingCost;
   
    res.render('order/checkout', {
      cart: {
        products: availableProducts,
        subtotal,
        discount: discount,
        couponApplied: couponApplied,
        shippingCost,
        total
      },
      addresses,
      address: defaultAddress,
      user,
      currentActivePage: "shop"
    });
  } catch (error) {
    console.error("error getting the checkout", error);
    res.redirect('/cart');
  }
};

const verifyRazorpaySignature = (order_id, payment_id, signature) => {
  
  
  const body = order_id + "|" + payment_id;
 
  
  const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");
  
  
  return expectedSignature === signature;
};


exports.placeOrder = async (req, res) => {
  try {
    const userId = req.session.user_id;
    const { payment_method, addressId } = req.body;
    let createdWalletTransactionId = null;

    let discount = 0;
    let couponCode = null;
    let couponId = null;
    let couponDetails = null;
    
    

    if (!payment_method) {
      req.flash('error', 'Please select a payment method');
      
      return res.redirect('/checkout');
    }

    const user = await User.findById(userId).populate('referredBy');

    if (payment_method === 'wallet') {
      const cart = await Cart.findOne({ user_id: userId })
        .populate('products.product_id')
        .populate('products.variant_id');

      if (!cart || !cart.products.length) {
        req.flash('error', 'Cart is empty');
        return res.redirect('/checkout');
      }
      
      // Check for coupon in session instead of cart
      if (req.session.appliedCoupon) {
        const coupon = await Coupon.findById(req.session.appliedCoupon.couponId);
        if (coupon) {
          couponCode = coupon.code;
          couponId = coupon._id;
          couponDetails = req.session.appliedCoupon;
          
          // Calculate discount based on subtotal and coupon type
          const subtotal = cart.products.reduce((sum, item) => 
            sum + (item.variant_id.sale_price * item.quantity), 0);
            
          if (coupon.discount_type === 'percentage') {
            discount = (subtotal * coupon.discount_value / 100);
          } else {
            discount = coupon.discount_value;
          }
          
          // Ensure discount doesn't exceed subtotal
          discount = Math.min(discount, subtotal);
        }
      }

      const subtotal = cart.products.reduce((sum, item) => 
        sum + (item.variant_id.sale_price * item.quantity), 0);
      const deliveryCharge = subtotal > 1000 ? 0 : 50;
      const total = subtotal - discount + deliveryCharge;

      if (user.wallet < total) {
        req.flash('error', 'Insufficient wallet balance');
        return res.redirect('/checkout');
      }

      user.wallet -= total;
      const userSave = await user.save();
      if(userSave){
         const txn = await Transaction.create({
              user_id: userId,
              amount: total,
              balance: user.wallet,
              transaction_type: 'purchase',
              description: 'Purchase from wallet', 
              status: 'completed',
            });
            createdWalletTransactionId = txn._id;
      }
    }

    if (payment_method === 'razorpay') {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
      const isValid = verifyRazorpaySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);

      if (!isValid) {
        req.flash('error', 'verification failed');
        return res.redirect('/checkout');
      }
    }

    if (!addressId || !mongoose.Types.ObjectId.isValid(addressId)) {
      req.flash('error', 'Please select a valid address');
      return res.redirect('/checkout');
    }

    const cart = await Cart.findOne({ user_id: userId })
      .populate('products.product_id')
      .populate('products.variant_id');

    if (!cart || !cart.products.length) {
      req.flash('error', 'Cart is empty');
      return res.redirect('/checkout');
    }

    const selectedAddress = await Address.findOne({ _id: addressId, user_id: userId });
    if (!selectedAddress) {
      req.flash('error', 'Selected address not found');
      return res.redirect('/checkout');
    }

    const availableProducts = cart.products.filter(item => 
      item.variant_id && item.variant_id.quantity >= item.quantity
    );

    if (availableProducts.length === 0) {
      req.flash('error', 'No items in cart are available in sufficient quantity');
      return res.redirect('/checkout');
    }

    // Check for coupon in session if not already set (for non-wallet payments)
    if (!couponId && req.session.appliedCoupon) {
      const coupon = await Coupon.findById(req.session.appliedCoupon.couponId);
      if (coupon) {
        couponCode = coupon.code;
        couponId = coupon._id;
        couponDetails = req.session.appliedCoupon;
        
        // Calculate discount based on subtotal and coupon type
        const subtotal = availableProducts.reduce((sum, item) => 
          sum + (item.variant_id.sale_price * item.quantity), 0);
          
        if (coupon.discount_type === 'percentage') {
          discount = (subtotal * coupon.discount_value / 100);
        } else {
          discount = coupon.discount_value;
        }
        
        // Ensure discount doesn't exceed subtotal
        discount = Math.min(discount, subtotal);
      }
    }

    const subtotal = availableProducts.reduce((sum, item) => 
      sum + (item.variant_id.sale_price * item.quantity), 0);
    const deliveryCharge = subtotal > 1000 ? 0 : 50;
    const total = subtotal - discount + deliveryCharge;

    const deliveryDate = new Date();
    deliveryDate.setDate(deliveryDate.getDate() + 7);

    const order = new Order({
      user_id: userId,
      payment_id: new mongoose.Types.ObjectId(),
      delivery_charge: deliveryCharge,
      delivery_date: deliveryDate,
      amount: subtotal,
      coupon_id: couponId,
      total_amount: total.toString(),
      status: 'confirmed',
      address_id: addressId,
      pay_method: payment_method,
    });

    await order.save();
    if (createdWalletTransactionId) {
      
        await Transaction.findByIdAndUpdate(createdWalletTransactionId, {
          order_id: order._id 
        });
      }
    const orderItems = await Promise.all(availableProducts.map(async item => {
      const variant = await Variant.findOneAndUpdate(
        { _id: item.variant_id._id, quantity: { $gte: item.quantity } },
        { $inc: { quantity: -item.quantity } },
        { new: true }
      );

      if (!variant) {
        throw new Error(`Insufficient stock for variant ${item.variant_id._id}`);
      }

      const orderItem = new OrderItem({
        product_id: item.product_id._id,
        variant_id: item.variant_id._id,
        order_id: order._id,
        quantity: item.quantity,
        price: item.variant_id.sale_price,
        total_price: item.variant_id.sale_price * item.quantity,
      });
      await orderItem.save();

      return orderItem._id;
    }));

    order.order_items = orderItems;
    await order.save();

    // If a coupon was used, record the usage in CouponUsage and update the coupon's used count
    if (couponId) {
      // Record coupon usage
      await CouponUsage.create({
        user_id: userId,
        coupon_id: couponId,
        used_at: new Date()
      });
      
      // Increment coupon used count
      await Coupon.findByIdAndUpdate(
        couponId,
        { $inc: { used_count: 1 } }
      );
      
      // Clear coupon from session
      delete req.session.appliedCoupon;
    }
    
    // Delete the cart
    await Cart.findOneAndDelete({ user_id: userId });

    // Update this part to properly track referral rewards
    if (user.referredBy && !user.hasReceivedReferralReward) {
      // Find the referrer
      const referrer = await User.findById(user.referredBy);
      if (referrer) {
        // Add ₹100 to referrer's wallet
        referrer.wallet += 100;
        
        // Add a record of this reward to referrer's referralRewards array
        referrer.referralRewards.push({
          amount: 100,
          status: 'credited',
          createdAt: Date.now()
        });
        await referrer.save();
      
        // Reward the new user (referee)
        user.wallet += 50;
        
        // Add a record of this reward to user's referralRewards array
        user.referralRewards.push({
          amount: 50,
          status: 'credited',
          createdAt: Date.now()
        });
        user.hasReceivedReferralReward = true; // Mark as rewarded
        await user.save();
      }
    }
    
    res.render('payment/payment-success', {
      currentActivePage: "",
      order,
      payment_method,
      couponCode,
      discount
    });
  } catch (error) {
    console.error('Error placing order:', error);
    if (order && order._id) {
      await Order.deleteOne({ _id: order._id });
      await OrderItem.deleteMany({ order_id: order._id });
    }
    req.flash('error', 'Failed to place order. Please try again.');
    res.redirect('/cart');
  }
};

exports.getRecentOrders = async (req, res) => {
    try {
      const userId = req.session.user_id;
      const { page = 1, limit = 5, search = '' } = req.query;
  
      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
      const skip = (pageNum - 1) * limitNum;
  
      const searchQuery = { user_id: userId };
      if (search) {
        searchQuery.order_number = { $regex: search, $options: 'i' };
      }
  
      const totalOrders = await Order.countDocuments(searchQuery);
  
      const orders = await Order.find(searchQuery)
        .sort({ createdAt: -1 })
        .populate({
          path: 'order_items',
          populate: [
            {
              path: 'product_id',
              model: 'Product', // Must match models/Product.js
              select: 'name brand',
            },
            {
              path: 'variant_id',
              model: 'Variant', // Must match models/Variant.js
              select: 'product_image material color size price sale_price description',
            },
          ],
        })
        .skip(skip)
        .limit(limitNum);
  

      const totalPages = Math.ceil(totalOrders / limitNum);
  
      res.render('order/recent-orders', {
        orders,
        currentActivePage: "shop",
        pagination: {
          currentPage: pageNum,
          totalPages,
          limit: limitNum,
          totalOrders,
          hasPrev: pageNum > 1,
          hasNext: pageNum < totalPages,
          search,
        },
      });
    } catch (error) {
      console.error('Error in getRecentOrders:', error);
      res.status(500).send('Server Error');
    }
  };

exports.getEditOrder = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const userId = req.session.user_id;

        const order = await Order.findOne({ _id: orderId, user_id: userId })
            .populate({
                path: 'order_items',
                populate: [
                    {
                        path: 'product_id',
                        model: 'Product',
                        populate: {
                            path: 'variants',
                            model: 'Variant'
                        }
                    }
                ]
            });

        if (!order || order.status !== 'confirmed') {
            req.flash('error', 'Order cannot be edited');
            return res.redirect('/orders/recent');
        }

        const addresses = await Address.find({ user_id: userId });
        
        res.render('order/edit-order', {
            order,
            addresses,
            currentActivePage: "shop"
        });
    } catch (error) {
        console.error(error);
        req.flash('error', 'Failed to load order for editing');
        res.redirect('/orders/recent');
    }
};

exports.updateOrder = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const userId = req.session.user_id;
        const { address_id } = req.body;

        const order = await Order.findOne({ _id: orderId, user_id: userId });
        if (!order || order.status !== 'confirmed') {
            req.flash('error', 'Order cannot be updated');
            return res.redirect('/orders/recent');
        }

        const address = await Address.findOne({ _id: address_id, user_id: userId });
        if (!address) {
            req.flash('error', 'Invalid address selected');
            return res.redirect(`/orders/edit/${orderId}`);
        }

        // Here you could update other order details if needed
        // For now, we're just updating the address association
        order.address_id= address_id;
        order.updated_at = new Date();
        await order.save();

        req.flash('success', 'Order updated successfully!');
        res.redirect('/orders/recent');
    } catch (error) {
        console.error(error);
        req.flash('error', 'Failed to update order');
        res.redirect(`/orders/edit/${req.params.orderId}`);
    }
};


exports.cancelOrder = async (req, res) => {
  const orderId = req.params.orderId;
  const userId = req.session.user_id;
  const { cancellation_reason } = req.body;
  let orderNumber=null;
  try {
      const order = await Order.findOne({ _id: orderId, user_id: userId })
          .populate({
              path: 'order_items',
              select: 'variant_id quantity status',
          })
          .select('status order_items total_amount pay_method');

      if (!order) {
          req.flash('error', 'Order not found or access denied.');
          return res.redirect('/orders/recent');
      }
      orderNumber = order.order_number;
      if (order.status !== 'confirmed' && order.status !== 'intransit') {
          req.flash('error', `Order cannot be cancelled (Status: ${order.status})`);
          return res.redirect('/orders/recent');
      }

      // Update order status to cancelled
      const updatedOrder = await Order.findByIdAndUpdate(
          orderId,
          {
              status: 'cancelled',
              cancelled_at: new Date(),
              cancellation_reason: cancellation_reason || 'Cancelled by user',
          },
          { new: true }
      );

      if (!updatedOrder) {
          throw new Error('Failed to update order status.');
      }

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
              userId,
              { $inc: { wallet: refundAmount } },
              { new: true }
          );

          if (!user) {
              throw new Error('User not found for wallet update.');
          }

          // Create a wallet transaction record
          const walletTransaction = new Transaction({
              user_id: userId,
              order_id: orderId,
              transaction_type: 'refund',
              amount: refundAmount,
              balance: user.wallet, // Updated wallet balance
              description: `Refund for cancelled order ${orderId}`,
              status: 'completed',
          });

          await walletTransaction.save();

          // Update order's refunded_amount
          await Order.findByIdAndUpdate(orderId, {
              $set: { refunded_amount: refundAmount },
          });
      }

      req.flash('success', 'Order cancelled successfully, stock updated, and refund processed if applicable.');
      res.redirect('/orders/recent');
  } catch (error) {
      console.error('Error cancelling order:', error);

      // Attempt rollback of order status if necessary
      try {
          const checkOrder = await Order.findById(orderId);
          if (checkOrder && checkOrder.status === 'cancelled') {
              await Order.updateOne(
                  { _id: orderId },
                  {
                      status: 'confirmed',
                      cancelled_at: null,
                      cancellation_reason: `Rollback due to error: ${error.message}`.substring(0, 200),
                  }
              );
          }
      } catch (rollbackError) {
          console.error(`Rollback attempt for order ${orderId} failed:`, rollbackError);
      }

      req.flash('error', `Failed to cancel order: ${error.message || 'Please try again.'}`);
      res.redirect('/orders/recent');
  }
};




exports.getOrderDetails = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const userId = req.session.user_id;

    // Find the order and populate necessary fields
    const order = await Order.findOne({ _id: orderId, user_id: userId })
      .populate({
        path: 'order_items',
        populate: {
          path: 'variant_id',
          model: 'Variant',
          populate: {
            path: 'product_id',
            model: 'Product'
          }
        }
      })
      .populate('user_id', 'name email phone')
      .populate('address_id')
      .lean();

    if (!order) {
      req.flash('error', 'Order not found or access denied.');
      return res.redirect('/orders/recent');
    }

    // Check if the user has reviewed each product
    if (order.order_items) {
      for (let item of order.order_items) {
        if (item.variant_id && item.variant_id.product_id) {
          const existingReview = await Review.findOne({
            user_id: userId,
            product_id: item.variant_id.product_id._id
          }).lean();
          item.hasReviewed = !!existingReview; // true if review exists, false otherwise
        } else {
          item.hasReviewed = true; // Prevent review button for incomplete items
        }
      }
    }

    // Format currency/dates
    if (order.total_amount) {
      try {
        order.total_amount_display = parseFloat(order.total_amount.toString()).toFixed(2);
      } catch {
        order.total_amount_display = 'N/A';
      }
    } else {
      order.total_amount_display = '0.00';
    }

    if (order.refunded_amount) {
      try {
        order.refunded_amount_display = parseFloat(order.refunded_amount.toString()).toFixed(2);
      } catch {
        order.refunded_amount_display = 'N/A';
      }
    } else {
      order.refunded_amount_display = '0.00';
    }

    if (order.order_items) {
      order.order_items.forEach(item => {
        if (item.price && typeof item.price !== 'string') {
          try {
            item.price_display = item.price.toFixed(2);
          } catch {
            item.price_display = 'N/A';
          }
        } else {
          item.price_display = item.price || '0.00';
        }
        if (item.total_price && typeof item.total_price !== 'string') {
          try {
            item.total_price_display = item.total_price.toFixed(2);
          } catch {
            item.total_price_display = 'N/A';
          }
        } else {
          item.total_price_display = item.total_price || '0.00';
        }
      });
    }

    // Render the details page
    res.render('order/order-details', {
      order,
      messages: req.flash(),
      currentActivePage: 'shop'
    });

  } catch (error) {
    console.error('Error fetching order details:', error);
    req.flash('error', 'An error occurred while loading order details.');
    res.redirect('/orders/recent');
  }
};




exports.downloadInvoice = async (req, res) => {
    try {
        const orderId = req.params.orderId; // Get orderId from route parameter

        if (!orderId) {
            return res.status(400).send('Order ID is required.');
        }

        const order = await Order.findById(orderId)
            .populate({
                path: 'order_items',
                populate: {
                    path: 'variant_id',
                    model: 'Variant',
                    populate: {
                        path: 'product_id',
                        model: 'Product',
                        select: 'name brand'
                    }
                }
            })
            .populate('user_id', 'name email phone')
            .populate('address_id')
            .lean();

        if (!order) {
            return res.status(404).send('Order not found');
        }

        if (!order.user_id) {
            console.error(`User ID ${order.user_id} could not be populated for Order ${order._id}`);
        }
        if (!order.address_id) {
            console.error(`Address ID ${order.address_id} could not be populated for Order ${order._id}`);
        }

        // --- PDF Generation ---
        const doc = new PDFDocument({ size: 'A4', margin: 50 });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=invoice_${order.order_number || orderId}.pdf`);
        doc.pipe(res);

        // -- GST Rate --
        const GST_RATE = 0.18; // 18% GST, adjust as needed

        // -- Header --
        doc.fontSize(18).font('Helvetica-Bold').text('Tax Invoice', { align: 'center' });
        doc.fontSize(14).font('Helvetica').text(`Order #${order.order_number || 'N/A'}`, { align: 'center' });
        doc.moveDown(2);

        // -- Order Info & Dates --
        const orderDate = order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'N/A';
        const deliveryDate = order.delivery_date ? new Date(order.delivery_date).toLocaleDateString() : 'N/A';
        doc.fontSize(10);
        doc.text(`Order Date: ${orderDate}`, { align: 'right' });
        doc.text(`Expected Delivery: ${deliveryDate}`, { align: 'right' });
        doc.moveDown();

        // -- Seller Info --
        doc.fontSize(10).font('Helvetica-Bold').text('Seller:', doc.page.margins.left);
        doc.font('Helvetica').text('Solo Fashion Pvt. Ltd.', doc.page.margins.left);
        doc.text('GSTIN: 12ABCDE1234F1Z5', doc.page.margins.left); // Replace with actual GSTIN
        doc.moveDown();

        // -- Customer & Address Info --
        const customerInfoStartY = doc.y;
        const columnWidth = (doc.page.width - doc.page.margins.left - doc.page.margins.right - 20) / 2;

        // Bill To (Left Column)
        doc.font('Helvetica-Bold').text('Bill To:', doc.page.margins.left, customerInfoStartY);
        doc.moveDown(0.5);
        doc.font('Helvetica');
        if (order.user_id) {
            doc.text(order.user_id.name || '', { width: columnWidth });
            doc.text(order.user_id.email || '', { width: columnWidth });
            doc.text(order.user_id.phone || 'N/A', { width: columnWidth });
        } else {
            doc.text('Customer details unavailable.', { width: columnWidth });
        }
        const leftColumnEndY = doc.y;

        // Ship To (Right Column)
        doc.y = customerInfoStartY;
        doc.font('Helvetica-Bold').text('Ship To:', doc.page.margins.left + columnWidth + 20, customerInfoStartY);
        doc.moveDown(0.5);
        doc.font('Helvetica');
        if (order.address_id) {
            const addressParts = [
                order.address_id.apartment,
                order.address_id.building,
                order.address_id.street,
                `${order.address_id.city || ''}, ${order.address_id.state || ''} ${order.address_id.zip_code || ''}`.trim(),
                order.address_id.country
            ];
            addressParts.filter(part => part).forEach(part => {
                doc.text(part, doc.page.margins.left + columnWidth + 20, doc.y, { width: columnWidth });
            });
        } else {
            doc.text('Delivery address unavailable.', doc.page.margins.left + columnWidth + 20, doc.y, { width: columnWidth });
        }
        const rightColumnEndY = doc.y;

        doc.y = Math.max(leftColumnEndY, rightColumnEndY) + 20;

        // -- Items Table --
        const tableTop = doc.y + 10;
        const itemCol = doc.page.margins.left;
        const qtyCol = itemCol + 250;
        const priceCol = qtyCol + 50;
        const gstCol = priceCol + 70;
        const totalCol = gstCol + 50;
        const tableEndX = doc.page.width - doc.page.margins.right;

        // Header Row
        doc.font('Helvetica-Bold');
        doc.text('Item Description', itemCol, tableTop);
        doc.text('Qty', qtyCol, tableTop, { width: 40, align: 'right' });
        doc.text('Unit Price', priceCol, tableTop, { width: 60, align: 'right' });
        doc.text('GST', gstCol, tableTop, { width: 40, align: 'right' });
        doc.text('Total', totalCol, tableTop, { width: 70, align: 'right' });
        doc.moveTo(itemCol, doc.y + 5).lineTo(tableEndX, doc.y + 5).lineWidth(0.5).stroke();
        doc.moveDown(0.5);

        // Item Rows
        doc.font('Helvetica');
        let itemsY = doc.y;
        let totalGST = 0; // Track total GST
        if (order.order_items && order.order_items.length > 0) {
            order.order_items.forEach((item) => {
                const productName = item.variant_id?.product_id?.name || 'Unknown Product';
                const brand = item.variant_id?.product_id?.brand || '';
                const name = `${productName}${brand ? ` (${brand})` : ''}`;
                const qty = item.quantity || 0;
                const price = item.price_display ? parseFloat(item.price_display) : (item.price || 0); // GST-inclusive
                const total = item.total_price_display ? parseFloat(item.total_price_display) : (item.total_price || 0); // GST-inclusive

                // Calculate GST from price (inclusive)
                const basePrice = price / (1 + GST_RATE); // Price excluding GST
                const gstAmount = price - basePrice; // GST per unit
                const totalBase = basePrice * qty;
                totalGST += gstAmount * qty; // Accumulate GST

                const initialY = itemsY;
                doc.text(name, itemCol, itemsY, { width: 240 });
                const nameHeight = doc.heightOfString(name, { width: 240 });

                doc.text(qty.toString(), qtyCol, initialY, { width: 40, align: 'right' });
                doc.text(`INR ${price.toFixed(2)}`, priceCol, initialY, { width: 60, align: 'right' });
                doc.text(`${(GST_RATE * 100).toFixed(0)}%`, gstCol, initialY, { width: 40, align: 'right' });
                doc.text(`INR ${total.toFixed(2)}`, totalCol, initialY, { width: 70, align: 'right' });

                itemsY += Math.max(nameHeight, 15) + 5;
            });
        } else {
            doc.text('No items found in this order.', itemCol, itemsY);
            itemsY += 20;
        }
        doc.y = itemsY;
        doc.moveTo(itemCol, doc.y).lineTo(tableEndX, doc.y).lineWidth(0.5).stroke();
        doc.moveDown();

        // -- Totals --
        const totalsX = tableEndX - 150;
        const totalAmount = order.total_amount_display ? parseFloat(order.total_amount_display) : (order.total_amount ? parseFloat(order.total_amount.toString()) : 0);
        const deliveryCharge = order.delivery_charge || 0;
        const subtotal = totalAmount - deliveryCharge - totalGST; // Base amount excluding GST and delivery

        doc.text(`Subtotal (Excl. GST):`, totalsX, doc.y, { width: 70, align: 'left' });
        doc.text(`INR ${subtotal.toFixed(2)}`, totalsX + 70, doc.y, { width: 80, align: 'right' });
        doc.moveDown(0.5);

        doc.text(`GST (${(GST_RATE * 100).toFixed(0)}%):`, totalsX, doc.y, { width: 70, align: 'left' });
        doc.text(`INR ${totalGST.toFixed(2)}`, totalsX + 70, doc.y, { width: 80, align: 'right' });
        doc.moveDown(0.5);

        doc.text(`Delivery Charge:`, totalsX, doc.y, { width: 70, align: 'left' });
        doc.text(`INR ${deliveryCharge.toFixed(2)}`, totalsX + 70, doc.y, { width: 80, align: 'right' });
        doc.moveDown(0.5);

        doc.font('Helvetica-Bold');
        doc.text(`Total Amount (Incl. GST):`, totalsX, doc.y, { width: 70, align: 'left' });
        doc.text(`INR ${totalAmount.toFixed(2)}`, totalsX + 70, doc.y, { width: 80, align: 'right' });
        doc.font('Helvetica');
        doc.moveDown(1);

        // -- GST Note --
        doc.fontSize(8).text('Note: All prices are inclusive of applicable GST.', totalsX, doc.y, { align: 'left' });
        doc.moveDown(2);

        // -- Footer --
        doc.fontSize(8).text('Thank you for shopping with Solo Fashion!', { align: 'center' });

        // -- Finalize PDF --
        doc.end();

    } catch (err) {
        console.error('Error generating invoice:', err);
        if (!res.headersSent) {
            res.status(500).send('Server error generating invoice');
        }
    }
};


exports.returnOrder = async (req, res) => {
    const orderId = req.params.orderId;
    const userId = req.session.user_id;
    const { return_reason } = req.body; // Get optional return reason from form
    
    try {
      const order = await Order.findOne({ _id: orderId, user_id: userId }).select('status delivery_date return_deadline updatedAt');
  
      if (!order) {
        req.flash('error', 'Order not found or access denied.');
        return res.redirect('/orders/recent');
      }
  
      if (order.status !== 'delivered') {
        req.flash('error', 'Only delivered orders can be returned.');
        return res.redirect(`/orders/details/${orderId}`);
      }
      
      const currentDate = new Date();
      
      // Check if return_deadline exists and is valid
      if (!order.return_deadline) {
        req.flash('error', 'Return deadline is not set for this order.');
        return res.redirect(`/orders/details/${orderId}`);
      }
      
      // Compare current date with return_deadline
      if (currentDate > order.return_deadline) {
        req.flash('error', 'Return period (7 days from delivery) has expired or is invalid.');
        console.warn(`User attempted to return order ${orderId} after the deadline: ${order.return_deadline}`);
        return res.redirect(`/orders/details/${orderId}`);
      }
     
      // Update order with return status and reason
      await Order.findByIdAndUpdate(orderId, {
        status: 'return_requested',
        updatedAt: new Date(),
        cancellation_reason: return_reason || 'Return requested by user', // Reuse cancellation_reason field
      });
  
      req.flash('success', 'Return request submitted successfully.');
      res.redirect('/orders/recent');
    } catch (error) {
      console.error('Error requesting return:', error);
      req.flash('error', 'Failed to request return: ' + error.message);
      res.redirect(`/orders/details/${orderId}`);
    }
  };

  exports.submitReview = async (req, res) => {
    try {
      const userId = req.session.user_id;
      if (!userId) {
        req.flash('error', 'You must be logged in to submit a review.');
        return res.redirect(req.get('Referrer') || '/orders/recent');
      }
  
      const { product_id, order_id, order_item_id, title, rating, comment } = req.body;
  
      // Validate input
      if (!product_id || !order_id || !order_item_id || !title || !rating) {
        req.flash('error', 'All required fields must be filled.');
        return res.redirect(req.get('Referrer') || '/orders/recent');
      }
  
      // Validate rating
      const parsedRating = parseInt(rating);
      if (isNaN(parsedRating) || parsedRating < 1 || parsedRating > 5) {
        req.flash('error', 'Rating must be between 1 and 5.');
        return res.redirect(req.get('Referrer') || '/orders/recent');
      }
  
      // Check if the order exists and is delivered
      const order = await Order.findOne({
        _id: order_id,
        user_id: userId,
        status: 'delivered'
      })
        .populate({
          path: 'order_items',
          populate: {
            path: 'variant_id',
            model: 'Variant',
            populate: {
              path: 'product_id',
              model: 'Product'
            }
          }
        })
        .lean();
  
      if (!order) {
        req.flash('error', 'Order not found or not eligible for review.');
        return res.redirect(req.get('Referrer') || '/orders/recent');
      }
  
      // Check if the order item exists in the order
      const orderItem = order.order_items.find(item => item._id.toString() === order_item_id);
      if (!orderItem) {
        req.flash('error', 'Order item not found.');
        return res.redirect(req.get('Referrer') || '/orders/recent');
      }
  
      // Check if variant_id and product_id are present
      if (!orderItem.variant_id || !orderItem.variant_id.product_id) {
        req.flash('error', 'Invalid product data for this order item.');
        return res.redirect(req.get('Referrer') || '/orders/recent');
      }
  
      // Verify the product_id matches
      if (orderItem.variant_id.product_id._id.toString() !== product_id) {
        req.flash('error', 'Product does not match the order item.');
        return res.redirect(req.get('Referrer') || '/orders/recent');
      }
  
      // Check if a review already exists for this product by the user
      const existingReview = await Review.findOne({
        user_id: userId,
        product_id
      }).lean();
  
      if (existingReview) {
        req.flash('error', 'You have already reviewed this product.');
        return res.redirect(req.get('Referrer') || '/orders/recent');
      }
  
      // Create and save the new review
      const review = new Review({
        user_id: userId,
        product_id,
        title: title.trim(),
        rating: parsedRating,
        comment: comment ? comment.trim() : ''
      });
  
      await review.save();
  
      req.flash('success', 'Your review has been submitted successfully.');
      res.redirect(`/orders/details/${order_id}`);
  
    } catch (error) {
      console.error('Error submitting review:', error);
      req.flash('error', 'An error occurred while submitting your review.');
      res.redirect(req.get('Referrer') || '/orders/recent');
    }
  };