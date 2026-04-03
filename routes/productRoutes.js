const express = require('express');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const Product = require('../models/Product');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

const router = express.Router();

// Configuration for Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'agro_market_products',
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
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
      const image = req.file ? req.file.path : undefined;
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
        product.image = req.file.path;
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

