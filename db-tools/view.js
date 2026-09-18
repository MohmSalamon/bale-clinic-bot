const mongoose = require("mongoose");
require("dotenv").config();

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    const users = await mongoose.connection.db.collection("users").find().toArray();
    console.log(users);
    mongoose.connection.close();
  })
  .catch(err => console.log(err));
