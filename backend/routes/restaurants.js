const express = require('express');
const router = express.Router();

const reservationRouter = require('./reservations');
const { protect, authorize } = require('../middleware/auth');
const { addReservation, getReservations } = require('../controllers/reservations');

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
 *                   dateTime: "2025-11-02T19:00:00Z"
 *                   createdAt: "2025-11-02T19:00:00Z"
 *                   updatedAt: "2025-11-02T19:00:00Z"
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
 *                 example: "2025-11-02T19:00:00Z"
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
 *                 dateTime: "2025-11-02T19:00:00Z"
 *                 createdAt: "2025-11-02T19:00:00Z"
 *                 updatedAt: "2025-11-02T19:00:00Z"
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

// Mount nested reservations router so routes like
// /restaurants/:restaurantId/reservations/:id are handled.
router.use('/:restaurantId/reservations', reservationRouter);

module.exports = router;
