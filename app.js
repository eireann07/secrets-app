require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");  //passport-local implied in pLM
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require("mongoose-findorcreate");

const app = express();

app.set('view engine', 'ejs');
app.use(express.static("public"));
app.use(bodyParser.urlencoded({
  extended: true
}));
//Session MUST go here
app.use(session({
  secret: process.env.SECRET,
  resave: false,
  saveUninitialized: false
  //must use American spelling
}));

app.use(passport.initialize());
app.use(passport.session());

// SET UPS
//Persist to mongodb
mongoose.connect("mongodb+srv://admin-erin:9fCI3XYStnn3p3sA@cluster0.vcdx1.mongodb.net/userDB");

const userSchema = new mongoose.Schema ({
  email: String,
  password: String,
  googleId: String,
  secret: String
});
//in order to have plugin, be sure that it's a Mongoose schema and not a JS obj
//Hash & salt user
userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate)

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser((user, done) => {
  done(null, user.id);
});
passport.deserializeUser((id, done) => {
  User.findById(id, (err, user) => {
    done(err, user);
  });
});

//Google OAuth
passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "https://quiet-wave-88262.herokuapp.com/auth/google/secrets",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

//ROUTES
//Get requests
app.get("/", (req, res) => {
  res.render("home");
})

//Google OAuth
app.get("/auth/google",
  passport.authenticate("google", { scope: ["profile"] })
);

app.get("/auth/google/secrets",
  passport.authenticate("google", { failureRedirect: "/login" }),
  function(req, res) {
    // Successful authentication, redirect to /secrets.
    res.redirect("/secrets");
  });

app.get("/login", (req, res) => {
  res.render("login");
});

app.get("/register", (req, res) => {
  res.render("register");
});

app.get("/secrets", (req, res) => {
  User.find({"secret":{$ne: null}}, (err, foundUsers) => {
    if (err) {
      console.log(err);
    } else {
      if (foundUsers) {
        res.render("secrets", {usersWithSecrets: foundUsers});
      }
    }
  });
});

app.get("/submit", (req, res) => {
  if (req.isAuthenticated()){
    res.render("submit");
  } else {
    res.redirect("/login");
  }
})

app.post("/submit", (req, res) => {
  const submittedSecret = req.body.secret;

  User.findById(req.user.id, (err, foundUser) => {
    if (err) {
      console.log(err);
    } else {
      if (foundUser) {
        foundUser.secret = submittedSecret;
        foundUser.save(() => {
          res.redirect("/secrets");
        });
      }
    }
  });
});
//https://stackoverflow.com/questions/72336177/error-reqlogout-requires-a-callback-function
app.get("/logout", (req, res) => {
  req.logout(req.user, err => {
    if(err) return next(err);
    res.redirect("/");
  });
});

//Post requests
app.post("/register", (req, res) =>{
  User.register({username: req.body.username}, req.body.password, (err, user) =>{
    if (err){
      console.log(err);
      res.redirect("/register");
    } else {
      passport.authenticate("local")(req, res, (err) =>{
        res.redirect("/secrets");
      })
    }
  })

});

app.post("/login", (req, res) => {
  const user = new User({
    username: req.body.username,
    password: req.body.password
  });
  req.login(user, (err) =>{
    if (err) {
      console.log(err);
    } else {
      passport.authenticate("local")(req, res, (err) => {
        res.redirect("/secrets");
      })
    }
  })
});

let port = process.env.PORT;
if (port == null || port == "") {
  port = 3000;
}

app.listen(port, () => {
  console.log("Server started running successfully");
});
