// routes/reviews.js
const express = require('express');
const router = express.Router();
const {
    createReview,
  getReviews,
  getReview,
  updateReview,
  deleteReview,
} = require('../controllers/reviews');

router.route('/')
  .get(getReviews)
  .post(createReview);

router.route('/:id')
  .get(getReview)
  .put(updateReview)
  .delete(deleteReview);

module.exports = router;
