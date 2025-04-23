const Product = require('../../models/Product');
const Variant = require('../../models/Variant');
const Cart = require("../../models/Cart");
const Wishlist =require('../../models/Wishlist');
const Coupon = require('../../models/Coupon'); 
const mongoose = require('mongoose');

const CouponUsage = require('../../models/CouponUsage'); // import at top


exports.addToCart = async (req, res) => {
  try {
    const userId = req.session.user_id;
    const { variantId, quantity = 1 } = req.body;

    if (!userId) {
      return res.json({ success: false, message: 'Please log in to add items to cart' });
    }

    if (!variantId || !mongoose.Types.ObjectId.isValid(variantId)) {
      return resizeTo.json({ success: false, message: 'Invalid variant ID' });
    }
    if (isNaN(quantity) || quantity < 1 || quantity > 5) {
      return res.json({ success: false, message: 'Invalid quantity' });
    }

    const variant = await Variant.findById(variantId).lean();
    if (!variant) {
      return res.json({ success: false, message: 'Item not available or out of stock' });
    }

   

    if (variant.quantity < parseInt(quantity)) {
      return res.json({ success: false, message: 'Not enough stock' });
    }

    const productId = variant.product_id?.toString();
    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.json({ success: false, message: 'Invalid product associated with variant' });
    }

    // Check and update cart
    let cart = await Cart.findOne({ user_id: userId });
    if (!cart) {
      cart = new Cart({
        user_id: userId,
        products: [{
          product_id: productId,
          variant_id: variantId,
          quantity: parseInt(quantity)
        }]
      });
    } else {
      cart.products = cart.products.filter(p => 
        p.variant_id && mongoose.Types.ObjectId.isValid(p.variant_id)
      );

      const existingProduct = cart.products.find(
        p => p.variant_id && p.variant_id.toString() === variantId
      );

      if (existingProduct) {
        existingProduct.quantity += parseInt(quantity);
      } else {
        cart.products.push({
          product_id: productId,
          variant_id: variantId,
          quantity: parseInt(quantity)
        });
      }
    }

    // Remove from wishlist if it exists
    const wishlist = await Wishlist.findOne({ user_id: userId });
    if (wishlist) {
      const wishlistItemIndex = wishlist.items.findIndex(item =>
        item.variant_id.toString() === variantId &&
        item.product_id.toString() === productId
      );

      if (wishlistItemIndex !== -1) {
        wishlist.items.splice(wishlistItemIndex, 1); // Remove the item
        if (wishlist.items.length === 0) {
          await Wishlist.deleteOne({ user_id: userId }); // Delete wishlist if empty
        } else {
          await wishlist.save(); // Save updated wishlist
        }
       
      }
    }

    // Save the cart
    await cart.save();
    res.json({ success: true, message: 'Added to cart successfully and removed from wishlist if present', cart,variantId });
  } catch (error) {
    console.error('Error adding to cart:', error);
    res.status(500).json({ success: false, message: 'Failed to add to cart' });
  }
};


  

