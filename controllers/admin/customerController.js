const User = require("../../models/User");

exports.customerInfo = async (req, res) => {
    try {
        

        const search = req.query.search ? req.query.search.trim() : "";
        const page = parseInt(req.query.page) || 1; // Default to page 1
        const limit = 5; // Items per page

        // Search query filter
        const searchFilter = {
            isAdmin: false,
            $or: [
                { name: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } }
            ]
        };

        // Fetch users with pagination
        const [userData, count] = await Promise.all([
            User.find(searchFilter)
                .sort({ created_at: -1 }) // Ensure correct field name
                .skip((page - 1) * limit)
                .limit(limit),
            User.countDocuments(searchFilter)
        ]);

        res.render("customers", {
            data: userData,
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            searchQuery: search
        });

    } catch (error) {
        console.error("Error fetching customers:", error);
        res.status(500).render("error", { message: "Internal Server Error" });
    }
};



exports.userBlocked = async (req, res) => {
    try {
        let id = req.query.id;
        await User.updateOne({ _id: id }, { $set: { isActive: false } }); // Setting isActive to false (Blocked)
        res.redirect("/admin/users");
    } catch (error) {
        console.error("Error blocking user:", error);
        res.redirect("/404page");
    }
};

exports.userUnblocked = async (req, res) => {
    try {
        let id = req.query.id;
        await User.updateOne({ _id: id }, { $set: { isActive: true } }); // Setting isActive to true (Unblocked)
        res.redirect("/admin/users");
    } catch (error) {
        console.error("Error unblocking user:", error);
        res.redirect("/404page");
    }
};