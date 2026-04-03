const express = require('express');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const Product = require('../models/Product');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

const router = express.Router();

// ── Place Order (Retailer / Wholesaler) ──────────────────────────────────────
router.post('/', protect, authorizeRoles('retailer', 'wholesaler'), async (req, res) => {
  try {
    const { productId, quantity, pricePerUnit } = req.body;
    const product = await Product.findById(productId).populate('farmer');
    if (!product) return res.status(404).json({ message: 'Product not found' });
    if (product.quantity < quantity) {
      return res.status(400).json({ message: 'Not enough stock' });
    }

    const totalPrice = quantity * pricePerUnit;
    product.quantity -= quantity;
    await product.save();

    const order = await Order.create({
      product: product._id,
      buyer: req.user._id,
      farmer: product.farmer._id,
      buyerRole: req.user.role,
      quantity,
      pricePerUnit,
      totalPrice,
    });

    // Populate for the socket payload so frontends get full data immediately
    const populated = await Order.findById(order._id)
      .populate('product', 'name type image')
      .populate('buyer', 'name role')
      .populate('farmer', 'name');

    const io = req.app.get('io');

    // 1. Notify the farmer — new order arrived
    io.to(order.farmer.toString()).emit('new_order', populated);

    // 2. Notify the buyer — their order list should update
    io.to(req.user._id.toString()).emit('order_placed', populated);

    // 3. Broadcast to everyone for home-page live stats
    const totalOrders = await Order.countDocuments();
    io.emit('stats_update', { totalOrders });

    // 4. Broadcast updated product so product lists refresh stock everywhere
    io.emit('product_updated', {
      _id: product._id.toString(),
      quantity: product.quantity,
    });

    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: 'Failed to create order', error: err.message });
  }
});

// ── Buyer orders ─────────────────────────────────────────────────────────────
router.get('/buyer/:id', protect, async (req, res) => {
  try {
    if (req.user._id.toString() !== req.params.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const orders = await Order.find({ buyer: req.params.id })
      .populate('product')
      .populate('farmer', 'name');
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch buyer orders', error: err.message });
  }
});

// ── Farmer orders ─────────────────────────────────────────────────────────────
router.get('/farmer/:id', protect, async (req, res) => {
  try {
    if (req.user._id.toString() !== req.params.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const orders = await Order.find({ farmer: req.params.id })
      .populate('product')
      .populate('buyer', 'name role');
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch farmer orders', error: err.message });
  }
});

// ── Update order status (Farmer: Accept / Reject / Deliver) ──────────────────
router.put('/:id/status', protect, authorizeRoles('farmer'), async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findById(req.params.id).populate('farmer');
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.farmer._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    if (status === 'Delivered' && !order.isPaid) {
      return res.status(400).json({ message: 'Order must be paid before marking delivered' });
    }

    order.status = status;
    await order.save();

    const populated = await Order.findById(order._id)
      .populate('product', 'name type image')
      .populate('buyer', 'name role')
      .populate('farmer', 'name');

    const io = req.app.get('io');

    // Notify the buyer that their order status changed
    io.to(order.buyer.toString()).emit('order_status_changed', populated);

    // Notify the farmer's own dashboard to stay in sync
    io.to(req.user._id.toString()).emit('order_status_changed', populated);

    // Update admin stats if delivered (revenue changes)
    if (status === 'Delivered') {
      const totalOrders = await Order.countDocuments();
      io.emit('stats_update', { totalOrders });
    }

    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update status', error: err.message });
  }
});

// ── Pay for order (Retailer / Wholesaler) ────────────────────────────────────
router.post('/:id/pay', protect, authorizeRoles('retailer', 'wholesaler'), async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('product')
      .populate('farmer', 'name')
      .populate('buyer', 'name role');
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.buyer._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    if (order.status !== 'Accepted') {
      return res.status(400).json({ message: 'Order must be accepted by farmer before payment' });
    }

    const payment = await Payment.create({
      order: order._id,
      buyer: req.user._id,
      amount: order.totalPrice,
      paymentStatus: 'Success',
    });

    order.isPaid = true;
    await order.save();

    const io = req.app.get('io');

    // Notify farmer that payment was received — they can now mark as delivered
    io.to(order.farmer._id.toString()).emit('payment_received', {
      orderId: order._id,
      isPaid: true,
      amount: order.totalPrice,
      buyerName: order.buyer.name,
    });

    // Notify buyer their payment history updated
    io.to(req.user._id.toString()).emit('payment_done', {
      orderId: order._id,
      isPaid: true,
    });

    // Update admin revenue stats
    const Payment2 = require('../models/Payment');
    const totalRevenueAgg = await Payment2.aggregate([
      { $match: { paymentStatus: 'Success' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const totalRevenue = totalRevenueAgg[0]?.total || 0;
    io.emit('stats_update', { totalRevenue });

    res.status(201).json({ payment, order });
  } catch (err) {
    res.status(500).json({ message: 'Payment failed', error: err.message });
  }
});

// ── Payment history for buyer ─────────────────────────────────────────────────
router.get('/payments/buyer/:id', protect, async (req, res) => {
  try {
    if (req.user._id.toString() !== req.params.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const payments = await Payment.find({ buyer: req.params.id })
      .sort({ createdAt: -1 })
      .populate({
        path: 'order',
        populate: [
          { path: 'product', select: 'name type' },
          { path: 'farmer', select: 'name' },
        ],
      });
    res.json(payments);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch payments', error: err.message });
  }
});

module.exports = router;