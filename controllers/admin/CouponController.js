const Coupon = require('../../models/Coupon');
const { body, validationResult } = require('express-validator');

// GET: Coupon List
exports.getCoupons = async (req, res) => {
  try {
    const searchQuery = req.query.search || '';
    const page = parseInt(req.query.page) || 1;
    const limit = 10; // Number of coupons per page
    const skip = (page - 1) * limit;
    const startDate = req.query.startDate || '';
    const endDate = req.query.endDate || '';

    const query = {
      is_deleted: false,
      code: { $regex: searchQuery, $options: 'i' }
    };

    // Add date filters if provided
    if (startDate) {
      query.start_date = { $gte: new Date(startDate) };
    }
    if (endDate) {
      query.end_date = { $lte: new Date(endDate) };
    }

    const totalCoupons = await Coupon.countDocuments(query);
    const coupons = await Coupon.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(totalCoupons / limit);

    res.render('coupon', {
      coupons,
      searchQuery,
      currentPage: page,
      totalPages,
      startDate,
      endDate
    });
  } catch (error) {
    console.error('Error fetching coupons:', error);
    res.redirect('/admin/dashboard');
  }
};
// POST: Add Coupon
// Validation middleware for addCoupon and editCoupon
const couponValidationRules = [
  body('code')
    .trim()
    .notEmpty()
    .withMessage('Coupon code is required')
    .isAlphanumeric()
    .withMessage('Coupon code must be alphanumeric')
    .isLength({ min: 3, max: 20 })
    .withMessage('Coupon code must be between 3 and 20 characters')
    .customSanitizer((value) => value.toUpperCase()),
  
  body('discount_type')
    .notEmpty()
    .withMessage('Discount type is required')
    .isIn(['percentage', 'fixed'])
    .withMessage('Discount type must be either "percentage" or "fixed"'),
  
  body('discount_value')
    .notEmpty()
    .withMessage('Discount value is required')
    .isFloat({ min: 0.01 })
    .withMessage('Discount value must be a positive number')
    .custom((value, { req }) => {
      if (req.body.discount_type === 'percentage' && value > 100) {
        throw new Error('Percentage discount cannot exceed 100');
      }
      return true;
    }),
  
  body('usage_limit')
    .optional({ nullable: true })
    .isInt({ min: 1 })
    .withMessage('Usage limit must be a positive integer'),
  
  body('start_date')
    .notEmpty()
    .withMessage('Start date is required')
    .isISO8601()
    .withMessage('Start date must be a valid date')
    .customSanitizer((value) => new Date(value)),
  
  body('end_date')
    .notEmpty()
    .withMessage('End date is required')
    .isISO8601()
    .withMessage('End date must be a valid date')
    .customSanitizer((value) => new Date(value))
    .custom((value, { req }) => {
      if (new Date(value) <= new Date(req.body.start_date)) {
        throw new Error('End date must be after start date');
      }
      return true;
    }),
];

// POST: Add Coupon
exports.addCoupon = [
  // Apply validation rules
  ...couponValidationRules,
  body('start_date').custom((value) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (new Date(value) < today) {
      throw new Error('Start date cannot be in the past');
    }
    return true;
  }),
  async (req, res) => {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        req.flash('error', errors.array().map(err => err.msg).join(', '));
        return res.redirect('/admin/coupon');
      }

      const {
        code,
        discount_type,
        discount_value,
        usage_limit,
        start_date,
        end_date,
      } = req.body;

      // Check for existing coupon
      const existing = await Coupon.findOne({ code: code.toUpperCase(), is_deleted: false });
      if (existing) {
        req.flash('error', 'A coupon with this code already exists');
        return res.redirect('/admin/coupon');
      }

      // Create and save new coupon
      const newCoupon = new Coupon({
        code: code.toUpperCase(),
        discount_type,
        discount_value,
        usage_limit: usage_limit || null,
        start_date: new Date(start_date),
        end_date: new Date(end_date),
      });

      await newCoupon.save();
      req.flash('success', 'Coupon added successfully');
      res.redirect('/admin/coupon');
    } catch (error) {
      console.error('Error adding coupon:', error);
      req.flash('error', 'An error occurred while adding the coupon');
      res.redirect('/admin/coupon');
    }
  },
];

// POST: Edit Coupon
exports.editCoupon = [
  // Apply validation rules
  ...couponValidationRules,
  body('id')
    .notEmpty()
    .withMessage('Coupon ID is required')
    .isMongoId()
    .withMessage('Invalid coupon ID'),
  async (req, res) => {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        req.flash('error', errors.array().map(err => err.msg).join(', '));
        return res.redirect('/admin/coupon');
      }

      const {
        id,
        code,
        discount_type,
        discount_value,
        usage_limit,
        start_date,
        end_date,
      } = req.body;

      // Check if coupon exists
      const coupon = await Coupon.findById(id);
      if (!coupon) {
        req.flash('error', 'Coupon not found');
        return res.redirect('/admin/coupon');
      }

      // Check for duplicate code (excluding current coupon)
      const existing = await Coupon.findOne({
        code: code.toUpperCase(),
        is_deleted: false,
        _id: { $ne: id },
      });
      if (existing) {
        req.flash('error', 'A coupon with this code already exists');
        return res.redirect('/admin/coupon');
      }

      // Update coupon
      await Coupon.findByIdAndUpdate(id, {
        code: code.toUpperCase(),
        discount_type,
        discount_value,
        usage_limit: usage_limit || null,
        start_date: new Date(start_date),
        end_date: new Date(end_date),
      });

      req.flash('success', 'Coupon updated successfully');
      res.redirect('/admin/coupon');
    } catch (error) {
      console.error('Error editing coupon:', error);
      req.flash('error', 'An error occurred while updating the coupon');
      res.redirect('/admin/coupon');
    }
  },
];

// DELETE: Soft Delete Coupon
exports.deleteCoupon = async (req, res) => {
  try {
    const { id } = req.body;

    await Coupon.findByIdAndUpdate(id, { is_deleted: true });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting coupon:', error);
    res.json({ success: false, message: 'Deletion failed' });
  }
};
