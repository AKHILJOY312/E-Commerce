const Coupon = require('../../models/Coupon');

// GET: Coupon List
exports.getCoupons = async (req, res) => {
  try {
    const searchQuery = req.query.search || '';
    const query = {
      is_deleted: false,
      code: { $regex: searchQuery, $options: 'i' }
    };

    const coupons = await Coupon.find(query).sort({ createdAt: -1 });

    res.render('coupon', {
      coupons,
      searchQuery
    });
  } catch (error) {
    console.error('Error fetching coupons:', error);
    res.redirect('/admin/dashboard');
  }
};

// POST: Add Coupon
exports.addCoupon = async (req, res) => {
  try {
    const {
      code,
      discount_type,
      discount_value,
      usage_limit,
      start_date,
      end_date
    } = req.body;

    const existing = await Coupon.findOne({ code: code.toUpperCase(), is_deleted: false });

    if (existing) {
        req.flash('error',"Already the same name exists");
      return res.redirect("/admin/coupon");
    }

    const newCoupon = new Coupon({
      code: code.toUpperCase(),
      discount_type,
      discount_value,
      usage_limit,
      start_date,
      end_date
    });

    await newCoupon.save();
    res.redirect('/admin/coupon');
  } catch (error) {
    console.error('Error adding coupon:', error);
    res.redirect('/admin/coupon');
  }
};

// POST: Edit Coupon
exports.editCoupon = async (req, res) => {
  try {
    const {
      id,
      code,
      discount_type,
      discount_value,
      usage_limit,
      start_date,
      end_date
    } = req.body;

    await Coupon.findByIdAndUpdate(id, {
      code: code.toUpperCase(),
      discount_type,
      discount_value,
      usage_limit,
      start_date,
      end_date
    });

    res.redirect('/admin/coupon');
  } catch (error) {
    console.error('Error editing coupon:', error);
    res.redirect('/admin/coupon');
  }
};

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
