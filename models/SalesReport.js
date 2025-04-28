const mongoose = require('mongoose');
const Order = require('./Order');

class SalesReport {
  static async getReport({ period, startDate, endDate, categoryId, region, search, page = 1, perPage = 10 }) {
    // Validate period
    const validPeriods = ['daily', 'weekly', 'yearly', 'custom'];
    if (!validPeriods.includes(period)) {
      throw new Error('Invalid period. Use daily, weekly, yearly, or custom.');
    }

    // Date range calculation
    let dateFilter = {};
    if (period === 'custom') {
      if (!startDate || !endDate) throw new Error('Start and end dates required for custom period');
      dateFilter = {
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        },
      };
    } else {
      const moment = require('moment');
      let start, end;
      if (period === 'daily') {
        start = moment().startOf('day').toDate();
        end = moment().endOf('day').toDate();
      } else if (period === 'weekly') {
        start = moment().startOf('week').toDate();
        end = moment().endOf('week').toDate();
      } else if (period === 'yearly') {
        start = moment().startOf('year').toDate();
        end = moment().endOf('year').toDate();
      }
      dateFilter = { createdAt: { $gte: start, $lte: end } };
    }

    // Build query
    const query = {
      status: { $in: ['confirmed', 'intransit', 'delivered'] },
      ...dateFilter,
    };

    if (search) {
      query.$or = [
        { order_number: { $regex: search, $options: 'i' } },
        { user_id: { $in: await mongoose.model('User').find({ name: { $regex: search, $options: 'i' } }).distinct('_id') } },
      ];
    }

    if (categoryId && mongoose.Types.ObjectId.isValid(categoryId)) {
      query['order_items'] = {
        $in: await mongoose.model('order_items').find({
          product_id: {
            $in: await mongoose.model('Product').find({ category_id: categoryId }).distinct('_id'),
          },
        }).distinct('_id'),
      };
    }

    if (region && region.trim()) {
      query['address_id'] = {
        $in: await mongoose.model('Address').find({ region: { $regex: region, $options: 'i' } }).distinct('_id'),
      };
    }

    // Pagination
    const skip = (page - 1) * perPage;

    // Aggregation
    const reportData = await Order.aggregate([
      { $match: query },
      {
        $lookup: {
          from: 'coupons',
          localField: 'coupon_id',
          foreignField: '_id',
          as: 'coupon',
        },
      },
      { $unwind: { path: '$coupon', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'offers',
          localField: 'offer_id',
          foreignField: '_id',
          as: 'offer',
        },
      },
      { $unwind: { path: '$offer', preserveNullAndEmptyArrays: true } },
      {
        $unwind: { path: '$order_items', preserveNullAndEmptyArrays: true }
      },
      {
        $lookup: {
          from: 'order_items',
          localField: 'order_items',
          foreignField: '_id',
          as: 'items',
        },
      },
      { $unwind: { path: '$items', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'products',
          localField: 'items.product_id',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: period === 'daily' ? { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } } : null,
          salesCount: { $sum: 1 },
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: { $toDouble: '$total_amount' } },
          totalDiscounts: {
            $sum: {
              $add: [
                { $ifNull: [{ $toDouble: '$discount_amount' }, 0] },
                {
                  $cond: {
                    if: { $eq: ['$coupon.discount_type', 'fixed'] },
                    then: '$coupon.discount_value',
                    else: {
                      $cond: {
                        if: { $eq: ['$coupon.discount_type', 'percentage'] },
                        then: { $multiply: ['$amount', { $divide: ['$coupon.discount_value', 100] }] },
                        else: 0,
                      },
                    },
                  },
                },
                {
                  $cond: {
                    if: { $eq: ['$offer.discountType', 'fixed'] },
                    then: '$offer.discountValue',
                    else: {
                      $cond: {
                        if: { $eq: ['$offer.discountType', 'percentage'] },
                        then: { $multiply: ['$amount', { $divide: ['$offer.discountValue', 100] }] },
                        else: 0,
                      },
                    },
                  },
                },
              ],
            },
          },
          averageOrderValue: { $avg: { $toDouble: '$total_amount' } },
          products: {
            $push: {
              $cond: {
                if: { $ne: ['$product._id', null] },
                then: {
                  productId: '$product._id',
                  name: '$product.name',
                  quantity: '$items.quantity',
                },
                else: null,
              },
            },
          },
        },
      },
      {
        $addFields: {
          products: {
            $filter: {
              input: '$products',
              as: 'product',
              cond: { $ne: ['$$product', null] },
            },
          },
        },
      },
      {
        $addFields: {
          products: {
            $reduce: {
              input: '$products',
              initialValue: [],
              in: {
                $cond: {
                  if: {
                    $in: ['$$this.productId', '$$value.productId'],
                  },
                  then: {
                    $map: {
                      input: '$$value',
                      as: 'item',
                      in: {
                        $cond: {
                          if: { $eq: ['$$item.productId', '$$this.productId'] },
                          then: {
                            productId: '$$item.productId',
                            name: '$$item.name',
                            quantity: { $add: ['$$item.quantity', '$$this.quantity'] },
                          },
                          else: '$$item',
                        },
                      },
                    },
                  },
                  else: { $concatArrays: ['$$value', ['$$this']] },
                },
              },
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          date: '$_id',
          salesCount: 1,
          totalOrders: 1,
          totalRevenue: 1,
          totalDiscounts: 1,
          averageOrderValue: 1,
          products: 1,
        },
      },
      { $sort: { date: 1 } },
      { $skip: skip },
      { $limit: perPage },
    ]);

    // Log the reportData for debugging
    console.log('Report Data:', JSON.stringify(reportData, null, 2));

    // Total count for pagination
    const totalCount = await Order.countDocuments(query);
    const totalPages = Math.ceil(totalCount / perPage);

    return {
      reportData,
      totalPages,
      currentPage: parseInt(page),
      startDate: dateFilter.createdAt?.$gte,
      endDate: dateFilter.createdAt?.$lte,
    };
  }
}
module.exports = SalesReport;