const express = require('express');
const router = express.Router();

const BASE_RATES = [
  { id: '1', crop: 'Wheat (Lok-1)', category: 'Cereals', location: 'Indore, MP', quantity: 1240, minBase: 2100, maxBase: 2450, baseModal: 2325 },
  { id: '2', crop: 'Tomato (Hybrid)', category: 'Vegetables', location: 'Nashik, MH', quantity: 450, minBase: 1200, maxBase: 1800, baseModal: 1550 },
  { id: '3', crop: 'Onion (Red)', category: 'Vegetables', location: 'Lasalgaon, MH', quantity: 3800, minBase: 1800, maxBase: 2200, baseModal: 2040 },
  { id: '4', crop: 'Mustard Seed', category: 'Oilseeds', location: 'Jaipur, RJ', quantity: 890, minBase: 5200, maxBase: 5800, baseModal: 5640 },
  { id: '5', crop: 'Soybean', category: 'Oilseeds', location: 'Mumbai APMC', quantity: 2100, minBase: 4400, maxBase: 4800, baseModal: 4600 },
  { id: '6', crop: 'Cotton (Long Staple)', category: 'Fibers', location: 'Rajkot, GJ', quantity: 720, minBase: 6500, maxBase: 7100, baseModal: 6800 },
];

router.get('/', (req, res) => {
  // Generate slightly randomized real-time fluctuations
  const now = new Date();
  // Using hour block to make it stable but slowly changing
  const hourFactor = now.getHours(); 

  const liveRates = BASE_RATES.map(item => {
    // Generate a pseudo-random fluctuation between -2.0% and +2.0%
    const fluctuationStr = ((item.baseModal * hourFactor) % 5) - 2; 
    const isUp = fluctuationStr >= 0;
    
    // Calculate new current prices
    const curMin = Math.floor(item.minBase * (1 + (fluctuationStr/100)));
    const curMax = Math.floor(item.maxBase * (1 + (fluctuationStr/100)));
    const curModal = Math.floor(item.baseModal * (1 + (fluctuationStr/100)));

    return {
      id: item.id,
      crop: item.crop,
      category: item.category,
      location: item.location,
      quantity: item.quantity,
      minPrice: curMin,
      maxPrice: curMax,
      modalPrice: curModal,
      trend: isUp ? 'up' : 'down',
      trendPercent: Math.abs(fluctuationStr).toFixed(1)
    };
  });

  return res.status(200).json({ success: true, timestamp: now.toISOString(), data: liveRates });
});

module.exports = router;
