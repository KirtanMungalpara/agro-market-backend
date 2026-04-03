const express = require('express');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const Product = require('../models/Product');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

const router = express.Router();

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

    res.status(201).json(order);
  } catch (err) {
    res.status(500).json({ message: 'Failed to create order', error: err.message });
  }
});

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
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update status', error: err.message });
  }
});

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

    res.status(201).json({ payment, order });
  } catch (err) {
    res.status(500).json({ message: 'Payment failed', error: err.message });
  }
});

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
