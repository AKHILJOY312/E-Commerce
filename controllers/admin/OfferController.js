const mongoose = require('mongoose');
const Offer = require('../../models/Offer');
const Product = require('../../models/Product');
const Category = require('../../models/Category');
const Variant = require('../../models/Variant');
const OfferService = require('../../services/OfferService');

class OfferController {
  static async getAdminOffersPage(req, res) {
    try {
      const { search, page = 1 } = req.query;
      const limit = 10;
      const query = { isDeleted: false };

      if (search) {
        query.name = { $regex: search, $options: 'i' };
      }

      const offers = await Offer.find(query)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

      const totalOffers = await Offer.countDocuments(query);
      const totalPages = Math.ceil(totalOffers / limit);

      const products = await Product.find({ status: 'listed', isDeleted: false }).lean();
      

      const categories = await Category.find({ status: 'listed', isDeleted: false }).lean();

      const messages = {
        success: req.session.successMessage ? [req.session.successMessage] : null,
        error: req.session.errorMessage ? [req.session.errorMessage] : null,
      };
      delete req.session.successMessage;
      delete req.session.errorMessage;

      res.render('offer', {
        offers,
        products,
        categories,
        searchQuery: search || '',
        currentPage: parseInt(page),
        totalPages,
        messages,
      });
    } catch (error) {
      console.error('Error in getAdminOffersPage:', error);
      req.session.errorMessage = error.message;
      res.render('offer', {
        offers: [],
        products: [],
        categories: [],
        searchQuery: search || '',
        currentPage: 1,
        totalPages: 1,
        messages: { error: [error.message] },
      });
    }
  }

  static async createOffer(req, res) {
    try {
      console.log('Request body:', JSON.stringify(req.body, null, 2));
      let { appliesTo, targetIds, discountValue, code, startDate, endDate } = req.body;

      // Parse targetIds to ensure it's an array
      if (typeof targetIds === 'string') {
        targetIds = [targetIds];
      } else if (!Array.isArray(targetIds)) {
        throw new Error('targetIds must be an array');
      }
      if (targetIds.length === 0) {
        throw new Error('At least one target ID is required');
      }

      // Validate ObjectIds
      const validIds = targetIds.every(id => mongoose.isValidObjectId(id));
      if (!validIds) {
        console.log('Invalid ObjectIds in targetIds:', targetIds);
        throw new Error('One or more targetIds are invalid');
      }

      // Convert discountValue to number
      discountValue = parseFloat(discountValue);
      if (isNaN(discountValue) || discountValue <= 0) {
        throw new Error('Discount value must be a positive number');
      }

      // Convert dates to Date objects
      const startDateObj = new Date(startDate);
      const endDateObj = new Date(endDate);
      if (isNaN(startDateObj) || isNaN(endDateObj)) {
        throw new Error('Invalid start or end date');
      }
      console.log('Parsed startDate:', startDateObj, 'endDate:', endDateObj);

      // Validate targetIds
      if (appliesTo === 'product') {
        console.log('Querying products with IDs:', targetIds);
        const products = await Product.find({ _id: { $in: targetIds }, isDeleted: false, status: 'listed' });
        console.log('Found products:', products.map(p => p._id.toString()));
        if (products.length !== targetIds.length) {
          console.log('Mismatch: Expected', targetIds.length, 'products, found', products.length);
          throw new Error('Invalid or unavailable product IDs');
        }
      } else if (appliesTo === 'category') {
        console.log('Querying categories with IDs:', targetIds);
        const categories = await Category.find({ _id: { $in: targetIds }, isDeleted: false, status: 'listed' });
        console.log('Found categories:', categories.map(c => c._id.toString()));
        if (categories.length !== targetIds.length) {
          throw new Error('Invalid or unavailable category IDs');
        }
      }

      // Create offer with parsed data
      const offer = new Offer({
        ...req.body,
        targetIds,
        discountValue,
        startDate: startDateObj,
        endDate: endDateObj,
        code: code || undefined,
      });
      await offer.save();

      // Update sale prices
      await OfferService.updateSalePrices();

      req.session.successMessage = 'Offer created successfully';
      res.redirect('/admin/offers');
    } catch (error) {
      console.error('Error creating offer:', error);
      req.session.errorMessage = error.message;
      res.redirect('/admin/offers');
    }
  }

