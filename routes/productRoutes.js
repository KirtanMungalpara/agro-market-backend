const express = require('express');
const multer = require('multer');
const path = require('path');
const Product = require('../models/Product');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

const router = express.Router();

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, path.join(__dirname, '..', 'uploads'));
  },
  filename(req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

router.get('/', async (req, res) => {
  try {
    const products = await Product.find().populate('farmer', 'name');
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch products', error: err.message });
  }
});

router.post(
  '/',
  protect,
  authorizeRoles('farmer'),
  upload.single('image'),
  async (req, res) => {
    try {
      const { name, category, type, quantity, retailPrice, wholesalePrice, notes } = req.body;
      const image = req.file ? `/uploads/${req.file.filename}` : undefined;
      const product = await Product.create({
        name,
        category,
        type,
        quantity,
        retailPrice,
        wholesalePrice,
        notes,
        farmer: req.user._id,
        image,
      });
      res.status(201).json(product);
    } catch (err) {
      res.status(500).json({ message: 'Failed to create product', error: err.message });
    }
  }
);

router.get('/farmer/me', protect, authorizeRoles('farmer'), async (req, res) => {
  try {
    const products = await Product.find({ farmer: req.user._id });
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch farmer products', error: err.message });
  }
});

router.put(
  '/:id',
  protect,
  authorizeRoles('farmer'),
  upload.single('image'),
  async (req, res) => {
    try {
      const product = await Product.findOne({ _id: req.params.id, farmer: req.user._id });
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }

      const fields = ['name', 'category', 'type', 'quantity', 'retailPrice', 'wholesalePrice', 'notes'];
      fields.forEach((field) => {
        if (req.body[field] !== undefined) product[field] = req.body[field];
      });
      if (req.file) {
        product.image = `/uploads/${req.file.filename}`;
      }

      const updated = await product.save();
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: 'Failed to update product', error: err.message });
    }
  }
);

router.delete('/:id', protect, authorizeRoles('farmer', 'admin'), async (req, res) => {
  try {
    const query =
      req.user.role === 'admin'
        ? { _id: req.params.id }
        : { _id: req.params.id, farmer: req.user._id };
    const product = await Product.findOneAndDelete(query);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete product', error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate('farmer', 'name');
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch product', error: err.message });
  }
});

module.exports = router;