exports.updateCart = async (req, res) => {
  try {
    const userId = req.session.user_id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    const { items } = req.body;

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ success: false, message: 'Invalid items format' });
    }

    let cart = await Cart.findOne({ user_id: userId });
    if (!cart) {
      cart = new Cart({ user_id: userId, products: [] });
    }

    // Filter out invalid products in cart
    cart.products = cart.products.filter(p => 
      p.variant_id && mongoose.Types.ObjectId.isValid(p.variant_id)
    );

    const maxCartQty = 5; // Max quantity limit

    for (const item of items) {
      if (!item.variantId || !mongoose.Types.ObjectId.isValid(item.variantId) || 
          isNaN(item.quantity) || item.quantity < 1) {
        continue; // Skip invalid items
      }

      const variant = await Variant.findById(item.variantId).lean();
      if (!variant || variant.quantity <= 0) {
        continue; // Skip unavailable or out-of-stock items
      }

      const productId = variant.product_id?.toString();
      if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
        continue; // Skip if no valid product ID
      }

      const requestedQty = parseInt(item.quantity);
      const existingProduct = cart.products.find(
        p => p.variant_id && p.variant_id.toString() === item.variantId
      );

      if (existingProduct) {
        // Update existing item, cap at 5 or stock
        const newQty = requestedQty; // Replace quantity, not increment
        const cappedQty = Math.min(newQty, maxCartQty, variant.quantity);
        if (cappedQty > variant.quantity) {
          return res.status(400).json({ 
            success: false, 
            message: `Not enough stock for variant ${item.variantId}` 
          });
        }
        existingProduct.quantity = cappedQty;
      } else {
        // Add new item, cap at 5 or stock
        const cappedQty = Math.min(requestedQty, maxCartQty, variant.quantity);
        cart.products.push({
          product_id: productId, // Correct product ID
          variant_id: item.variantId,
          quantity: cappedQty
        });
      }
    }

    if (cart.products.length === 0) {
      await Cart.deleteOne({ user_id: userId });
      return res.json({ success: true, message: 'Cart cleared as no valid items remain', cart: null });
    }

    await cart.save();
    res.json({ success: true, message: 'Cart updated successfully', cart });

  } catch (error) {
    console.error('Error updating cart:', error);
    res.status(500).json({ success: false, message: 'Failed to update cart' });
  }
};

  exports.removeFromCart = async (req, res) => {
    try {
      const userId = req.session.user_id;
      const { variantId } = req.body;
  
      if (!variantId) {
        return res.status(400).json({ success: false, message: 'Variant ID is required' });
      }
  
      let cart = await Cart.findOne({ user_id: userId });
  
      if (!cart) {
        return res.status(404).json({ success: false, message: 'Cart not found' });
      }
  
      // Remove item with the given variantId
      cart.products = cart.products.filter(item => item.variant_id && item.variant_id.toString() !== variantId);
  
      await cart.save();
  
      const populatedItems = await Promise.all(cart.products.map(async (item) => {
        const variant = await Variant.findById(item.variant_id).lean();
        const product = await Product.findById(item.product_id).lean();
        return {
          product,
          variant,
          quantity: item.quantity
        };
      }));
  
      const subtotal = populatedItems.reduce((sum, item) => sum + item.variant.sale_price * item.quantity, 0);
  
      res.json({
        success: true,
        cart: {
          items: populatedItems,
          subtotal,
          total: subtotal
        }
      });
    } catch (error) {
      console.error('Error removing from cart:', error);
      res.status(500).json({ success: false, message: 'Failed to remove item from cart' });
    }
  };
  


  // 1. First, let's update the controller to add a removeCoupon function
  exports.removeCoupon = async (req, res) => {
    try {
      // Remove coupon from session
      delete req.session.appliedCoupon;
      
      return res.status(200).json({ 
        success: true, 
        message: 'Coupon removed successfully!' 
      });
    } catch (error) {
      console.error('Error removing coupon:', error);
      return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
    }
  };

