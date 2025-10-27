const express = require('express');
const router = express.Router();
const reservationRouter = require('./reservations');


router.use('/:restaurantId/reservations/', reservationRouter);

module.exports = router;