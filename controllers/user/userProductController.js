const Product = require('../../models/Product');
const Category = require('../../models/Category');
const Review=require('../../models/Review')
const mongoose = require('mongoose');


//shop page management

exports.loadShop = async (req, res, next) => {
    try {
      const perPage = 6;
      const page = parseInt(req.query.page) || 1;
      const searchQuery = req.query.search || '';
      const categoryId = req.query.category && mongoose.isValidObjectId(req.query.category)
        ? new mongoose.Types.ObjectId(req.query.category)
        : null;
      const brand = req.query.brand || '';
      const minPrice = parseFloat(req.query.minPrice) || 0;
      const maxPrice = parseFloat(req.query.maxPrice) || Infinity;
      const sortOption = req.query.sort || 'newest';
  
      // Basic match query to exclude unlisted/deleted products
      const matchQuery = {
        isDeleted: false,
        status: 'listed'
      };
  
      // If a category is selected, verify it's a valid, listed category
      if (categoryId) {
        const categoryExists = await Category.findOne({
          _id: categoryId,
          isDeleted: false,
          status: 'listed'
        });
        if (categoryExists) {
          matchQuery.category_id = categoryId;
        } else {
          return res.redirect('/shop');
        }
      }
  
      if (searchQuery) {
        matchQuery.$or = [
          { name: { $regex: searchQuery, $options: 'i' } },
          { brand: { $regex: searchQuery, $options: 'i' } }
        ];
      }
      if (brand) matchQuery.brand = brand;
  
      // Fetch listed and non-deleted categories
      const categories = await Category.find({
        isDeleted: false,
        status: 'listed'
      });
  
      // Fetch wishlist items if user is logged in
      let wishlistItems = [];
      if (req.session.user_id) {
        const wishlist = await mongoose.model('wishlists').findOne({ user_id: req.session.user_id });
        if (wishlist) {
          wishlistItems = wishlist.items.map(item => ({
            product_id: item.product_id.toString(),
            variant_id: item.variant_id.toString()
          }));
        }
      }
  
      // Product aggregation with review data
      const products = await Product.aggregate([
        { $match: matchQuery },
        {
          $lookup: {
            from: 'variants',
            localField: '_id',
            foreignField: 'product_id',
            as: 'variants'
          }
        },
        {
          $lookup: {
            from: 'categories',
            localField: 'category_id',
            foreignField: '_id',
            as: 'categoryDetails'
          }
        },
        // Lookup reviews for the product
        {
          $lookup: {
            from: 'reviews',
            localField: '_id',
            foreignField: 'product_id',
            as: 'reviews'
          }
        },
        {
          $project: {
            name: 1,
            brand: 1,
            category_id: 1,
            status: 1,
            isDeleted: 1,
            created_at: 1,
            updated_at: 1,
            variants: {
              $filter: {
                input: '$variants',
                cond: {
                  $and: [
                    { $eq: ['$$this.isDeleted', false] },
                    { $gt: ['$$this.quantity', 0] },
                    { $gte: ['$$this.sale_price', minPrice] },
                    { $lte: ['$$this.sale_price', maxPrice] }
                  ]
                }
              }
            },
            categoryTitle: { $ifNull: [{ $arrayElemAt: ['$categoryDetails.title', 0] }, 'Unknown Category'] },
            // Calculate average rating and review count
            averageRating: {
              $cond: {
                if: { $gt: [{ $size: '$reviews' }, 0] },
                then: { $avg: '$reviews.rating' },
                else: 0
              }
            },
            reviewCount: { $size: '$reviews' }
          }
        },
        // Filter again to ensure valid categories and variants
        {
          $lookup: {
            from: 'categories',
            let: { categoryId: '$category_id' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$_id', '$$categoryId'] },
                  isDeleted: false,
                  status: 'listed'
                }
              }
            ],
            as: 'validCategory'
          }
        },
        {
          $match: {
            'variants.0': { $exists: true },
            'validCategory.0': { $exists: true }
          }
        },
        { $addFields: { minPrice: { $min: '$variants.sale_price' } } },
        {
          $sort: (sortOption === 'priceLow') ? { minPrice: 1 } :
                 (sortOption === 'priceHigh') ? { minPrice: -1 } :
                 (sortOption === 'nameAsc') ? { name: 1, minPrice: 1 } :
                 (sortOption === 'nameDesc') ? { name: -1, minPrice: 1 } :
                 (sortOption === 'oldest') ? { created_at: 1 } :
                 { created_at: -1 }
        },
        { $skip: (page - 1) * perPage },
        { $limit: perPage }
      ]);
  
      // Count total matching products
      const totalMatchingProducts = await Product.aggregate([
        { $match: matchQuery },
        {
          $lookup: {
            from: 'categories',
            let: { categoryId: '$category_id' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$_id', '$$categoryId'] },
                  isDeleted: false,
                  status: 'listed'
                }
              }
            ],
            as: 'validCategory'
          }
        },
        { $match: { 'validCategory.0': { $exists: true } } },
        { $lookup: { from: 'variants', localField: '_id', foreignField: 'product_id', as: 'variants' } },
        {
          $project: {
            variants: {
              $filter: {
                input: '$variants',
                cond: {
                  $and: [
                    { $eq: ['$$this.isDeleted', false] },
                    { $gte: ['$$this.sale_price', minPrice] },
                    { $lte: ['$$this.sale_price', maxPrice] }
                  ]
                }
              }
            }
          }
        },
        { $match: { 'variants.0': { $exists: true } } },
        { $count: 'total' }
      ]);
  
      // Get category counts for valid categories
      const categoriesWithCounts = await Category.aggregate([
        { $match: { isDeleted: false, status: 'listed' } },
        {
          $lookup: {
            from: 'products',
            localField: '_id',
            foreignField: 'category_id',
            pipeline: [
              { $match: { isDeleted: false, status: 'listed' } },
              { $count: 'productCount' }
            ],
            as: 'productCount'
          }
        },
        {
          $addFields: {
            productCount: { $ifNull: [{ $arrayElemAt: ['$productCount.productCount', 0] }, 0] }
          }
        }
      ]);
  
      const totalProducts = totalMatchingProducts.length > 0 ? totalMatchingProducts[0].total : 0;
      const totalPages = Math.ceil(totalProducts / perPage);
  
      res.render('products/shop', {
        products,
        currentPage: page,
        totalPages,
        perPage,
        totalProducts,
        searchQuery,
        categories: categoriesWithCounts,
        selectedCategory: categoryId ? categoryId.toString() : '',
        selectedBrand: brand,
        minPrice,
        maxPrice,
        sort: sortOption,
        currentActivePage: 'shop',
        wishlistItems
      });
    } catch (error) {
      console.error('Error fetching products:', error);
      res.redirect('/error');
    }
  };

