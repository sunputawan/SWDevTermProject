// controllers/restaurants.js
const Restaurant = require('../models/Restaurant');

/**
 * @desc    Get all restaurants
 * @route   GET /api/v1/restaurants
 * @access  Public
 */
exports.getRestaurants = async (req, res) => {
  try {
    const restaurants = await Restaurant.find();
    return res.status(200).json({ success: true, count: restaurants.length, data: restaurants });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
};

/**
 * @desc    Get single restaurant by id
 * @route   GET /api/v1/restaurants/:id
 * @access  Public
 */
exports.getRestaurant = async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id).populate('reviews').populate('reservations');
    if (!restaurant) {
      return res.status(404).json({ success: false, error: `No restaurant with the id of ${req.params.id}` });
    }
    return res.status(200).json({ success: true, data: restaurant });
  } catch (err) {
    console.error(err);
    return res.status(400).json({ success: false, error: 'Invalid restaurant ID' });
  }
};

/**
 * @desc    Create a restaurant
 * @route   POST /api/v1/restaurants
 * @access  Admin
 */
exports.createRestaurant = async (req, res) => {
  try {
    // basic request-level validation before hitting mongoose (helps tests & early feedback)
    const required = ['name', 'address', 'district', 'province', 'postalcode', 'openTime', 'closeTime'];
    const missing = required.filter((f) => !req.body || req.body[f] === undefined || req.body[f] === '');
    if (missing.length) {
      return res.status(400).json({ success: false, error: `Missing required fields: ${missing.join(', ')}` });
    }

    const restaurant = await Restaurant.create(req.body);
    return res.status(201).json({ success: true, data: restaurant });
  } catch (err) {
    console.error(err);
    if (err && err.name === 'ValidationError') {
      return res.status(400).json({ success: false, error: err.message });
    }
    return res.status(500).json({ success: false, error: 'Server error' });
  }
};

/**
 * @desc    Update a restaurant
 * @route   PUT /api/v1/restaurants/:id
 * @access  Admin
 */
exports.updateRestaurant = async (req, res) => {
  try {
    const updated = await Restaurant.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      return res.status(404).json({ success: false, error: `No restaurant with the id of ${req.params.id}` });
    }

    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    if (err && err.name === 'ValidationError') {
      return res.status(400).json({ success: false, error: err.message });
    }
    return res.status(400).json({ success: false, error: 'Invalid restaurant ID' });
  }
};

/**
 * @desc    Delete a restaurant
 * @route   DELETE /api/v1/restaurants/:id
 * @access  Admin
 */
exports.deleteRestaurant = async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id);
    if (!restaurant) {
      return res.status(404).json({ success: false, error: `No restaurant with the id of ${req.params.id}` });
    }

    await restaurant.deleteOne();
    return res.status(200).json({ success: true, data: {} });
  } catch (err) {
    console.error(err);
    return res.status(400).json({ success: false, error: 'Invalid restaurant ID' });
  }
};
