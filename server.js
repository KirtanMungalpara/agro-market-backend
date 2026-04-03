const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  },
});

// Make io available in all route handlers via req.app.get('io')
app.set('io', io);

io.on('connection', (socket) => {
  // Each user joins a room with their own userId so we can send targeted events
  socket.on('join', (userId) => {
    if (userId) socket.join(userId);
  });

  socket.on('disconnect', () => {});
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: process.env.CLIENT_URL || '*' }));
app.use(morgan('dev'));

const uploadsPath = path.join(__dirname, 'uploads');
app.use('/uploads', express.static(uploadsPath));

app.use('/auth', authRoutes);
app.use('/products', productRoutes);
app.use('/orders', orderRoutes);
app.use('/admin', adminRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'Agro Market API running' });
});

const PORT = process.env.PORT || 5000;

const cors = require('cors');

app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true
}));

mongoose
  .connect(process.env.MONGO_URI, { dbName: 'agro_market' })
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error', err);
  });