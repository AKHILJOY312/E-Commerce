const Cart = require('../../models/Cart');
const Address = require('../../models/Addresses');
const User = require('../../models/User');
const Variant = require('../../models/Variant');
const Product = require('../../models/Product');
const Order = require('../../models/Order');
const OrderItem = require('../../models/orderItems');
const mongoose = require('mongoose');
const PDFDocument = require('pdfkit');


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

        // Fetch all addresses for the user, not just the default one
        const addresses = await Address.find({ user_id: userId }).lean();
        const defaultAddress = addresses.find(addr => addr.is_default) || addresses[0] || null; // Fallback to first address if no default
        const user = await User.findById(userId);

        if (!cart || !cart.products) {
            return res.render('order/checkout', {
                cart: null,
                addresses: [],
                address: null,
                user,
                currentActivePage: "shop"
            });
        }

        const availableProducts = cart.products.filter(item => 
            item.variant_id && item.variant_id.quantity > 0 && 
            item.quantity <= item.variant_id.quantity
        );

        let subtotal = availableProducts.reduce((sum, item) => 
            sum + (item.variant_id.sale_price * item.quantity), 0);
        const shippingCost = subtotal > 1000 ? 0 : 50;
        const total = subtotal + shippingCost;

        res.render('order/checkout', {
            cart: {
                products: availableProducts,
                subtotal,
                shippingCost,
                total
            },
            addresses, // Pass all addresses
            address: defaultAddress, // Initially selected address
            user,
            currentActivePage: "shop"
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
};

exports.placeOrder = async (req, res) => {
    try {
        const userId = req.session.user_id;
        const { payment_method, addressId } = req.body;

        if (!payment_method) {
            req.flash('error', 'Please select a payment method');
            return res.redirect('/checkout');
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

        // Check if the selected address exists for the user
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

        const subtotal = availableProducts.reduce((sum, item) => 
            sum + (item.variant_id.sale_price * item.quantity), 0);
        const deliveryCharge = subtotal > 1000 ? 0 : 50;
        const total = subtotal + deliveryCharge;

        const deliveryDate = new Date();
        deliveryDate.setDate(deliveryDate.getDate() + 7);

        // Create order with selected address
        const order = new Order({
            user_id: userId,
            payment_id: new mongoose.Types.ObjectId(),
            delivery_charge: deliveryCharge,
            delivery_date: deliveryDate,
            amount: subtotal,
            total_amount: total.toString(),
            status: 'confirmed',
            address_id: addressId // Add address_id to order schema if needed
        });

        await order.save();

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
                order_id: order._id,
                quantity: item.quantity,
                price: item.variant_id.sale_price,
                total_price: item.variant_id.sale_price * item.quantity
            });
            await orderItem.save();

            return orderItem._id;
        }));

        order.order_items = orderItems;
        await order.save();

        await Cart.findOneAndDelete({ user_id: userId });

        req.flash('success', `Order ${order.order_number} placed successfully!`);
        res.redirect('/orders/recent');
    } catch (error) {
        console.error('Error placing order:', error);
        if (order && order._id) {
            await Order.deleteOne({ _id: order._id });
            await OrderItem.deleteMany({ order_id: order._id });
        }
        req.flash('error', 'Failed to place order. Please try again.');
        res.redirect('/checkout');
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
            .sort({ created_at: -1 })
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
                search
            }
        });
    } catch (error) {
        console.error(error);
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
    const orderId = req.params.orderId; // Top scope for rollback
    const userId = req.session.user_id;

    try {
        // Fetch the order
        const order = await Order.findOne({ _id: orderId, user_id: userId })
            .populate({
                path: 'order_items',
                populate: { path: 'product_id', model: 'products' }
            });
        if (!order || order.status !== 'confirmed') {
            req.flash('error', 'Order cannot be cancelled');
            return res.redirect('/orders/recent');
        }

        // Fetch order items
        const orderItems = await OrderItem.find({ order_id: orderId });
        if (!orderItems || orderItems.length === 0) {
            req.flash('error', 'No items found for this order');
            return res.redirect('/orders/recent');
        }

        // Update order status
        order.status = 'cancelled';
        order.cancelled_at = new Date();
        order.cancellation_reason = 'Cancelled by user';
        await order.save();

        // Update order items and increment stock
        await Promise.all(orderItems.map(async (item) => {
            // Debug: Log product_id to verify its type
            console.log(`OrderItem ${item._id} - product_id: ${item.product_id}`);

            // Fetch product and its variants
            const product = await Product.findById(item.product_id).populate('variants');
            if (!product || !product.variants || product.variants.length === 0) {
                console.error(`No variants found for product ${item.product_id}`);
                throw new Error(`No variants found for product ${item.product_id}`);
            }

            // Find the variant (match by price or size; adjust as needed)
            const variant = product.variants.find(v => 
                v.price === item.price && v.isDeleted === false
            );
            if (!variant) {
                console.error(`No active variant found for product ${item.product_id} with price ${item.price}`);
                throw new Error(`Active variant not found for product ${item.product_id}`);
            }

            // Debug: Log variant ID and quantity
            console.log(`Found variant ${variant._id} - current quantity: ${variant.quantity}`);

            // Increment stock for the variant
            const updatedVariant = await Variant.findOneAndUpdate(
                { _id: variant._id, isDeleted: false },
                { $inc: { quantity: item.quantity } },
                { new: true }
            );

            if (!updatedVariant) {
                throw new Error(`Failed to update stock for variant ${variant._id}`);
            }

            console.log(`Updated variant ${variant._id} - new quantity: ${updatedVariant.quantity}`);

            // Update order item status
            await OrderItem.updateOne(
                { _id: item._id },
                { status: 'cancelled', updated_at: new Date() }
            );
        }));

        req.flash('success', 'Order cancelled successfully! Stock updated.');
        res.redirect('/orders/recent');
    } catch (error) {
        console.error('Error cancelling order:', error);

        // Rollback: Revert order status if stock update fails
        try {
            const rollbackOrder = await Order.findById(orderId);
            if (rollbackOrder && rollbackOrder.status === 'cancelled') {
                rollbackOrder.status = 'confirmed';
                rollbackOrder.cancelled_at = null;
                rollbackOrder.cancellation_reason = null;
                await rollbackOrder.save();
                console.log(`Order ${orderId} status reverted to confirmed`);
            }
        } catch (rollbackError) {
            console.error('Rollback failed:', rollbackError);
        }

        req.flash('error', 'Failed to cancel order. Please try again.');
        res.redirect('/orders/recent');
    }
};

