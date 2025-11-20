const express = require('express');
const {
  getReservations,
  getReservation,
  addReservation,
  updateReservation,
  deleteReservation,
  markCompleted,
} = require('../controllers/reservations');

const router = express.Router({ mergeParams: true });
const { protect, authorize } = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   - name: Reservations
 *     description: Reservation management operations
 */

/**
 * @swagger
 * /reservations:
 *   get:
 *     tags:
 *       - Reservations
 *     summary: Get reservations - admin sees all; non-admin sees own
 *     description: Returns reservations. Admin users receive all reservations. Non-admin users receive only their own reservations.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           example: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           example: 25
 *         description: Items per page
 *     responses:
 *       200:
 *         description: A list of reservations
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 count:
 *                   type: integer
 *                   example: 2
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         example: "64b7f9e8e4b0f2a9d1234567"
 *                       user:
 *                         type: string
 *                         description: User ObjectId (ref User)
 *                         example: "AnyUserId"
 *                       restaurant:
 *                         type: string
 *                         description: Restaurant ObjectId (ref Restaurant)
 *                         example: "AnyRestaurantId"
 *                       dateTime:
 *                         type: string
 *                         format: date-time
 *                         example: "2025-11-02T19:00:00Z"
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                         example: "2025-11-02T19:00:00Z"
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *                         example: "2025-11-02T19:00:00Z"
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               message: "Not authorized to access this route"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               message: "Server error"
 */
router.route('/').get(protect, getReservations);

/**
 * @swagger
 * /reservations/{id}:
 *   get:
 *     tags:
 *       - Reservations
 *     summary: Get a reservation by id
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Reservation id (MongoDB ObjectId)
 *     responses:
 *       200:
 *         description: Reservation retrieved
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
 *       404:
 *         description: Reservation not found
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               message: "No reservation with the id of 64b7f9e8e4b0f2a9d1234567"
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 *
 *   put:
 *     tags:
 *       - Reservations
 *     summary: Update a reservation by id
 *     description: Only the reservation owner or an admin may update a reservation.
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
 *       200:
 *         description: Updated reservation returned
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 id: "64b7f9e8e4b0f2a9d1234567"
 *                 user: "AnyUserId"
 *                 restaurant: "AnyRestaurantId"
 *                 dateTime: "2025-11-02T19:00:00Z"
 *       400:
 *         description: Bad request (validation)
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               message: "Invalid input"
 *       401:
 *         description: Not authorized to update
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               message: "User is not authorized to update this reservation"
 *       404:
 *         description: Not found
 *       500:
 *         description: Server error
 *
 *   delete:
 *     tags:
 *       - Reservations
 *     summary: Delete a reservation by id
 *     description: Only the reservation owner or an admin may delete.
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
 *         description: Successfully deleted
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data: {}
 *       401:
 *         description: Not authorized
 *       404:
 *         description: Not found
 *       500:
 *         description: Server error
 */
router.route('/:id')
  .get(protect, getReservation)
  .put(protect, authorize('admin', 'user'), updateReservation)
  .delete(protect, authorize('admin', 'user'), deleteReservation);


/**
 * @swagger
 * /reservations/{id}/complete:
 *   post:
 *     tags:
 *       - Reservations
 *     summary: Mark reservation as completed (attended)
 *     description: Mark a reservation as `completed`. Only the reservation owner or an admin may mark completed. Non-admin users can only mark completed after the reservation's dateTime (server enforces).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Reservation id
 *     responses:
 *       200:
 *         description: Reservation marked completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Reservation'
 *       400:
 *         description: Bad request (e.g., cannot mark completed before reservation time)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Not authorized
 *       404:
 *         description: Reservation not found
 *       500:
 *         description: Server error
 */
router.post('/:id/complete', protect, authorize('admin','user'), markCompleted);


module.exports = router;
