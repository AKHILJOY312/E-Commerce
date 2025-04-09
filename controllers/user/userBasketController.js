const Product = require('../../models/Product');
const Variant = require('../../models/Variant');
const Cart = require("../../models/Cart");
const Wishlist =require('../../models/Wishlist');
const Coupon = require('../../models/Coupon'); 
const mongoose = require('mongoose');

const CouponUsage = require('../../models/CouponUsage'); // import at top




exports.getCart = async (req, res) => {
  try {
    const userId = req.session.user_id;
    if (!userId) {
      return res.render('basket/cart', { cart: null, currentActivePage: "shop",cartId:null,relatedProducts:null });
    }

    // Fetch cart from MongoDB
    const cart = await Cart.findOne({ user_id: userId });
    if (!cart || cart.products.length === 0) {
      return res.render('basket/cart', { cart: null, currentActivePage: "shop",cartId:null,relatedProducts:null });
    }

    // Populate product and variant details
    const populatedItems = await Promise.all(cart.products.map(async (item) => {
      const variant = item.variant_id 
        ? await Variant.findById(item.variant_id).lean() 
        : await Variant.findById(item.product_id).lean(); // fallback if variant_id is missing

      if (!variant) return null;

      const product = await Product.findById(variant.product_id).lean();
      if (!product) return null;

      return {
        product,
        variant,
        quantity: item.quantity
      };
    }));

    // Filter out null entries (invalid products/variants)
    const validItems = populatedItems.filter(item => item !== null);

    // Calculate totals
    const subtotal = validItems.reduce((sum, item) => {
      return sum + (item.variant.sale_price * item.quantity);
    }, 0);
    let relatedProducts = [];

    if (validItems.length > 0) {
      const currentProduct = validItems[0].product;
      relatedProducts = await Product.find({
        _id: { $ne: currentProduct._id },
        category_id: currentProduct.category_id,
        isDeleted: false,
        status: 'listed',
      })
        .populate('variants')
        .limit(4);
    }
    const cartData = {
      items: validItems,
      subtotal,
      total: subtotal, // Add discount logic if needed later
    };

    res.render('basket/cart', {
      cart: cartData,
      currentActivePage: "shop",
      cartId: cart._id,
      relatedProducts
    });
  } catch (error) {
    console.error('Error fetching cart:', error);
    res.render('basket/cart', { cart: null, currentActivePage: "shop" });
  }
};




