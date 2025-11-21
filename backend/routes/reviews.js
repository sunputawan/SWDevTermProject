const express = require('express');
const router = express.Router();

const {
  createReview,
  getReviews,
  getReview,
  updateReview,
  deleteReview,
} = require('../controllers/reviews');

const { protect, authorize } = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   - name: Reviews
 *     description: Review management and retrieval
 *
 * components:
 *   schemas:
 *     Review:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "64b7f9e8e4b0f2a9d1234567"
 *         user:
 *           type: string
 *           description: User ObjectId (ref User)
 *           example: "64b7eaaa..."
 *         restaurant:
 *           type: string
 *           description: Restaurant ObjectId (ref Restaurant)
 *           example: "64b7ebbb..."
 *         stars:
 *           type: number
 *           format: float
 *           example: 4
 *         message:
 *           type: string
 *           example: "Great food!"
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         error:
 *           type: string
 *       example:
 *         success: false
 *         error: "Not authenticated"
 */

/**
 * @swagger
 * /reviews:
 *   get:
 *     tags:
 *       - Reviews
 *     summary: Get reviews (filterable)
 *     description: Returns reviews. Use query parameters to filter by `restaurant` or `user`. Supports pagination via `page` and `limit`.
 *     parameters:
 *       - in: query
 *         name: restaurant
 *         schema:
 *           type: string
 *         description: Restaurant id to filter reviews by
 *       - in: query
 *         name: user
 *         schema:
 *           type: string
 *         description: User id to filter reviews by
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           example: 1
 *         description: Page number (1-based)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           example: 10
 *         description: Items per page
 *     responses:
 *       200:
 *         description: A paginated list of reviews
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 total:
 *                   type: integer
 *                 page:
 *                   type: integer
 *                 pages:
 *                   type: integer
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Review'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               error: "Server error"
 */

/**
 * @swagger
 * /reviews:
 *   post:
 *     tags:
 *       - Reviews
 *     summary: Create a review
 *     description: Create a review for a restaurant. Requires authentication. User may leave a review only if they have at least one completed reservation at that restaurant. Multiple reviews are allowed.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - restaurant
 *               - stars
 *             properties:
 *               restaurant:
 *                 type: string
 *                 description: Restaurant ObjectId
 *                 example: "64b7ebbb..."
 *               stars:
 *                 type: number
 *                 description: Rating from 0 to 5
 *                 example: 5
 *               message:
 *                 type: string
 *                 description: Optional review text
 *                 example: "Loved it!"
 *     responses:
 *       201:
 *         description: Review created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Review'
 *       400:
 *         description: Validation / business rule failure (missing fields, not completed reservation, invalid stars)
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               error: "stars is required (0-5)"
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               error: "Not authenticated"
 *       404:
 *         description: Restaurant not found
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               error: "Restaurant not found"
 *       500:
 *         description: Server error
 */


/**
 * @swagger
 * /reviews/{id}:
 *   get:
 *     tags:
 *       - Reviews
 *     summary: Get a single review by id
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Review id
 *     responses:
 *       200:
 *         description: Review retrieved
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 id: "64b7f9e8e4b0f2a9d1234567"
 *                 user: "64b7eaaa..."
 *                 restaurant: "64b7ebbb..."
 *                 stars: 5
 *                 message: "Great!"
 *       404:
 *         description: Review not found
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               error: "Review not found"
 *       400:
 *         description: Invalid id
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               error: "Invalid review ID"
 */


/**
 * @swagger
 * /reviews/{id}:
 *   put:
 *     tags:
 *       - Reviews
 *     summary: Update a review
 *     description: Update review fields (stars, message). Only the review owner or an admin can update.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Review id
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               stars:
 *                 type: number
 *                 example: 4
 *               message:
 *                 type: string
 *                 example: "Updated message"
 *     responses:
 *       200:
 *         description: Updated review returned
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 id: "64b7f9e8e4b0f2a9d1234567"
 *                 user: "64b7eaaa..."
 *                 restaurant: "64b7ebbb..."
 *                 stars: 4
 *                 message: "Updated"
 *       400:
 *         description: Validation or invalid id
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               error: "Invalid review ID"
 *       403:
 *         description: Not authorized to update
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               error: "Not authorized to update this review"
 *       404:
 *         description: Review not found
 *       500:
 *         description: Server error
 */


/**
 * @swagger
 * /reviews/{id}:
 *   delete:
 *     tags:
 *       - Reviews
 *     summary: Delete a review
 *     description: Delete a review. Only the review owner or an admin can delete.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Review id
 *     responses:
 *       204:
 *         description: Successfully deleted (No Content)
 *       403:
 *         description: Not authorized to delete
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               error: "Not authorized to delete this review"
 *       404:
 *         description: Review not found
 *       400:
 *         description: Invalid id
 *       500:
 *         description: Server error
 */
router.get('/', getReviews);
router.get('/:id', getReview);
router.post('/', protect, authorize('admin', 'user'), createReview);
router.put('/:id', protect, authorize('admin', 'user'), updateReview);
router.delete('/:id', protect, authorize('admin', 'user'), deleteReview);

module.exports = router;