// 3. Update the applyCoupon function to use the helper
exports.applyCoupon = async (req, res) => {
  try {
    const userId = req.session.user_id;
    const { coupon_code } = req.body;

    if (!coupon_code) {
      return res.status(400).json({ success: false, message: 'Coupon code is required' });
    }

    // Find the coupon in the database
    const coupon = await Coupon.findOne({ 
      code: coupon_code,
      status: true,
      is_deleted: false,
      start_date: { $lte: new Date() },
      end_date: { $gte: new Date() }
    });

    if (!coupon) {
      return res.status(400).json({ success: false, message: 'Invalid or expired coupon' });
    }

    // Check if usage limit has been reached
    if (coupon.used_count >= coupon.usage_limit) {
      return res.status(400).json({ success: false, message: 'Coupon usage limit reached' });
    }

    // Check if user has already used this coupon to the max limit
    const userCouponUsage = await CouponUsage.countDocuments({
      user_id: userId,
      coupon_id: coupon._id
    });

    if (userCouponUsage >= coupon.limit_per_user) {
      return res.status(400).json({ 
        success: false, 
        message: 'You have already used this coupon the maximum number of times' 
      });
    }

    // Get the cart to check the minimum order value
    const cart = await Cart.findOne({ user_id: userId })
      .populate({
        path: 'products.product_id',
        model: 'Product'
      })
      .populate({
        path: 'products.variant_id',
        model: 'Variant'
      });

    if (!cart || !cart.products || cart.products.length === 0) {
      return res.status(400).json({ success: false, message: 'Your cart is empty' });
    }

    // Calculate subtotal
    const availableProducts = cart.products.filter(item =>
      item.variant_id && item.variant_id.quantity > 0 &&
      item.quantity <= item.variant_id.quantity
    );

    const subtotal = availableProducts.reduce((sum, item) =>
      sum + (item.variant_id.sale_price * item.quantity), 0);

    // Check if minimum order value is met
    if (subtotal < coupon.min_order_value) {
      return res.status(400).json({ 
        success: false, 
        message: `Minimum order value of ₹${coupon.min_order_value} required for this coupon` 
      });
    }

    // Check if coupon is applicable to products in cart (if specific products are set)
    if (coupon.applicable_products && coupon.applicable_products.length > 0) {
      const productIds = availableProducts.map(item => item.product_id._id.toString());
      const validProducts = productIds.some(id => 
        coupon.applicable_products.includes(id)
      );

      if (!validProducts) {
        return res.status(400).json({ 
          success: false, 
          message: 'This coupon is not applicable to the products in your cart' 
        });
      }
    }

    // Check if coupon is applicable to categories in cart (if specific categories are set)
    if (coupon.applicable_categories && coupon.applicable_categories.length > 0) {
      const productCategories = availableProducts.map(item => 
        item.product_id.category ? item.product_id.category.toString() : null
      ).filter(cat => cat !== null);

      const validCategories = productCategories.some(cat => 
        coupon.applicable_categories.includes(cat)
      );

      if (!validCategories) {
        return res.status(400).json({ 
          success: false, 
          message: 'This coupon is not applicable to the product categories in your cart' 
        });
      }
    }

    // Store the coupon in the session
    req.session.appliedCoupon = {
      couponId: coupon._id,
      code: coupon.code,
      discountType: coupon.discount_type,
      discountValue: coupon.discount_value
    };

    // Calculate discount amount for response
    let discountAmount = 0;
    if (coupon.discount_type === 'percentage') {
      discountAmount = (subtotal * coupon.discount_value / 100);
    } else {
      discountAmount = coupon.discount_value;
    }
    discountAmount = Math.min(discountAmount, subtotal);

    return res.status(200).json({ 
      success: true, 
      message: 'Coupon applied successfully!',
      discount: discountAmount,
      total: subtotal - discountAmount + (subtotal > 1000 ? 0 : 50)
    });
  } catch (error) {
    console.error('Error applying coupon:', error);
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
};

// 4. Update the getCart function to include coupon data in the cart view
exports.getCart = async (req, res) => {
  try {
    const userId = req.session.user_id;
    if (!userId) {
      return res.render('basket/cart', {
        cart: null,
        currentActivePage: "shop",
        cartId: null,
        relatedProducts: null,
        message: "Please log in to view your cart"
      });
    }
    // Fetch cart from MongoDB
    const cart = await Cart.findOne({ user_id: userId });
    if (!cart || cart.products.length === 0) {
      return res.render('basket/cart', {
        cart: null,
        currentActivePage: "shop",
        cartId: null,
        relatedProducts: null,
        message: "Your cart is empty"
      });
    }
   
    // Populate product and variant details
    const populatedItems = await Promise.all(cart.products.map(async (item) => {
      const variant = await Variant.findById(item.variant_id).lean();
     
      if (!variant) {
        return null;
      }
      // Check stock using variant.quantity
      if (variant.quantity <= 0) {
        return null;
      }
      const product = await Product.findById(variant.product_id).lean();
      if (!product) {
        return null;
      }
      // Parse and validate cart quantity
      const cartQuantity = parseInt(item.quantity, 10);
      if (isNaN(cartQuantity) || cartQuantity <= 0) {
        return null;
      }
      return {
        product,
        variant,
        quantity: Math.min(cartQuantity, variant.quantity) // Cap to available stock
      };
    }));
    
    // Filter out null entries
    const validItems = populatedItems.filter(item => item !== null);
    
    // Update cart in DB if any items were removed
    if (validItems.length !== cart.products.length) {
      cart.products = validItems.map(item => ({
        product_id: item.product._id,
        variant_id: item.variant._id,
        quantity: item.quantity
      }));
      try {
        await cart.save();
        req.flash('info', 'Some items were removed from your cart as they are out of stock or had invalid quantities.');
      } catch (saveError) {
        console.error('Error saving cart:', saveError);
        req.flash('error', 'Failed to update cart due to a server error.');
      }
    }
    
    // Calculate totals
    const subtotal = validItems.reduce((sum, item) => {
      const itemTotal = item.variant.sale_price * item.quantity;
      return sum + (isNaN(itemTotal) ? 0 : itemTotal);
    }, 0);
    
    // Get discount if coupon is applied
    let discount = 0;
    let couponApplied = null;
    
    if (cart.coupon && typeof cart.coupon === 'object' && cart.coupon.code) {
      couponApplied = {
        code: cart.coupon.code,
        discount: parseFloat(cart.coupon.discount) || 0
      };
      discount = couponApplied.discount;
    }
    
    // Calculate total (subtotal - discount)
    const total = subtotal - discount;
    
    // Fetch related products
    let relatedProducts = [];
    if (validItems.length > 0) {
      const currentProduct = validItems[0].product;
      relatedProducts = await Product.find({
        _id: { $ne: currentProduct._id },
        category_id: currentProduct.category_id,
        isDeleted: false,
        status: 'listed',
      })
        .populate({
          path: 'variants',
          match: { quantity: { $gt: 0 } }
        })
        .lean()
        .limit(4);
      relatedProducts = relatedProducts.filter(product =>
        product.variants && product.variants.length > 0
      );
    }
    
    const cartData = {
      items: validItems,
      subtotal: isNaN(subtotal) ? 0 : subtotal,
      total: isNaN(total) ? 0 : total,
      coupon_applied: couponApplied
    };
    
    res.render('basket/cart', {
      cart: cartData,
      currentActivePage: "shop",
      cartId: cart._id,
      relatedProducts,
      message: req.flash('info') || req.flash('error') || null
    });
  } catch (error) {
    console.error('Error fetching cart:', error);
    res.render('basket/cart', {
      cart: null,
      currentActivePage: "shop",
      cartId: null,
      relatedProducts: null,
      message: "An error occurred while loading your cart"
    });
  }
};








//whish list

exports.getWishlist = async (req, res) => {
  try {
    const userId = req.session.user_id;

    const wishlist = await Wishlist.findOne({ user_id: userId }).lean();

    if (!wishlist || wishlist.items.length === 0) {
      return res.render('basket/wishlist', { wishlist: null ,currentActivePage:"shop" });
    }

    // Populate product and variant details
    const populatedItems = await Promise.all(wishlist.items.map(async (item) => {
      const variant = await Variant.findById(item.variant_id).lean();
      const product = await Product.findById(item.product_id).lean();
      return { product, variant };
    }));

    res.render('basket/wishlist', { wishlist: { items: populatedItems } ,currentActivePage:"shop"});
  } catch (error) {
    console.error('Error fetching wishlist:', error);
    res.render('basket/wishlist', { wishlist: null ,currentActivePage:"shop"});
  }
};

exports.addToWishlist = async (req, res) => {
  try {
    const userId = req.session.user_id;
    const { variantId } = req.body;

    const variant = await Variant.findById(variantId).lean();
    if (!variant) {
      return res.status(400).json({ success: false, message: 'Variant not found' });
    }

    const productId = variant.product_id;

    let wishlist = await Wishlist.findOne({ user_id: userId });

    if (!wishlist) {
      wishlist = new Wishlist({
        user_id: userId,
        items: [{ product_id: productId, variant_id: variantId }]
      });
    } else {
      const alreadyExists = wishlist.items.some(item =>
        item.variant_id.toString() === variantId
      );

      if (!alreadyExists) {
        wishlist.items.push({ product_id: productId, variant_id: variantId });
      }
    }

    await wishlist.save();
    res.json({ success: true });
  } catch (error) {
    console.error('Error adding to wishlist:', error);
    res.status(500).json({ success: false, message: 'Failed to add to wishlist' });
  }
};

exports.removeFromWishlist = async (req, res) => {
  try {
    const userId = req.session.user_id;
    const { variantId } = req.body;

    const wishlist = await Wishlist.findOne({ user_id: userId });
    if (!wishlist) {
      return res.json({ success: false, message: 'Wishlist not found' });
    }

    wishlist.items = wishlist.items.filter(item => item.variant_id.toString() !== variantId);
    await wishlist.save();

    res.json({ success: true });
  } catch (error) {
    console.error('Error removing from wishlist:', error);
    res.status(500).json({ success: false, message: 'Failed to remove from wishlist' });
  }
};

