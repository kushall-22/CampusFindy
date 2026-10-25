require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const itemRoutes = require('./routes/itemRoutes');
const claimRoutes = require('./routes/claimRoutes');
const myItemsRoutes = require('./routes/myItemsRoutes');

const authMiddleware = require('./middleware/authMiddleware');
const requireAdmin = require('./middleware/requireAdmin');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

app.use(cors());
app.use(express.json());
app.use('/api/admin', authMiddleware, requireAdmin, adminRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/claims', claimRoutes);
app.use('/api/my-items', myItemsRoutes);

// Test route
app.get('/', (req, res) => {
  res.send('Campus Findy backend is running');
});

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});