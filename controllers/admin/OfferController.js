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
      .sort({ created_at: -1 })
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
      
      let { name, code, discountType, discountValue, appliesTo, targetIds, startDate, endDate } = req.body;
  
      // Validate using a validation function to avoid duplication
      const validationErrors = [];
  
      // Basic field validations
      if (!name || name.trim() === '') {
        validationErrors.push('Offer name is required');
      } else {
        name = name.trim();
        
        // Check if name already exists
        const existingOfferWithName = await Offer.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') }, isDeleted: false });
        if (existingOfferWithName) {
          validationErrors.push('An offer with this name already exists');
        }
      }
  
      if (!appliesTo) {
        validationErrors.push('Offer type (appliesTo) is required');
      } else if (!['product', 'category'].includes(appliesTo)) {
        validationErrors.push('Invalid offer type. Must be "product" or "category"');
      }
  
      if (!discountType || !['percentage', 'fixed'].includes(discountType)) {
        validationErrors.push('Valid discount type (percentage or fixed) is required');
      }
  
      // Process and validate targetIds
      if (typeof targetIds === 'string') {
        targetIds = [targetIds];
      } else if (!Array.isArray(targetIds)) {
        validationErrors.push('targetIds must be an array');
        targetIds = [];
      }
  
      // Trim and filter empty values
      targetIds = targetIds.map(id => id?.trim()).filter(id => id);
      
      if (targetIds.length === 0) {
        validationErrors.push('At least one target ID is required');
      } else {
        // Check for duplicate IDs
        const uniqueIds = new Set(targetIds);
        if (uniqueIds.size !== targetIds.length) {
          validationErrors.push('Duplicate target IDs are not allowed');
        }
  
        // Validate ObjectIds
        const validIds = targetIds.every(id => mongoose.isValidObjectId(id));
        if (!validIds) {
          
          validationErrors.push('One or more targetIds are invalid');
        }
      }
  
      // Validate and clean code (if provided)
      if (code) {
        code = code.trim().toUpperCase();
        
        if (code.length < 3) {
          validationErrors.push('Offer code must be at least 3 characters long');
        } else if (!/^[A-Z0-9_-]+$/.test(code)) {
          validationErrors.push('Offer code can only contain letters, numbers, underscores, and hyphens');
        } else {
          // Check if code already exists
          const existingOffer = await Offer.findOne({ code: code, isDeleted: false });
          if (existingOffer) {
            validationErrors.push('An offer with this code already exists');
          }
        }
      }
  
      // Convert and validate discountValue
      discountValue = parseFloat(discountValue);
      if (isNaN(discountValue) || discountValue <= 0) {
        validationErrors.push('Discount value must be a positive number');
      } else if (discountType === 'percentage' && discountValue > 100) {
        validationErrors.push('Percentage discount cannot exceed 100%');
      }
  
      // Convert and validate dates
      let startDateObj, endDateObj;
      
      if (!startDate || !endDate) {
        validationErrors.push('Start and end dates are required');
      } else {
        startDateObj = new Date(startDate);
        endDateObj = new Date(endDate);
        
        if (isNaN(startDateObj) || isNaN(endDateObj)) {
          validationErrors.push('Invalid start or end date format');
        } else {
          // Current date without time component for fair comparison
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          // Set time component of date objects to zero for fair comparison
          const startDateCompare = new Date(startDateObj);
          startDateCompare.setHours(0, 0, 0, 0);
          
          const endDateCompare = new Date(endDateObj);
          endDateCompare.setHours(0, 0, 0, 0);
          
          if (startDateCompare < today) {
            validationErrors.push(`Start date ${startDate} cannot be in the past (current date: ${today.toISOString().split('T')[0]})`);
          }
          
          if (endDateCompare <= startDateCompare) {
            validationErrors.push('End date must be after start date');
          }
        }
      }
  
      // If there are validation errors, throw error with the first one
      if (validationErrors.length > 0) {
        throw new Error(validationErrors[0]);
      }
  
      // Database validation (only if basic validations pass)
      if (appliesTo === 'product') {
       
        const products = await Product.find({ _id: { $in: targetIds }, isDeleted: false, status: 'listed' });
       
        
        if (products.length !== targetIds.length) {
          // Find missing product IDs for better error message
          const foundIds = new Set(products.map(p => p._id.toString()));
          const missingIds = targetIds.filter(id => !foundIds.has(id));
          
          throw new Error(`Invalid or unavailable product IDs: ${missingIds.join(', ')}`);
        }
      } else if (appliesTo === 'category') {
        
        const categories = await Category.find({ _id: { $in: targetIds }, isDeleted: false, status: 'listed' });
        
        
        if (categories.length !== targetIds.length) {
          // Find missing category IDs for better error message
          const foundIds = new Set(categories.map(c => c._id.toString()));
          const missingIds = targetIds.filter(id => !foundIds.has(id));
          
          throw new Error(`Invalid or unavailable category IDs: ${missingIds.join(', ')}`);
        }
      }
  
      // Create offer with parsed and validated data
      const offer = new Offer({
        name,
        code: code || undefined,
        discountType,
        discountValue,
        appliesTo,
        targetIds,
        startDate: startDateObj,
        endDate: endDateObj,
        // Include any other fields from req.body that aren't explicitly validated
        ...Object.fromEntries(
          Object.entries(req.body)
            .filter(([key]) => !['name', 'code', 'discountType', 'discountValue', 'appliesTo', 'targetIds', 'startDate', 'endDate'].includes(key))
        )
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
      let { id, name, appliesTo, targetIds, discountType, discountValue, code, startDate, endDate } = req.body;
  
      // Validate using a validation function to avoid duplication
      const validationErrors = [];
  
      // Check if offer exists
      const existingOffer = await Offer.findById(id);
      if (!existingOffer) {
        throw new Error('Offer not found');
      }
  
      // Basic field validations
      if (!name || name.trim() === '') {
        validationErrors.push('Offer name is required');
      } else {
        name = name.trim();
        
        // Check if name already exists (excluding this offer)
        const duplicateName = await Offer.findOne({ 
          _id: { $ne: id }, 
          name: { $regex: new RegExp(`^${name}$`, 'i') }, 
          isDeleted: false 
        });
        
        if (duplicateName) {
          validationErrors.push('An offer with this name already exists');
        }
      }
  
      if (!appliesTo) {
        validationErrors.push('Offer type (appliesTo) is required');
      } else if (!['product', 'category'].includes(appliesTo)) {
        validationErrors.push('Invalid offer type. Must be "product" or "category"');
      }
  
      if (!discountType || !['percentage', 'fixed'].includes(discountType)) {
        validationErrors.push('Valid discount type (percentage or fixed) is required');
      }
  
      // Process and validate targetIds
      if (typeof targetIds === 'string') {
        targetIds = [targetIds];
      } else if (!Array.isArray(targetIds)) {
        validationErrors.push('targetIds must be an array');
        targetIds = [];
      }
  
      // Trim and filter empty values
      targetIds = targetIds.map(id => id?.trim()).filter(id => id);
      
      if (targetIds.length === 0) {
        validationErrors.push('At least one target ID is required');
      } else {
        // Check for duplicate IDs
        const uniqueIds = new Set(targetIds);
        if (uniqueIds.size !== targetIds.length) {
          validationErrors.push('Duplicate target IDs are not allowed');
        }
  
        // Validate ObjectIds
        const validIds = targetIds.every(id => mongoose.isValidObjectId(id));
        if (!validIds) {
          validationErrors.push('One or more targetIds are invalid');
        }
      }
  
      // Validate and clean code (if provided)
      if (code) {
        code = code.trim().toUpperCase();
        
        if (code.length < 3) {
          validationErrors.push('Offer code must be at least 3 characters long');
        } else if (!/^[A-Z0-9_-]+$/.test(code)) {
          validationErrors.push('Offer code can only contain letters, numbers, underscores, and hyphens');
        } else if (code !== existingOffer.code) {
          // Check if code already exists (only if changed)
          const duplicateCode = await Offer.findOne({ 
            _id: { $ne: id }, 
            code: code, 
            isDeleted: false 
          });
          
          if (duplicateCode) {
            validationErrors.push('An offer with this code already exists');
          }
        }
      }
  
      // Convert and validate discountValue
      discountValue = parseFloat(discountValue);
      if (isNaN(discountValue) || discountValue <= 0) {
        validationErrors.push('Discount value must be a positive number');
      } else if (discountType === 'percentage' && discountValue > 100) {
        validationErrors.push('Percentage discount cannot exceed 100%');
      }
  
      // Convert and validate dates
      let startDateObj, endDateObj;
      
      if (!startDate || !endDate) {
        validationErrors.push('Start and end dates are required');
      } else {
        startDateObj = new Date(startDate);
        endDateObj = new Date(endDate);
        
        if (isNaN(startDateObj) || isNaN(endDateObj)) {
          validationErrors.push('Invalid start or end date format');
        } else {
          // Current date without time component for fair comparison
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          // Set time component of date objects to zero for fair comparison
          const startDateCompare = new Date(startDateObj);
          startDateCompare.setHours(0, 0, 0, 0);
          
          const endDateCompare = new Date(endDateObj);
          endDateCompare.setHours(0, 0, 0, 0);
          
          // For updates, allow the start date to be in the past if it's not changed from original
          const originalStartDate = new Date(existingOffer.startDate);
          originalStartDate.setHours(0, 0, 0, 0);
          
          // Only validate start date if it's different from the original
          if (startDateCompare.getTime() !== originalStartDate.getTime() && startDateCompare < today) {
            validationErrors.push(`Start date ${startDate} cannot be in the past (current date: ${today.toISOString().split('T')[0]})`);
          }
          
          if (endDateCompare <= startDateCompare) {
            validationErrors.push('End date must be after start date');
          }
        }
      }
  
      // If there are validation errors, throw error with the first one
      if (validationErrors.length > 0) {
        throw new Error(validationErrors[0]);
      }
  
      // Database validation (only if basic validations pass)
      if (appliesTo === 'product') {
        const products = await Product.find({ _id: { $in: targetIds }, isDeleted: false, status: 'listed' });
        
        if (products.length !== targetIds.length) {
          // Find missing product IDs for better error message
          const foundIds = new Set(products.map(p => p._id.toString()));
          const missingIds = targetIds.filter(id => !foundIds.has(id));
          
          throw new Error(`Invalid or unavailable product IDs: ${missingIds.join(', ')}`);
        }
      } else if (appliesTo === 'category') {
        const categories = await Category.find({ _id: { $in: targetIds }, isDeleted: false, status: 'listed' });
        
        if (categories.length !== targetIds.length) {
          // Find missing category IDs for better error message
          const foundIds = new Set(categories.map(c => c._id.toString()));
          const missingIds = targetIds.filter(id => !foundIds.has(id));
          
          throw new Error(`Invalid or unavailable category IDs: ${missingIds.join(', ')}`);
        }
      }
  
      // Update offer with parsed and validated data
      const updatedOffer = await Offer.findByIdAndUpdate(
        id,
        {
          name,
          appliesTo,
          targetIds,
          discountType,
          discountValue,
          startDate: startDateObj,
          endDate: endDateObj,
          code: code || undefined,
          // Include any other fields from req.body that aren't explicitly validated
          ...Object.fromEntries(
            Object.entries(req.body)
              .filter(([key]) => !['id', 'name', 'appliesTo', 'targetIds', 'discountType', 'discountValue', 'startDate', 'endDate', 'code'].includes(key))
          )
        },
        { new: true }
      );
  
      if (!updatedOffer) {
        throw new Error('Failed to update offer');
      }
  
      // Update sale prices
      await OfferService.updateSalePrices();
  
      req.session.successMessage = 'Offer updated successfully';
      res.redirect('/admin/offers');
    } catch (error) {
      console.error('Error updating offer:', error);
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
        
        const variants = await Variant.find({
          product_id: { $in: offer.targetIds },
          isDeleted: false,
          
        });
        const updates = variants.map(variant => ({
          updateOne: {
            filter: { _id: variant._id },
            update: { $set: { sale_price: variant.price, discountType: null, activeDiscountValue: 0,offer_id: null } },
          },
        }));
        if (updates.length > 0) {
          
          await Variant.bulkWrite(updates);
        }
      } else if (offer.appliesTo === 'category') {
       
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
            update: { $set: { sale_price: variant.price, discountType: null, activeDiscountValue: 0,offer_id: null } },
          },
        }));
        if (updates.length > 0) {
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