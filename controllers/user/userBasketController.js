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

    // Log raw cart data for debugging
    console.log('Raw cart products:', JSON.stringify(cart.products, null, 2));

    // Populate product and variant details, filter out invalid or out-of-stock items
    const populatedItems = await Promise.all(cart.products.map(async (item) => {
      const variant = await Variant.findById(item.variant_id).lean();
      
      if (!variant) {
        console.log(`Skipping variant ${item.variant_id} - not found`);
        return null;
      }

      // Check stock using variant.quantity
      if (variant.quantity <= 0) {
        console.log(`Skipping variant ${item.variant_id} - out of stock (quantity: ${variant.quantity})`);
        return null;
      }

      const product = await Product.findById(variant.product_id).lean();
      if (!product) {
        console.log(`Skipping product for variant ${item.variant_id} - not found`);
        return null;
      }

      // Parse and validate cart quantity
      const cartQuantity = parseInt(item.quantity, 10);
      if (isNaN(cartQuantity) || cartQuantity <= 0) {
        console.log(`Invalid cart quantity for variant ${item.variant_id}: ${item.quantity}`);
        return null;
      }

      console.log(`Processed item ${item.variant_id} - cart quantity: ${cartQuantity}, stock: ${variant.quantity}`);
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
        product_id: item.product._id,    // Include product_id
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

    // Calculate totals with detailed logging
    const subtotal = validItems.reduce((sum, item) => {
      const itemTotal = item.variant.sale_price * item.quantity;
      console.log(`Item ${item.variant._id} total: ${itemTotal} (price: ${item.variant.sale_price}, qty: ${item.quantity})`);
      return sum + (isNaN(itemTotal) ? 0 : itemTotal);
    }, 0);

    // Log final data
    console.log('Valid items:', JSON.stringify(validItems, null, 2));
    console.log('Subtotal:', subtotal);

    // Fetch related products, excluding out-of-stock items
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
      total: isNaN(subtotal) ? 0 : subtotal,
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

    console.log("variant.quantity", variant.quantity);
    console.log("requested quantity", quantity);

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
        console.log(`Removed variant ${variantId} from wishlist`);
      }
    }

    // Save the cart
    await cart.save();
    res.json({ success: true, message: 'Added to cart successfully and removed from wishlist if present', cart });
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
  


  exports.applyCoupon = async (req, res) => {
    try {
      const { coupon, cartId } = req.body;
      
  
      // 1. Get the cart (raw, without population first)
      const rawCart = await Cart.findById(cartId);
     
  console.log('cheking')
      // 2. Populate the cart
      const cart = await Cart.findById(cartId)
        .populate('products.variant_id')
        .populate('products.product_id');
      
  
      if (!cart || !cart.products || cart.products.length === 0) {
        
        return res.status(400).json({ success: false, message: 'Cart not found or empty' });
      }
      console.log('cheking')
      // 3. Calculate subtotal with detailed logging
      let subtotal = 0;
      cart.products.forEach(item => {
       
        const variant = item.variant_id;
        if (variant && variant.sale_price) {
          
          subtotal += variant.sale_price * item.quantity;
        } else {
          
        }
      });
  
     
      console.log('cheking')
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

