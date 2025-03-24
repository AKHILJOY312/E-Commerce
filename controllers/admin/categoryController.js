const Category = require("../../models/Category");


exports.categoryInfo = async (req, res) => {
  try {
    const search = req.query.search || "";
    const page = parseInt(req.query.page) || 1;
    const limit = 3;
    const skip = (page - 1) * limit;

    const categoryData = await Category.find({
      title: { $regex: ".*" + search + ".*", $options: "i" },isDeleted:{$ne:true},
    })
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit);

    const totalCategories = await Category.countDocuments({
      title: { $regex: ".*" + search + ".*", $options: "i" },
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
      const { title, description, } = req.body;
      const newCategory = new Category({
          title,
          description,
          created_at: new Date(),
          updated_at: new Date()
      });
      await newCategory.save();
      console.log("Category added successfully.")
      req.flash("success", "Category added successfully.");
      res.redirect('/admin/category');
  } catch (error) {
      console.error('Error adding category:', error);
      res.status(500).send('Server Error');
  }
};

exports.postEditCategory = async (req, res) => {
  try {
      const { id, title, description } = req.body;

      await Category.findByIdAndUpdate(id, { title, description });

      req.flash("success", "Category updated successfully!");
      res.redirect('/admin/category');
  } catch (error) {
      console.error("Error updating category:", error);
      res.status(500).json({ success: false, message: "Failed to update category!" });
  }
};
 
exports.softDeleteCategory = async (req, res) => {
  try {
    const categoryId = req.body.id; 
    console.log('Category ID:', categoryId);

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