  static async updateOffer(req, res) {
    try {
      let { id, appliesTo, targetIds, discountValue, code, startDate, endDate } = req.body;

      // Parse targetIds to ensure it's an array
      if (typeof targetIds === 'string') {
        targetIds = [targetIds];
      } else if (!Array.isArray(targetIds)) {
        throw new Error('targetIds must be an array');
      }
      if (targetIds.length === 0) {
        throw new Error('At least one target ID is required');
      }

      // Validate ObjectIds
      const validIds = targetIds.every(id => mongoose.isValidObjectId(id));
      if (!validIds) {
        throw new Error('One or more targetIds are invalid');
      }

      // Convert discountValue to number
      discountValue = parseFloat(discountValue);
      if (isNaN(discountValue) || discountValue <= 0) {
        throw new Error('Discount value must be a positive number');
      }

      // Convert dates to Date objects
      const startDateObj = new Date(startDate);
      const endDateObj = new Date(endDate);
      if (isNaN(startDateObj) || isNaN(endDateObj)) {
        throw new Error('Invalid start or end date');
      }

      // Validate targetIds
      if (appliesTo === 'product') {
        const products = await Product.find({ _id: { $in: targetIds }, isDeleted: false, status: 'listed' });
        if (products.length !== targetIds.length) throw new Error('Invalid or unavailable product IDs');
      } else if (appliesTo === 'category') {
        const categories = await Category.find({ _id: { $in: targetIds }, isDeleted: false, status: 'listed' });
        if (categories.length !== targetIds.length) throw new Error('Invalid or unavailable category IDs');
      }

      const offer = await Offer.findByIdAndUpdate(
        id,
        {
          ...req.body,
          targetIds,
          discountValue,
          startDate: startDateObj,
          endDate: endDateObj,
          code: code || undefined,
        },
        { new: true }
      );
      if (!offer) throw new Error('Offer not found');

      // Update sale prices
      await OfferService.updateSalePrices();

      req.session.successMessage = 'Offer updated successfully';
      res.redirect('/admin/offers');
    } catch (error) {
      req.session.errorMessage = error.message;
      res.redirect('/admin/offers');
    }
  }

  static async activateOffer(req, res) {
    try {
      const { id } = req.query;
      const offer = await Offer.findByIdAndUpdate(id, { isActive: true }, { new: true });
      if (!offer) throw new Error('Offer not found');

      // Update sale prices
      await OfferService.updateSalePrices();

      req.session.successMessage = 'Offer activated successfully';
      res.redirect('/admin/offers');
    } catch (error) {
      req.session.errorMessage = error.message;
      res.redirect('/admin/offers');
    }
  }

  static async deactivateOffer(req, res) {
    try {
      const { id } = req.query;
      const offer = await Offer.findById(id);
      if (!offer) throw new Error('Offer not found');

      // Update offer to inactive
      offer.isActive = false;
      await offer.save();

      // Reset sale_price to price for affected variants
      if (offer.appliesTo === 'product') {
        console.log('Resetting sale_price for variants of products:', offer.targetIds);
        const variants = await Variant.find({
          product_id: { $in: offer.targetIds },
          isDeleted: false,
          
        });
        const updates = variants.map(variant => ({
          updateOne: {
            filter: { _id: variant._id },
            update: { $set: { sale_price: variant.price, discountType: null, activeDiscountValue: 0 } },
          },
        }));
        if (updates.length > 0) {
          console.log(`Bulk resetting ${updates.length} variant sale prices`);
          await Variant.bulkWrite(updates);
        }
      } else if (offer.appliesTo === 'category') {
        console.log('Resetting sale_price for variants of products in categories:', offer.targetIds);
        const products = await Product.find({
          category_id: { $in: offer.targetIds },
          isDeleted: false,
          status: 'listed'
        });
        const productIds = products.map(p => p._id);
        const variants = await Variant.find({
          product_id: { $in: productIds },
          isDeleted: false,
          
        });
        const updates = variants.map(variant => ({
          updateOne: {
            filter: { _id: variant._id },
            update: { $set: { sale_price: variant.price, discountType: null, activeDiscountValue: 0 } },
          },
        }));
        if (updates.length > 0) {
          console.log(`Bulk resetting ${updates.length} variant sale prices`);
          await Variant.bulkWrite(updates);
        }
      }

      // Update sale prices for any remaining active offers
      await OfferService.updateSalePrices();

      req.session.successMessage = 'Offer deactivated successfully';
      res.redirect('/admin/offers');
    } catch (error) {
      req.session.errorMessage = error.message;
      res.redirect('/admin/offers');
    }
  }

  static async deleteOffer(req, res) {
    try {
      const { id } = req.body;
      const offer = await Offer.findByIdAndUpdate(id, { isDeleted: true }, { new: true });
      if (!offer) throw new Error('Offer not found');

      // Update sale prices
      await OfferService.updateSalePrices();

      res.json({ success: true, message: 'Offer deleted successfully' });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async getActiveOffers(req, res) {
    try {
      const now = new Date();
      const offers = await Offer.find({
        isActive: true,
        isDeleted: false,
        startDate: { $lte: now },
        endDate: { $gte: now },
      });
      res.json(offers);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async calculateCartTotal(req, res) {
    try {
      const { items } = req.body;
      const total = await OfferService.calculateCartTotal(items);
      res.json({ total });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
}

module.exports = OfferController;