exports.productDetail = async (req, res, next) => {
    try {
      const productId = req.params.productId;
      const variantId = req.query.variant || null; 

      
      if (!mongoose.isValidObjectId(productId)) {
       
        return res.redirect('/pageNotFound');
      }
      let wishlistItems = [];
        if (req.session.user_id) {
          const wishlist = await mongoose.model('wishlists').findOne({ user_id: req.session.user_id });
          if (wishlist) {
            wishlistItems = wishlist.items.map(item => ({
              product_id: item.product_id.toString(),
              variant_id: item.variant_id.toString()
            }));
          }
        }
  
      const product = await Product.findOne({ _id: productId, isDeleted: false, status: 'listed' })
        .populate({
          path: 'variants',
          match: { isDeleted: false, status: 'unlisted' },
        })
        .populate('category_id');
  
      if (!product || !product.variants.length) {
        
        return res.redirect('/pageNotFound');
      }
  
      // Select the active variant: use query param if valid, otherwise default to first variant
      let activeVariant = product.variants[0];
      if (variantId && mongoose.isValidObjectId(variantId)) {
        const foundVariant = product.variants.find(v => v._id.toString() === variantId);
        activeVariant = foundVariant || product.variants[0]; // Fallback to first if not found
      }
  
      const reviews = await Review.find({ product_id: productId })
        .populate('user_id', 'name')
        .sort({ created_at: -1 });
  
      const avgRating = reviews.length > 0
        ? (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1)
        : 0;
  
      // Fetch related products (e.g., same category, excluding the current product)
      const relatedProducts = await Product.find({
        _id: { $ne: productId }, // Exclude the current product
        category_id: product.category_id, // Match by category
        isDeleted: false,
        status: 'listed',
      })
        .populate('variants')
        .limit(4); // Limit to 4 related products

      res.render('products/details', {
        product,
        variants: product.variants,
        activeVariant,
        reviews,
        avgRating,
        category: product.category_id ? product.category_id.title : 'Unknown Category',
        relatedProducts, 
        currentActivePage:'shop',
        wishlistItems
      });
    } catch (error) {
      console.error('Error fetching product details:', error);
      res.redirect('/pageNotFound');
    }
  };