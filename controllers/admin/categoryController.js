const Category = require("../../models/Category");


exports.categoryInfo = async (req, res) => {
  try {
    const search = req.query.search || "";
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;

    const categoryData = await Category.find({
      title: { $regex: ".*" + search + ".*", $options: "i" },isDeleted:{$ne:true},
    })
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit);

    const totalCategories = await Category.countDocuments({
      title: { $regex: ".*" + search + ".*", $options: "i" },isDeleted: { $ne: true }
    });

    const totalPages = Math.ceil(totalCategories / limit);
    
   
    res.render("category", {
      cat: categoryData,
      currentPage: page,
      totalPages: totalPages,
      totalCategories: totalCategories,
      searchQuery: search,
    });
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.redirect("/admin/404page");
  }
};

// Toggle category status
exports.listCategory = async (req, res) => {
  try {
      await Category.findByIdAndUpdate(req.query.id, { status: 'listed' });
      req.flash("success", "Category added to the list.");
      res.redirect('/admin/category');
  } catch (error) {
      console.error('Error listing category:', error);
      res.status(500).send('Server Error');
  }
};

exports.unlistCategory = async (req, res) => {
  try {
      await Category.findByIdAndUpdate(req.query.id, { status: 'unlisted' });
      req.flash("success", "Category removed From the list.");
      res.redirect('/admin/category');
  } catch (error) {
      console.error('Error unlisting category:', error);
      res.status(500).send('Server Error');
  }
};


exports.addCategory = async (req, res) => {
  try {
    const { title, description } = req.body;

    // Validate input
    if (!title || !title.trim()) {
      req.flash("error", "Category title is required and cannot be empty.");
      return res.redirect('/admin/category');
    }

    const trimmedTitle = title.trim();
    
    // Validate title length
    if (trimmedTitle.length < 3 || trimmedTitle.length > 50) {
      req.flash("error", "Category title must be between 3 and 50 characters.");
      return res.redirect('/admin/category');
    }

    // Validate description
    if (description && description.trim().length === 0) {
      req.flash("error", "Description cannot be empty if provided.");
      return res.redirect('/admin/category');
    }
    if (description && description.length > 500) {
      req.flash("error", "Description cannot exceed 500 characters.");
      return res.redirect('/admin/category');
    }

    // Check for existing category
    const existingCategory = await Category.findOne({ 
      title: { $regex: new RegExp(`^${trimmedTitle}$`, 'i') }
    });
    if (existingCategory) {
      req.flash("error", "A category with this name already exists.");
      return res.redirect('/admin/category');
    }

    const newCategory = new Category({
      title: trimmedTitle,
      description: description?.trim() || '',
      created_at: new Date(),
      updated_at: new Date()
    });
    
    await newCategory.save();
    req.flash("success", "Category added successfully.");
    res.redirect('/admin/category');
  } catch (error) {
    console.error('Error adding category:', error);
    req.flash("error", "Failed to add category. Please try again.");
    res.redirect('/admin/category');
  }
};

exports.postEditCategory = async (req, res) => {
  try {
    const { id, title, description } = req.body;

    // Validate ID
    if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
      req.flash("error", "Invalid category ID.");
      return res.redirect('/admin/category');
    }

    // Validate title
    if (!title || !title.trim()) {
      req.flash("error", "Category title is required and cannot be empty.");
      return res.redirect('/admin/category');
    }

    const trimmedTitle = title.trim();

    // Validate title length
    if (trimmedTitle.length < 3 || trimmedTitle.length > 50) {
      req.flash("error", "Category title must be between 3 and 50 characters.");
      return res.redirect('/admin/category');
    }

    // Validate description
    if (description && description.trim().length === 0) {
      req.flash("error", "Description cannot be empty if provided.");
      return res.redirect('/admin/category');
    }
    if (description && description.length > 500) {
      req.flash("error", "Description cannot exceed 500 characters.");
      return res.redirect('/admin/category');
    }

    // Check for existing category with same title (excluding current category)
    const existingCategory = await Category.findOne({ 
      title: { $regex: new RegExp(`^${trimmedTitle}$`, 'i') },
      _id: { $ne: id }
    });
    if (existingCategory) {
      req.flash("error", "A category with this name already exists.");
      return res.redirect('/admin/category');
    }

    // Verify category exists
    const category = await Category.findById(id);
    if (!category) {
      req.flash("error", "Category not found.");
      return res.redirect('/admin/category');
    }

    await Category.findByIdAndUpdate(id, { 
      title: trimmedTitle,
      description: description?.trim() || '',
      updated_at: new Date()
    });

    req.flash("success", "Category updated successfully!");
    res.redirect('/admin/category');
  } catch (error) {
    console.error("Error updating category:", error);
    req.flash("error", "Failed to update category. Please try again.");
    res.redirect('/admin/category');
  }
};
 
exports.softDeleteCategory = async (req, res) => {
  try {
    const categoryId = req.body.id; 

    const updatedCategory = await Category.findByIdAndUpdate(
      categoryId,
      { isDeleted: true },
      { new: true } 
    );

    if (!updatedCategory) {
      return res.status(404).json({ 
        success: false, 
        message: 'Category not found' 
      });
    }

    res.status(200).json({ 
      success: true, 
      message: 'Category soft deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete category' 
    });
  }
};
