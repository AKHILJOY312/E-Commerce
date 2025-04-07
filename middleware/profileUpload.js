const multer = require("multer");
const path = require("path");

const profileStorage = multer.diskStorage({
  destination: "./public/uploads/profile/", // Directory for profile images
  filename: (req, file, cb) => {
    cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
  },
});

const profileUpload = multer({
  storage: profileStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    return mimetype && extname ? cb(null, true) : cb(new Error("Only images (JPEG, JPG, PNG, GIF) are allowed!"));
  },
}).single("profileImage"); // Single file with field name "profileImage"

module.exports = (req, res, next) => {
  profileUpload(req, res, (err) => {
    if (err) {
      req.flash("error", err.message || "An error occurred while uploading the profile image.");
      return res.redirect("/user/edit-profile");
    }
    next();
  });
};