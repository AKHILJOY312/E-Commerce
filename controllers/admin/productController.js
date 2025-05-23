const Product = require('../../models/Product');
const Variant = require('../../models/Variant');
const Category =require('../../models/Category');


const productController = {
  
  async getProducts(req, res) {
    try {
      const perPage = 5;
      const page = parseInt(req.query.page) || 1;
      const searchQuery = req.query.search || '';

      
      const query = {
        isDeleted: { $ne: true } 
      };

      
      if (searchQuery) {
        query.$or = [
          { name: { $regex: searchQuery, $options: 'i' } },
          { brand: { $regex: searchQuery, $options: 'i' } }
        ];
      }

      
      const totalProducts = await Product.countDocuments(query);
      const totalPages = Math.ceil(totalProducts / perPage);

      
      const products = await Product.find(query)
        .populate('category_id', 'title')
        .populate({
          path: 'variants',
          select: 'price sale_price quantity color material',
          match: { isDeleted: { $ne: true } } 
        })
        .skip((page - 1) * perPage)
        .limit(perPage)
        .sort({ created_at: -1 });

      
      const categories = await Category.find({ isDeleted: false }, '_id title');
 
      
      const productData = products.map(product => ({
        _id: product._id,
        name: product.name,
        status:product.status ,
        category: product.category_id?.title || 'Uncategorized',
        salePrice: product.variants.length > 0 
          ? Math.min(...product.variants.map(v => v.sale_price))
          : 0,
        stock: product.variants.reduce((sum, v) => sum + v.quantity, 0),
        inStock: product.variants.some(v => v.quantity > 0),
      }));

      
      res.render('products/index', {
        data: productData,
        currentPage: page,
        totalPages,
        searchQuery,
        categories,
        messages: req.flash() 
      });
    } catch (error) {
      console.error('Error fetching products:', error);
      req.flash('error', 'Error loading product catalog.');
      res.redirect('/admin/products'); 
    }
  },

  
  async getProductDetails(req, res) {
    try {
      const productId = req.params. productId;

      const product = await Product.findById(productId)
      .populate('category_id', 'title')
      .populate({
        path: 'variants',
        match: { isDeleted: false }, 
        select: '-__v' 
      });

      if (!product) {
        return res.status(404).json({ 
          error: 'Not Found',
          message: 'Product not found' 
        });
      }

      const productData = {
        _id: product._id,
        name: product.name,
        brand: product.brand,
        status: product.status,
        category: product.category_id?.title || 'Uncategorized',
        variants: product.variants.map(variant => ({
          _id: variant._id,
          material: variant.material,
          color: variant.color,
          description: variant.description,
          price: variant.price,
          salePrice: variant.sale_price,
          size:variant.size,
          sku: variant.sku,
          images: variant.product_image,
          quantity: variant.quantity,
          inStock: variant.quantity > 0
        })),
        created_at: product.created_at,
        updated_at: product.updated_at
      };

      res.render('products/show', { 
        product: productData
      });
    } catch (error) {
      console.error('Error fetching product details:', error);
      res.status(500).json({ 
        error: 'Internal Server Error',
        message: 'Error loading product details' 
      });
    }
  },

  // POST /products - Create new product (Create)
  async createProduct(req, res) {
    try {
      const { name, brand, category_id } = req.body;
  
      // Validate inputs
      if (!name || !name.trim()) {
        req.flash("error", "Product name is required and cannot be empty.");
        return res.redirect('/admin/products');
      }
  
      if (!brand || !brand.trim()) {
        req.flash("error", "Brand is required and cannot be empty.");
        return res.redirect('/admin/products');
      }
  
      if (!category_id || !/^[0-9a-fA-F]{24}$/.test(category_id)) {
        req.flash("error", "Valid category ID is required.");
        return res.redirect('/admin/products');
      }
  
      const trimmedName = name.trim();
      const trimmedBrand = brand.trim();
  
      // Validate name length
      if (trimmedName.length < 3 || trimmedName.length > 100) {
        req.flash("error", "Product name must be between 3 and 100 characters.");
        return res.redirect('/admin/products');
      }
  
      // Validate brand length
      if (trimmedBrand.length < 2 || trimmedBrand.length > 50) {
        req.flash("error", "Brand name must be between 2 and 50 characters.");
        return res.redirect('/admin/products');
      }
  
      // Check for existing product with same name
      const existingProduct = await Product.findOne({
        name: { $regex: new RegExp(`^${trimmedName}$`, 'i') }
      });
      if (existingProduct) {
        req.flash("error", "A product with this name already exists.");
        return res.redirect('/admin/products');
      }
  
      // Validate category exists
      const category = await Category.findById(category_id);
      if (!category) {
        req.flash("error", "Selected category does not exist.");
        return res.redirect('/admin/products');
      }
  
      const newProduct = new Product({
        name: trimmedName,
        brand: trimmedBrand,
        category_id,
        created_at: new Date(),
        updated_at: new Date()
      });
  
      await newProduct.save();
      req.flash("success", "Product added successfully.");
      res.status(201).redirect('/admin/products');
    } catch (error) {
      console.error('Error creating product:', error);
      req.flash("error", "Failed to create product. Please try again.");
      res.redirect('/admin/products');
    }
  },


  async listProduct(req,res){
try {
      await Product.findByIdAndUpdate(req.query.id, { status: 'listed' });
      req.flash("success", "Product added to the list.");
      res.redirect(`/admin/products/${req.query.id}`);
  } catch (error) {
      console.error('Error listing Product:', error);
      req.flash("error", "Error listing Product.");
      res.status(500).send('Server Error');
  }
  },
  async unlistProduct(req,res){
    try {
      await Product.findByIdAndUpdate(req.query.id, { status: 'unlisted' });
      req.flash("success", "Product added to the unlist.");
      res.redirect(`/admin/products/${req.query.id}`);
  } catch (error) {
      console.error('Error unlisting Product:', error);
      req.flash("error", "Error listing Product.");
      res.status(500).send('Server Error');
  }
  }
  ,
  // PUT /products/:id - Update existing product (Update)
  async updateProduct(req, res) {
    try {
      const productId = req.params.productId;
      const updateData = req.body;
      

      const product = await Product.findByIdAndUpdate(
        productId,
        { ...updateData, updated_at: Date.now() },
        { new: true, runValidators: true }
      );

      if (!product) {
        return res.status(404).json({ 
          error: 'Not Found',
          message: 'Product not found' 
        });
      }
      req.flash("success", "Category added successfully.");
     res.redirect(`/admin/products/${productId}`)
    } catch (error) {
      console.error('Error updating product:', error);
      res.status(400).json({ 
        error: 'Bad Request',
        message: 'Error updating product' 
      });
    }
  },
  async createVariant(req, res)  {
    try {
      const productId = req.params.productId;
      const { color, material, price,salePrice, quantity, sku, description,size } = req.body;

  
     
      const imagePaths = req.files ? req.files.map(file => `/uploads/variants/${file.filename}`) : [];
  
     
      const newVariant = new Variant({
        product_id: productId,
        color,
        material,
        price: parseFloat(price),
        sale_price: parseFloat(salePrice),
        quantity: parseInt(quantity),
        sku,
        description,
        size,
        product_image: imagePaths
      });
  
      await newVariant.save();
  
      
      await Product.findByIdAndUpdate(
        productId,
        { $push: { variants: newVariant._id }, updated_at: Date.now() },
        { new: true }
      );
      req.flash("success", "Variant added successfully.");
      res.redirect(`/admin/products/${productId}`);
    } catch (error) {
      console.error("Error creating variant:", error);
      res.status(500).json({ 
        error: "Internal Server Error",
        message: "Error creating variant" 
      });
    }
  },
  async getVariant(req, res) {
    try {
      const { variantId } = req.params;
     
      const variant = await Variant.findById(variantId).lean();
      if (!variant) {
        return res.status(404).json({ message: 'Variant not found' });
      }
      res.json({ variant });
    } catch (error) {
      res.status(500).json({ message: 'Error fetching variant' });
    }
  },
  async updateVariant(req, res) {
    try {
      const { productId, variantId } = req.params;
      const { color, material, price, salePrice, quantity, sku, description } = req.body;

      // Check if new files were uploaded
      const imagePaths = req.files ? req.files.map(file => `/uploads/variants/${file.filename}`) : undefined;

      
      const updateData = {
        color,
        material,
        price: parseFloat(price),
        sale_price: parseFloat(salePrice),
        quantity: parseInt(quantity),
        sku,
        description,
        updated_at: Date.now()
      };

      
      if (imagePaths) {
        updateData.product_image = imagePaths;
      }

      
      const variant = await Variant.findByIdAndUpdate(
        variantId,
        updateData,
        { new: true, runValidators: true }
      );

      if (!variant) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Variant not found'
        });
      }

     
      if (variant.product_id.toString() !== productId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Variant does not belong to this product'
        });
      }

      req.flash('success', 'Variant updated successfully.');
      res.redirect(`/admin/products/${productId}`);
    } catch (error) {
      console.error('Error updating variant:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Error updating variant'
      });
    }
  },
  async softDeleteVariant(req, res) {
    try {
      const variantId = req.params.variantId;
    
      
      const variant = await Variant.findByIdAndUpdate(
        variantId,
        { 
          isDeleted: true,
          updated_at: new Date()
        },
        { new: true }
      );
      
      if (!variant) {
       
        return res.status(404).json({ message: 'Variant not found' });
      }
      
     
      res.status(200).json({ 
        message: 'Variant soft deleted successfully',
        variantId 
      });
    } catch (error) {
      console.error('Soft delete error:', error);
      res.status(500).json({ 
        message: 'Server error while soft deleting variant',
        error: error.message 
      });
    }
  },
  // DELETE /products/:id - Delete product (Destroy)
  async deleteProduct(req, res) {
    try {
      const productId = req.params.productId;

      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({ 
          error: 'Not Found',
          message: 'Product not found' 
        });
      }
        
      const productUpdate = await Product.findByIdAndUpdate(
        productId,
        { 
          isDeleted: true,
          updated_at: new Date()
        },
        { new: true }
      );

      if (!productUpdate) {
        
      req.flash('error', 'Product not found.');
        
        return res.status(404).json({ message: 'Variant not found' });
      }
      req.flash('success', 'Product removed .');
      res.redirect('/admin/products');
    } catch (error) {
      console.error('Error deleting product:', error);
      res.status(500).json({ 
        error: 'Internal Server Error',
        message: 'Error deleting product' 
      });
    }
  },
  async addImage(req, res) {
      try {
        const { variantId, productId } = req.params;
        const file = req.file;
        
    
        if (!file) {
          return res.status(400).json({ error: 'No image uploaded' });
        }
    
        const imagePath = `/uploads/variants/${file.filename}`;
    
        // Find the variant and push the new image to the product_image array
        const variant = await Variant.findOne({ _id: variantId, product_id: productId });
        if (!variant) {
          return res.status(404).json({ error: 'Variant not found' });
        }
    
        variant.product_image.push(imagePath); // Add new image to array
        variant.updated_at = Date.now(); // Update timestamp
        await variant.save();
        req.flash('success', 'Image added Successfully .');
        res.status(200).json({ 
          message: 'File uploaded successfully', 
          redirectUrl: `/admin/products/${productId}` 
        });
      } catch (error) {
        console.error('Error adding image:', error);
        res.status(500).json({ error: error.message });
      }
    },
    async removeImage(req, res) {
      try {
       
        const { productId, variantId } = req.params;
        const { imageUrl } = req.body;
    
        const variant = await Variant.findOne({ _id: variantId, product_id: productId });
        if (!variant) {
          return res.status(404).json({ error: 'Variant not found' });
        }
    
        variant.product_image = variant.product_image.filter(img => img !== imageUrl);
        variant.updated_at = Date.now();
        await variant.save();
    
        // // Optionally delete the file from the server
        // const filePath = path.join(__dirname, '..', imageUrl);
        // fs.unlink(filePath, (err) => {
        //   if (err) console.error('Error deleting file:', err);
        // });
    
        res.status(200).json({ success: true });
      } catch (error) {
        console.error('Error Deleting image:', error);
        res.status(500).json({ error: error.message });
      }
    }

};

module.exports = productController;