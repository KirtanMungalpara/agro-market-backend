const express = require('express');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/stats', protect, authorizeRoles('admin'), async (req, res) => {
  try {
    const [totalUsers, totalProducts, totalOrders, totalRevenueAgg] = await Promise.all([
      User.countDocuments(),
      Product.countDocuments(),
      Order.countDocuments(),
      Payment.aggregate([
        { $match: { paymentStatus: 'Success' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
    ]);

    const totalRevenue = totalRevenueAgg[0]?.total || 0;

    res.json({ totalUsers, totalProducts, totalOrders, totalRevenue });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch stats', error: err.message });
  }
});

router.delete('/users/:id', protect, authorizeRoles('admin'), async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete user', error: err.message });
  }
});

router.delete('/products/:id', protect, authorizeRoles('admin'), async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete product', error: err.message });
  }
});

module.exports = router;

