const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
  destination: "./public/uploads/variants/",
  filename: (req, file, cb) => {
    cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    return mimetype && extname ? cb(null, true) : cb(new Error("Only images allowed!"));
  },
}).array("variantImages", 3); // Allow max 3 images

module.exports = (req, res, next) => {
  upload(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_COUNT') {
        req.flash('error', 'You can upload a maximum of 3 images.');
      } else if (err.message === 'Only images (JPEG, JPG, PNG, GIF) are allowed!') {
        req.flash('error', err.message);
      } else {
        req.flash('error', 'An error occurred while uploading images.');
      }
      return res.redirect(`/admin/products/${req.params.productId}`);
    }
    next();
  });
};