exports.addToCart = async (req, res) => {
  try {
    const userId = req.session.user_id;
    const { variantId, quantity = 1 } = req.body;

    console.log('📥 Incoming add-to-cart request:', req.body);


    if (!variantId || !mongoose.Types.ObjectId.isValid(variantId)) {
      return res.status(400).json({ success: false, message: 'Invalid variant ID' });
    }
    if (isNaN(quantity) || quantity < 1) {
      return res.status(400).json({ success: false, message: 'Invalid quantity' });
    }

    const variant = await Variant.findById(variantId).lean();
    if (!variant || variant.quantity < quantity) {
      return res.status(400).json({ success: false, message: 'Item not available or out of stock' });
    }

    const productId = variant.product_id?.toString();
    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, message: 'Invalid product associated with variant' });
    }

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
      // Filter out invalid products (e.g., missing variant_id) before proceeding
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

    console.log('🧺 Final cart before save:', cart);
    await cart.save();
    res.json({ success: true, message: 'Added to cart successfully', cart });
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
      
      const updatedProducts = [];
  
      for (const item of items) {
        if (!item.variantId || !item.quantity || item.quantity < 1) continue;
  
        const variant = await Variant.findById(item.variantId).lean();
        if (!variant || variant.quantity <= 0) continue;
  
        const validQty = Math.min(parseInt(item.quantity), variant.quantity);
  
        updatedProducts.push({
          product_id: item.variantId, // In your Cart schema, this points to Variant
          quantity: validQty,
        });
      }
      
      if (updatedProducts.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No valid items to update in cart.',
        });
      }
      
      // Find and update OR create a cart for the user
      const updatedCart = await Cart.findOneAndUpdate(
        { user_id: userId },
        { products: updatedProducts },
        { new: true, upsert: true }
      );
  
      res.json({ success: true, cart: updatedCart });
  
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
  


  exports.applyCoupon = async (req, res) => {
    try {
      const { coupon, cartId } = req.body;
      console.log('🚀 Incoming request body:', req.body);
  
      // 1. Get the cart
      const cart = await Cart.findById(cartId)
        .populate('products.variant_id')
        .populate('products.product_id');
  
      console.log('🛒 Retrieved Cart:', cart);
  
      if (!cart || !cart.products || cart.products.length === 0) {
        console.log('❌ Cart not found or empty');
        return res.status(400).json({ success: false, message: 'Cart not found or empty' });
      }
  
      // 2. Calculate subtotal
      let subtotal = 0;
      cart.products.forEach(item => {
        const variant = item.variant_id;
        if (variant && variant.sale_price) {
          subtotal += variant.sale_price * item.quantity;
        }
      });
  
      console.log('💰 Calculated Subtotal:', subtotal);
  
      if (subtotal === 0) {
        return res.status(400).json({ success: false, message: 'Invalid cart subtotal' });
      }
  
      // 3. Validate the coupon
      const now = new Date();
      const foundCoupon = await Coupon.findOne({
        code: coupon,
        is_deleted: false,
        status: true,
        start_date: { $lte: now },
        end_date: { $gte: now }
      });
  
      console.log('🎟️ Found Coupon:', foundCoupon);
  
      if (!foundCoupon) {
        return res.json({ success: false, message: 'Invalid or expired coupon code' });
      }
  
      if (subtotal < foundCoupon.min_order_value) {
        return res.json({
          success: false,
          message: `Minimum order value should be ₹${foundCoupon.min_order_value}`
        });
      }
  
      if (foundCoupon.usage_limit > 0 && foundCoupon.used_count >= foundCoupon.usage_limit) {
        return res.json({ success: false, message: 'This coupon has reached its usage limit' });
      }
  
      // 4. Check user usage
      const userId = req.session.user_id;
      console.log('👤 User ID from session:', userId);
  
      if (userId && foundCoupon.limit_per_user > 0) {
        const alreadyUsed = await CouponUsage.findOne({
          user_id: userId,
          coupon_id: foundCoupon._id
        });
  
        if (alreadyUsed) {
          return res.json({ success: false, message: 'You have already used this coupon' });
        }
      }
  
      // 5. Calculate discount
      let discount = 0;
      if (foundCoupon.discount_type === 'percentage') {
        discount = (subtotal * foundCoupon.discount_value) / 100;
      } else {
        discount = foundCoupon.discount_value;
      }
  
      console.log('✅ Calculated Discount:', discount);
  
      const total = subtotal - discount;
  
      // 6. Save applied coupon to cart
      cart.coupon = {
        code: foundCoupon.code,
        discount: discount
      };
      cart.total = total;
      console.log('✅ total:', total);
      await cart.save();
  
      // 7. Track coupon usage
      if (userId && foundCoupon.limit_per_user > 0) {
        await CouponUsage.create({
          user_id: userId,
          coupon_id: foundCoupon._id
        });
      }
  
      // 8. Update global coupon used count
      foundCoupon.used_count += 1;
      await foundCoupon.save();
  
      // 9. Send response with updated cart
      res.json({
        success: true,
        data: {
          subtotal,
          discount,
          total,
          couponApplied: cart.coupon,
          updatedCart: cart
        }
      });
  
    } catch (error) {
      console.error('❌ Error applying coupon:', error);
      res.status(500).json({ success: false, message: 'Failed to apply coupon' });
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

