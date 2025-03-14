const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const flash = require('connect-flash');
const methodOverride = require('method-override');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
require('dotenv').config();
const connectDB = require("./config/db");

// const User = require('./models/User');
// const adminRoutes = require('./routes/admin');
// const usersRoutes = require('./routes/users');
// const path = require('path');
const app = express();

// Database connection
connectDB();

// // Middleware
// app.set('view engine', 'ejs');
// app.set('views', path.join(__dirname, 'views')); // Ensure it's correctly set
// app.use(express.urlencoded({ extended: false }));
// app.use(express.json());
// app.use(cookieParser());
// app.use(methodOverride('_method'));
// app.use(express.static('public'));





// // Session
// app.use(
//     session({
//         secret: 'supersecretkey',
//         resave: false,
//         saveUninitialized: false,
//         cookie: { secure: false, httpOnly: true }
//     })
// );
// // Prevent caching
// app.use((req, res, next) => {
//     res.set('Cache-Control', 'no-store');
//     next();
//   });
// app.use(flash());

// app.use((req, res, next) => {
//     res.locals.messages = req.flash();
//     next();
// });
// // Passport Authentication
// passport.use(
//     new LocalStrategy(async (username, password, done) => {
//         try {
//             const user = await User.findOne({ username });
//             if (!user) return done(null, false, { message: 'User not found' });

//             const isMatch = await bcrypt.compare(password, user.password);
//             if (!isMatch) return done(null, false, { message: 'Incorrect password' });

            
//             const isAdmin = user.role === "admin"; // Declare outside the if block
//             if (!isAdmin) return done(null, false, { message: 'Only admins can access' });

//             return done(null, user);
//         } catch (err) {
//             return done(err);
//         }
//     })
// );


// passport.serializeUser((user, done) => done(null, user.id));
// passport.deserializeUser(async (id, done) => {
//     try {
//         const user = await User.findById(id);
//         done(null, user);
//     } catch (err) {
//         done(err);
//     }
// });

// app.use(passport.initialize());
// app.use(passport.session());

// // Routes
// app.use('/admin', adminRoutes);
// app.use('/', usersRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
