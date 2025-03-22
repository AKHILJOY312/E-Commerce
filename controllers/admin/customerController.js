const User = require("../../models/User");

exports.customerInfo = async (req, res) => {
    try {
        let search = ""; // Use let instead of const
        if (req.query.search) {
            search = req.query.search;
        }

        let page = 1;
        if (req.query.page) {
            page = parseInt(req.query.page); // Ensure page is an integer
        }

        const limit = 5;

        const userData = await User.find({
            isAdmin: false,
            $or: [
                { name: { $regex: ".*" + search + ".*", $options: "i" } }, // Case-insensitive search
                { email: { $regex: ".*" + search + ".*", $options: "i" } }
            ],
        })
        .limit(limit)
        .skip((page - 1) * limit)
        .exec();

        const count = await User.countDocuments({
            isAdmin: false,
            $or: [
                { name: { $regex: ".*" + search + ".*", $options: "i" } },
                { email: { $regex: ".*" + search + ".*", $options: "i" } }
            ],
        });

        res.render("customers", {
            data: userData,
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            searchQuery: search,
        });

    } catch (error) {
        console.error("Error displaying the customers:", error);
        res.status(500).send("Server Error");
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