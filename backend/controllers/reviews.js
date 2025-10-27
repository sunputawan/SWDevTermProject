// controllers/reviews.js
const Review = require('../models/Review');

/**
 * @desc   Create a review
 * @route  POST /api/v1/reviews
 * @body   { user, restaurant, stars, message? }
 */
exports.createReview = async (req, res) => {
  try {
    const { user, restaurant, stars, message } = req.body;

    const review = await Review.create({ user, restaurant, stars, message });
    res.status(201).json({ success: true, data: review });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ success: false, error: err.message });
    }
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

/**
 * @desc   Get reviews (all, or filter by restaurant/user)
 * @route  GET /api/v1/reviews?restaurant=:id&user=:id&page=1&limit=10
 */
exports.getReviews = async (req, res) => {
  try {
    const { restaurant, user } = req.query;
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.max(parseInt(req.query.limit || '10', 10), 1);
    const skip = (page - 1) * limit;

    const filter = {};
    if (restaurant) filter.restaurant = restaurant;
    if (user) filter.user = user;

    const [items, total] = await Promise.all([
      Review.find(filter)
        .sort('-createdAt')
        .skip(skip)
        .limit(limit)
        .populate('user', 'name')          // adjust fields if needed
        .populate('restaurant', 'name'),   // adjust fields if needed
      Review.countDocuments(filter),
    ]);

    res.json({
      success: true,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: items,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

/**
 * @desc   Get a single review by ID
 * @route  GET /api/v1/reviews/:id
 */
exports.getReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id)
      .populate('user', 'name')
      .populate('restaurant', 'name');

    if (!review) {
      return res.status(404).json({ success: false, error: 'Review not found' });
    }

    res.json({ success: true, data: review });
  } catch (err) {
    res.status(400).json({ success: false, error: 'Invalid review ID' });
  }
};

/**
 * @desc   Update a review (stars/message)
 * @route  PUT /api/v1/reviews/:id
 * @body   { stars?, message? }
 */
exports.updateReview = async (req, res) => {
  try {
    const updates = {};
    if (req.body.stars !== undefined) updates.stars = req.body.stars;
    if (req.body.message !== undefined) updates.message = req.body.message;

    const review = await Review.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true, // ensures min/max on stars are checked
    })
      .populate('user', 'name')
      .populate('restaurant', 'name');

    if (!review) {
      return res.status(404).json({ success: false, error: 'Review not found' });
    }

    res.json({ success: true, data: review });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ success: false, error: err.message });
    }
    res.status(400).json({ success: false, error: 'Invalid review ID' });
  }
};

/**
 * @desc   Delete a review
 * @route  DELETE /api/v1/reviews/:id
 */
exports.deleteReview = async (req, res) => {
  try {
    const review = await Review.findByIdAndDelete(req.params.id);
    if (!review) {
      return res.status(404).json({ success: false, error: 'Review not found' });
    }
    // 204: No Content is conventional for deletes
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ success: false, error: 'Invalid review ID' });
  }
};
