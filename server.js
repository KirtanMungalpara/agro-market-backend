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
const mandiRoutes = require('./routes/mandiRoutes');

const app = express();
const server = http.createServer(app);

// ✅ CORS CONFIG (ONLY ONCE)
const corsOptions = {
  origin: process.env.CLIENT_URL, // frontend URL (IMPORTANT)
  credentials: true,
};

app.use(cors(corsOptions));

// ✅ SOCKET.IO CONFIG
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  },
});

app.set('io', io);

io.on('connection', (socket) => {
  socket.on('join', (userId) => {
    if (userId) socket.join(userId);
  });
});

// ✅ MIDDLEWARE
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// ✅ STATIC FILES
const uploadsPath = path.join(__dirname, 'uploads');
app.use('/uploads', express.static(uploadsPath));

// ✅ ROUTES
app.use('/auth', authRoutes);
app.use('/products', productRoutes);
app.use('/orders', orderRoutes);
app.use('/admin', adminRoutes);
app.use('/mandi-rates', mandiRoutes);

// ✅ TEST ROUTE
app.get('/', (req, res) => {
  res.json({ message: 'Agro Market API running' });
});

// ✅ PORT
const PORT = process.env.PORT || 5000;

// ✅ DB CONNECTION
mongoose
  .connect(process.env.MONGO_URI, { dbName: 'agro_market' })
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
  });