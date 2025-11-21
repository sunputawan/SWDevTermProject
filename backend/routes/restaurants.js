const express = require('express');
const router = express.Router();

const { protect, authorize } = require('../middleware/auth');
const { addReservation, getReservations } = require('../controllers/reservations');
const {
  getRestaurants,
  getRestaurant,
  createRestaurant,
  updateRestaurant,
  deleteRestaurant,
} = require('../controllers/restaurants');

/**
 * @swagger
 * tags:
 *   - name: Reservations
 *     description: Reservation operations available under restaurant context
 */

/**
 * @swagger
 * /restaurants/{restaurantId}/reservations:
 *   get:
 *     tags:
 *       - Reservations
 *     summary: Get reservations for a specific restaurant
 *     description: Admin users get all reservations for the restaurant. Non-admin users get only their own reservations for that restaurant.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: restaurantId
 *         required: true
 *         schema:
 *           type: string
 *         description: Restaurant id (MongoDB ObjectId)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           example: 25
 *     responses:
 *       200:
 *         description: Reservations for the given restaurant
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               count: 1
 *               data:
 *                 - id: "64b7f9e8e4b0f2a9d1234567"
 *                   user: "AnyUserId"
 *                   restaurant: "AnyRestaurantId"
 *                   dateTime: "2025-11-02T19:00:00+07:00"
 *                   createdAt: "2025-11-02T19:00:00+07:00"
 *                   updatedAt: "2025-11-02T19:00:00+07:00"
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Restaurant not found
 *       500:
 *         description: Server error
 *
 *   post:
 *     tags:
 *       - Reservations
 *     summary: Create a reservation for a specific restaurant
 *     description: Creates a reservation. Restaurant id must be provided in the path. The request body must include "user" and "dateTime". Non-admin users are limited to 3 total reservations.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: restaurantId
 *         required: true
 *         schema:
 *           type: string
 *         description: Restaurant id
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - user
 *               - dateTime
 *             properties:
 *               user:
 *                 type: string
 *                 description: User ObjectId (ref User)
 *                 example: "AnyUserId"
 *               dateTime:
 *                 type: string
 *                 format: date-time
 *                 example: "2025-11-02T19:00:00+07:00"
 *     responses:
 *       201:
 *         description: Reservation created
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 id: "64b7f9e8e4b0f2a9d1234567"
 *                 user: "AnyUserId"
 *                 restaurant: "AnyRestaurantId"
 *                 dateTime: "2025-11-02T19:00:00+07:00"
 *                 createdAt: "2025-11-02T19:00:00+07:00"
 *                 updatedAt: "2025-11-02T19:00:00+07:00"
 *       400:
 *         description: Bad request (e.g., user has 3 reservations already)
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               message: "The user with ID AnyUserId has already made 3 reservations"
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Restaurant not found
 *       500:
 *         description: Server error
 */

router.route('/:restaurantId/reservations')
    .get(protect, getReservations)
    .post(protect, authorize('admin', 'user'), addReservation);


/**
 * @swagger
 * tags:
 *   - name: Restaurants
 *     description: Restaurant management operations
 */

/**
 * @swagger
 * /restaurants:
 *   get:
 *     tags:
 *       - Restaurants
 *     summary: Get all restaurants
 *     description: Public endpoint. Supports search, filter, and pagination.
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search by restaurant name
 *       - in: query
 *         name: district
 *         schema:
 *           type: string
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           example: 25
 *     responses:
 *       200:
 *         description: List of restaurants
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               count: 1
 *               page: 1
 *               total: 1
 *               data:
 *                 - _id: "64b7f9e8e4b0f2a9d1234567"
 *                   name: "Example Restaurant"
 *                   address: "123 Street"
 *                   district: "Bangkok"
 *                   province: "Bangkok"
 *                   postalCode: "10100"
 *                   tel: "0123456789"
 *                   image: "https://example.com/img.jpg"
 *                   category: "Thai"
 *                   subCategory: "Seafood"
 *                   rating: 4.2
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /restaurants:
 *   post:
 *     tags:
 *       - Restaurants
 *     summary: Create a new restaurant
 *     description: Admin only.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - address
 *             properties:
 *               name:
 *                 type: string
 *               address:
 *                 type: string
 *               district:
 *                 type: string
 *               province:
 *                 type: string
 *               postalCode:
 *                 type: string
 *               tel:
 *                 type: string
 *               image:
 *                 type: string
 *               category:
 *                 type: string
 *               subCategory:
 *                 type: string
 *               rating:
 *                 type: number
 *           example:
 *             name: "New Restaurant"
 *             address: "123 Main St"
 *             district: "Bangkok"
 *             province: "Bangkok"
 *             postalCode: "10100"
 *             tel: "0123456789"
 *             image: "https://example.com/img.jpg"
 *             category: "Thai"
 *             subCategory: "Seafood"
 *             rating: 4.5
 *     responses:
 *       201:
 *         description: Restaurant created
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 _id: "64b7f9e8e4b0f2a9d1234567"
 *       400:
 *         description: Bad request / validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /restaurants/{id}:
 *   get:
 *     tags:
 *       - Restaurants
 *     summary: Get restaurant by ID
 *     description: Public endpoint.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Restaurant ID
 *     responses:
 *       200:
 *         description: Restaurant data
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 _id: "64b7f9e8e4b0f2a9d1234567"
 *                 name: "Example Restaurant"
 *       404:
 *         description: Restaurant not found
 *       500:
 *         description: Server error
 *
 *   put:
 *     tags:
 *       - Restaurants
 *     summary: Update restaurant
 *     description: Admin only.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *           example:
 *             name: "Updated Name"
 *             address: "New Address"
 *     responses:
 *       200:
 *         description: Updated restaurant
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 _id: "64b7f9e8e4b0f2a9d1234567"
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 *       500:
 *         description: Server error
 *
 *   delete:
 *     tags:
 *       - Restaurants
 *     summary: Delete restaurant
 *     description: Admin only.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Restaurant deleted
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data: {}
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 *       500:
 *         description: Server error
 */


// Public routes
router.route('/').get(getRestaurants);
router.route('/:id').get(getRestaurant);

// Admin-only (protected) routes
router.route('/')
  .post(protect, authorize('admin'), createRestaurant);

router.route('/:id')
  .put(protect, authorize('admin'), updateRestaurant)
  .delete(protect, authorize('admin'), deleteRestaurant);

module.exports = router;
