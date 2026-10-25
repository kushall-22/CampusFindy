require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

(async () => {
  const email = process.argv[2];
  if (!email) {
    console.log('Usage: node makeAdmin.js your-email@example.com');
    process.exit(1);
  }

  const uri = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.MONGO_URL;
  if (!uri) {
    console.log('Could not find the MongoDB address in .env. Tell me the variable name used in server.js.');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const user = await User.findOneAndUpdate({ email }, { role: 'admin' }, { new: true });
  console.log(user ? email + ' is now an admin.' : 'No user found with that email.');
  process.exit(0);
})();