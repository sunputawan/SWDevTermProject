// controllers/reviews.js
const Review = require('../models/Review');
const Reservation = require('../models/Reservation');
const Restaurant = require('../models/Restaurant');

/**
 * @desc   Create a review
 * @route  POST /api/v1/reviews
 *         POST /api/v1/restaurants/:restaurantId/reviews
 * @body   { restaurant, stars, message? }
 * @note   Requires `protect` middleware so req.user is available.
 *         User may create a review only if they have at least one Reservation
 *         for that restaurant with status === 'completed'. Multiple reviews allowed.
 */
exports.createReview = async (req, res) => {
  try {
    // protect middleware must populate req.user
    const userId = req.user && req.user.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const { restaurant, stars, message } = req.body;

    if (!restaurant) {
      return res.status(400).json({ success: false, error: 'restaurant is required' });
    }

    if (stars === undefined || stars === null) {
      return res.status(400).json({ success: false, error: 'stars is required (0-5)' });
    }

    const starsNum = Number(stars);
    if (!Number.isFinite(starsNum) || starsNum < 0 || starsNum > 5) {
      return res.status(400).json({ success: false, error: 'stars must be a number between 0 and 5' });
    }

    // verify restaurant exists (don't call .select() so tests can mock findById easily)
    const restaurantDoc = await Restaurant.findById(restaurant);
    if (!restaurantDoc) {
      return res.status(404).json({ success: false, error: 'Restaurant not found' });
    }

    // check for at least one completed reservation by this user for this restaurant
    const completedReservation = await Reservation.findOne({
      user: userId,
      restaurant,
      status: 'completed'
    });

    if (!completedReservation) {
      return res.status(400).json({
        success: false,
        error: 'User can leave a review only after having at least one completed reservation at this restaurant'
      });
    }

    // create review
    const review = await Review.create({
      user: userId,
      restaurant,
      stars: starsNum,
      message
    });

    return res.status(201).json({ success: true, data: review });
  } catch (err) {
    if (err && err.name === 'ValidationError') {
      return res.status(400).json({ success: false, error: err.message });
    }
    // log the Error object as the first argument so tests can assert on it
    console.error(err);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
};

/**
 * @desc   Get reviews (all, or filter by restaurant/user)
 * @route  GET /api/v1/reviews?restaurant=:id&user=:id&page=1&limit=10
 *         GET /api/v1/restaurants/:restaurantId/reviews
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
        .populate('user', 'name')
        .populate('restaurant', 'name'),
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
    console.error(err);
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
    console.error(err);
    return res.status(400).json({ success: false, error: 'Invalid review ID' });
  }
};

/**
 * @desc   Update a review (stars/message)
 * @route  PUT /api/v1/reviews/:id
 * @body   { stars?, message? }
 * @note   Only review owner or admin can update.
 */
exports.updateReview = async (req, res) => {
  try {
    // find the review first (so we can check owner)
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ success: false, error: 'Review not found' });
    }

    // owner or admin only
    if (review.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Not authorized to update this review' });
    }

    const updates = {};
    if (req.body.stars !== undefined) updates.stars = req.body.stars;
    if (req.body.message !== undefined) updates.message = req.body.message;

    // Use findByIdAndUpdate to perform the update (tests often return a plain object).
    const updatedRaw = await Review.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    // Attempt to re-fetch populated document; if that fails, fall back to updatedRaw.
    let updated = updatedRaw;
    if (updatedRaw && updatedRaw._id) {
      try {
        const populated = await Review.findById(updatedRaw._id)
          .populate('user', 'name')
          .populate('restaurant', 'name');
        if (populated) updated = populated;
      } catch (e) {
        // if populate re-fetch fails (e.g. in tests with plain mocks), use updatedRaw
        // but still log the minor issue
        console.error(e);
      }
    }

    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    if (err && err.name === 'ValidationError') {
      return res.status(400).json({ success: false, error: err.message });
    }
    return res.status(400).json({ success: false, error: 'Invalid review ID' });
  }
};

/**
 * @desc   Delete a review
 * @route  DELETE /api/v1/reviews/:id
 * @note   Only review owner or admin can delete.
 */
exports.deleteReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ success: false, error: 'Review not found' });
    }

    // owner or admin
    if (review.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Not authorized to delete this review' });
    }

    await Review.findByIdAndDelete(req.params.id);

    // 204 No Content is conventional for successful deletes w/o response body
    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(400).json({ success: false, error: 'Invalid review ID' });
  }
};
