const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const flash = require("connect-flash");
const methodOverride = require("method-override");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv").config();
const connectDB = require("./config/db");
const passport = require("./config/passport");

const adminRoutes = require("./routes/adminRoutes");
const usersRoutes = require("./routes/usersRoutes");
const path = require("path");
const app = express();


connectDB();


app.set("view engine", "ejs");
app.set("views", [path.join(__dirname, "views/user"), path.join(__dirname, "views/admin")]);

//  Middleware
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cookieParser());
app.use(methodOverride("_method"));
app.use(express.static("public"));


app.use(
  session({
    secret: process.env.SESSION_SECRET || "default_secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      httpOnly: true,
      maxAge: 72 * 60 * 60 * 1000, 
    },
  })
);


app.use(passport.initialize());
app.use(passport.session());


app.use(flash());


app.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});


app.use((req, res, next) => {
  res.locals.messages = req.flash();
  next();
});
app.use((req, res, next) => {
  res.locals.username = req.session.username || null; // Pass username to views
  next();
});


app.use("/", usersRoutes);
app.use("/admin", adminRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(` Server running on port ${PORT}`));
