const mongoose = require('mongoose');
const Offer = require('../models/Offer');
const Product = require('../models/Product');
const Variant = require('../models/Variant');
const Category = require('../models/Category');

class OfferService {
  static async updateSalePrices() {
    try {
      const now = new Date();
      console.log('Fetching active offers for date:', now);

      // Find active offers
      const offers = await Offer.find({
        isActive: true,
        isDeleted: false,
        startDate: { $lte: now },
        endDate: { $gte: now },
      }).lean();
      console.log('Active offers found:', offers.map(o => ({ _id: o._id, name: o.name, appliesTo: o.appliesTo, targetIds: o.targetIds })));

      // Apply offers to targeted variants
      for (const offer of offers) {
        console.log(`Processing offer: ${offer.name} (${offer._id})`);
        if (offer.appliesTo === 'product') {
          console.log('Updating variants for products with IDs:', offer.targetIds);

          // Find variants for the targeted products
          const variants = await Variant.find({
            product_id: { $in: offer.targetIds },
            isDeleted: false,
          });
          console.log('Found variants:', variants.map(v => ({ _id: v._id, product_id: v.product_id, name: v.color + ' ' + v.size, price: v.price })));

          if (variants.length === 0) {
            console.warn(`No listed variants found for products: ${offer.targetIds}`);
            continue;
          }

          const updates = variants.map(variant => {
            let salePrice;
            if (offer.discountType === 'percentage') {
              salePrice = variant.price * (1 - offer.discountValue / 100);
            } else if (offer.discountType === 'fixed') {
              salePrice = variant.price - offer.discountValue;
            }
            salePrice = Math.max(0.01, Math.round(salePrice * 100) / 100); // Ensure non-zero, round to 2 decimals
            console.log(`Variant ${variant.color} ${variant.size} (product_id: ${variant.product_id}): price=${variant.price}, sale_price=${salePrice}`);
            return {
              updateOne: {
                filter: { _id: variant._id },
                update: { $set: { sale_price: salePrice,discountType: offer.discountType, activeDiscountValue: offer.discountValue } },
              },
            };
          });

          console.log(`Bulk updating ${updates.length} variants`);
          await Variant.bulkWrite(updates);
        } else if (offer.appliesTo === 'category') {
          console.log('Updating variants for products in categories:', offer.targetIds);

          // Find products in the targeted categories
          const products = await Product.find({
            category_id: { $in: offer.targetIds },
            isDeleted: false,
            status: 'listed'
          });
          console.log('Found products:', products.map(p => ({ _id: p._id, name: p.name })));

          // Find variants for these products
          const productIds = products.map(p => p._id);
          const variants = await Variant.find({
            product_id: { $in: productIds },
            isDeleted: false,
            
          });
          console.log('Found variants:', variants.map(v => ({ _id: v._id, product_id: v.product_id, name: v.color + ' ' + v.size, price: v.price })));

          if (variants.length === 0) {
            console.warn(`No listed variants found for products in categories: ${offer.targetIds}`);
            continue;
          }

          const updates = variants.map(variant => {
            let salePrice;
            if (offer.discountType === 'percentage') {
              salePrice = variant.price * (1 - offer.discountValue / 100);
            } else if (offer.discountType === 'fixed') {
              salePrice = variant.price - offer.discountValue;
            }
            salePrice = Math.max(0.01, Math.round(salePrice * 100) / 100); // Ensure non-zero, round to 2 decimals
            console.log(`Variant ${variant.color} ${variant.size} (product_id: ${variant.product_id}): price=${variant.price}, sale_price=${salePrice}`);
            return {
              updateOne: {
                filter: { _id: variant._id },
                update: { $set: { sale_price: salePrice,discountType: offer.discountType, activeDiscountValue: offer.discountValue  } },
              },
            };
          });

          console.log(`Bulk updating ${updates.length} variants`);
          await Variant.bulkWrite(updates);
        }
      }

      console.log('Sale prices updated successfully');
      return { success: true, message: 'Sale prices updated successfully' };
    } catch (error) {
      console.error('Error updating sale prices:', error);
      throw new Error('Failed to update sale prices');
    }
  }

  static async calculateCartTotal(items) {
    try {
      let total = 0;
      for (const item of items) {
        const variant = await Variant.findById(item.variantId);
        if (!variant) throw new Error(`Variant ${item.variantId} not found`);
        const price = variant.sale_price;
        total += price * item.quantity;
        console.log(`Cart item: variant=${variant.color} ${variant.size}, price=${price}, quantity=${item.quantity}, subtotal=${price * item.quantity}`);
      }
      console.log('Cart total:', total);
      return total;
    } catch (error) {
      console.error('Error calculating cart total:', error);
      throw new Error('Failed to calculate cart total');
    }
  }
}

module.exports = OfferService;