exports.getOrderDetails = async (req, res) => {
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

        if (!order) {
            req.flash('error', 'Order not found');
            return res.redirect('/orders/recent');
        }

        res.render('order/order-details', {
            order,
            currentActivePage: "shop"
        });
    } catch (error) {
        console.error(error);
        req.flash('error', 'Failed to load order details');
        res.redirect('/orders/recent');
    }
};


exports.downloadInvoice = async (req, res) => {
    try {
      const order = await Order.findById(req.params.orderId)
        .populate({
          path: 'order_items',
          populate: {
            path: 'product_id',
            model: 'Product'
          }
        });
  
      if (!order) return res.status(404).send('Order not found');
  
      const doc = new PDFDocument();
  
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=invoice_${order.order_number}.pdf`);
      doc.pipe(res);
  
      // Header
      doc.fontSize(20).text(`Invoice - Order #${order.order_number}`, { align: 'center' });
      doc.moveDown();
  
      doc.fontSize(12).text(`Order Date: ${new Date(order.createdAt).toLocaleDateString()}`);
      doc.text(`Delivery Date: ${new Date(order.delivery_date).toLocaleDateString()}`);
      doc.moveDown();
  
      doc.text('Items:');
      order.order_items.forEach((item, index) => {
        const name = item.product_id?.name || 'Unknown Product';
        const qty = item.quantity || 0;
        const price = item.price || 0;
        const total = item.total_price || 0;
  
        doc.text(`${index + 1}. ${name} - ${qty} x INR ${price.toFixed(2)} = INR ${total.toFixed(2)}`);
      });
  
      doc.moveDown();
      const totalAmount = parseFloat(order.total_amount.toString());
      const deliveryCharge = parseFloat(order.delivery_charge?.toString() || '0');
      const amount = parseFloat(order.amount.toString());
  
      doc.text(`Subtotal: INR ${amount.toFixed(2)}`);
      doc.text(`Delivery Charge: INR ${deliveryCharge.toFixed(2)}`);
      doc.text(`Total: INR ${totalAmount.toFixed(2)}`);
  
      doc.end();
    } catch (err) {
      console.error('Error generating invoice:', err);
      res.status(500).send('Server error');
    }
  };