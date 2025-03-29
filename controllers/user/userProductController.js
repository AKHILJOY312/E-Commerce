const Product = require('../../models/Product');
const Category = require('../../models/Category');
const mongoose = require('mongoose');


//shop page management

exports.loadShop = async(req, res, next) => {
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

        console.log("Pagination & Filter Parameters:", { perPage, page, searchQuery, categoryId, brand, minPrice, maxPrice, sortOption });

        
        const matchQuery = { isDeleted: false };
        if (searchQuery) {
            matchQuery.$or = [
                { name: { $regex: searchQuery, $options: 'i' } },
                { brand: { $regex: searchQuery, $options: 'i' } }
            ];
        }
        if (categoryId) matchQuery.category_id = categoryId;
        if (brand) matchQuery.brand = brand;

        
        const categories = await Category.find({ isDeleted: false ,status:"listed"});

        
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
            {
                $project: {
                    name: 1,
                    brand: 1,
                    category_id: 1,
                    isDeleted: 1,
                    created_at: 1,
                    updated_at: 1,
                    variants: {
                        $filter: {
                            input: '$variants',
                            cond: {
                                $and: [
                                    { $eq: ['$$this.isDeleted', false] },
                                    { $gte: ['$$this.price', minPrice] },
                                    { $lte: ['$$this.price', maxPrice] }
                                ]
                            }
                        }
                    },
                    categoryTitle: { $ifNull: [{ $arrayElemAt: ['$categoryDetails.title', 0] }, 'Unknown Category'] }
                }
            },
            { $match: { 'variants.0': { $exists: true } } },
            { $addFields: { minPrice: { $min: '$variants.price' } } }, 
            {
                $sort: (sortOption === 'priceLow') ? { minPrice: 1 } :
                       (sortOption === 'priceHigh') ? { minPrice: -1 } :
                       (sortOption === 'nameAsc') ? { name: 1 } :
                       (sortOption === 'nameDesc') ? { name: -1 } :
                       (sortOption === 'oldest') ? { created_at: 1 } :
                       { created_at: -1 } 
            },
            { $skip: (page - 1) * perPage },
            { $limit: perPage }
        ]);

        
        const totalMatchingProducts = await Product.aggregate([
            { $match: matchQuery },
            { $lookup: { from: 'variants', localField: '_id', foreignField: 'product_id', as: 'variants' } },
            { $project: { variants: { $filter: { input: '$variants', cond: { $and: [{ $eq: ['$$this.isDeleted', false] }, { $gte: ['$$this.price', minPrice] }, { $lte: ['$$this.price', maxPrice] }] } } } } },
            { $match: { 'variants.0': { $exists: true } } },
            { $count: 'total' }
        ]);
        
const categoryCounts = await Product.aggregate([
    { $match: { isDeleted: false } }, 
    { 
        $group: {
            _id: "$category_id",
            productCount: { $sum: 1 }
        }
    }
]);


const categoriesWithCounts = await Category.aggregate([
    { $match: { isDeleted: false } }, 
    {
        $lookup: {
            from: "products",
            localField: "_id",
            foreignField: "category_id",
            pipeline: [
                { $match: { isDeleted: false } }, 
                { $count: "productCount" } 
            ],
            as: "productCount"
        }
    },
    {
        $addFields: {
            productCount: { $ifNull: [{ $arrayElemAt: ["$productCount.productCount", 0] }, 0] } // 
        }
    }
]);

        const totalProducts = totalMatchingProducts.length > 0 ? totalMatchingProducts[0].total : 0;
        const totalPages = Math.ceil(totalProducts / perPage);

        console.log("Products found:", products.length, "Total products:", totalProducts);

        res.render('products/shop', {
            products,
            currentPage: page,
            totalPages,
            perPage,
            totalProducts,
            searchQuery,
            categories:categoriesWithCounts,
            selectedCategory: categoryId ? categoryId.toString() : '',
            selectedBrand: brand,
            minPrice,
            maxPrice,
            sort: sortOption
        });
    } catch (error) {
        console.error('Error fetching products:', error);
        res.redirect('/error');
    }
   };

   exports.productDetail = async(req, res, next) => {
   try {
    res.render('products/details')
   } catch (error) {
    
   }

}