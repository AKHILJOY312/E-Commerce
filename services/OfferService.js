const mongoose = require('mongoose');
const Offer = require('../models/Offer');
const Product = require('../models/Product');
const Variant = require('../models/Variant');
const Category = require('../models/Category');

class OfferService {
  static async updateSalePrices() {
    try {
      const now = new Date();
      

      // Find active offers
      const offers = await Offer.find({
        isActive: true,
        isDeleted: false,
        startDate: { $lte: now },
        endDate: { $gte: now },
      }).lean();

      // Apply offers to targeted variants
      for (const offer of offers) {
        if (offer.appliesTo === 'product') {

          // Find variants for the targeted products
          const variants = await Variant.find({
            product_id: { $in: offer.targetIds },
            isDeleted: false,
          });

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
            return {
              updateOne: {
                filter: { _id: variant._id },
                update: { $set: { sale_price: salePrice,discountType: offer.discountType, activeDiscountValue: offer.discountValue ,offer_id: offer._id } },
              },
            };
          });

          await Variant.bulkWrite(updates);
        } else if (offer.appliesTo === 'category') {

          // Find products in the targeted categories
          const products = await Product.find({
            category_id: { $in: offer.targetIds },
            isDeleted: false,
            status: 'listed'
          });

          // Find variants for these products
          const productIds = products.map(p => p._id);
          const variants = await Variant.find({
            product_id: { $in: productIds },
            isDeleted: false,
            
          });

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
            return {
              updateOne: {
                filter: { _id: variant._id },
                update: { $set: { sale_price: salePrice,discountType: offer.discountType, activeDiscountValue: offer.discountValue,offer_id: offer._id } },
              },
            };
          });

          await Variant.bulkWrite(updates);
        }
      }

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
      }
      return total;
    } catch (error) {
      console.error('Error calculating cart total:', error);
      throw new Error('Failed to calculate cart total');
    }
  }
}

module.exports = OfferService;