const User = require('../models/User');

exports.userAuth = async (req, res, next) => {
    try {
        if (!req.session.user) {
            return res.redirect("/login");
        }

        const user = await User.findById(req.session.user);

        if (user && !user.isBlocked) {
            return next();
        } else {
            req.session.destroy(); // Clear session if user is blocked
            return res.redirect("/login");
        }
    } catch (error) {
        console.error("Error in user authentication middleware:", error);
        return res.status(500).send("Internal Server Error");
    }
};

exports.adminAuth = async (req, res, next) => {
    try {
        if (!req.session.admin) {
            return res.redirect("/admin/login");
        }

        const admin = await User.findById(req.session.admin);

        if (admin && admin.isAdmin) {
            return next();
        } else {
            req.session.destroy(); // Destroy session if not a valid admin
            return res.redirect("/admin/login");
        }
    } catch (error) {
        console.error("Error in admin authentication middleware:", error);
        return res.status(500).send("Internal Server Error");
    }
};
