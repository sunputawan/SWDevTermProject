// controllers/reservations.js
const Reservation = require('../models/Reservation');
const Restaurant = require('../models/Restaurant');
const { DateTime } = require('luxon');

/* -------------------------------------------------------------
   Helper: parse HH:MM or HH:MM:SS -> seconds since midnight
------------------------------------------------------------- */
function parseHHMMToSeconds(hhmm) {
  if (!hhmm || typeof hhmm !== 'string') return null;
  const parts = hhmm.split(':').map(Number);
  if (parts.length < 2 || parts.length > 3) return null;
  const [hh, mm, ss = 0] = parts;
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || !Number.isFinite(ss)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59 || ss < 0 || ss > 59) return null;
  return hh * 3600 + mm * 60 + ss;
}

/* -------------------------------------------------------------
   Helper: normalize broken ISO datetime strings (conservative)
   Example fixed: "2025-11-02T15:00:0007:00" -> "2025-11-02T15:00:00+07:00"
------------------------------------------------------------- */
function normalizeISO(dtStr) {
  if (!dtStr || typeof dtStr !== 'string') return dtStr;

  // if already includes Z or explicit offset, leave it
  if (/[zZ]|[+\-]\d{2}(:?\d{2})?$/.test(dtStr)) {
    return dtStr;
  }

  // seconds + glued timezone -> insert '+'
  const m = dtStr.match(/^(.*T\d{2}:\d{2}:\d{2})(\d{2}:\d{2})$/);
  if (m) return `${m[1]}+${m[2]}`;

  // minutes + glued timezone (no seconds) -> insert '+'
  const m2 = dtStr.match(/^(.*T\d{2}:\d{2})(\d{2}:\d{2})$/);
  if (m2) return `${m2[1]}+${m2[2]}`;

  return dtStr;
}

/* -------------------------------------------------------------
   Helper: timezone-aware working-hours check (seconds-accurate)
   dateTimeISO: incoming string (may include offsets)
   openTime/closeTime: "HH:MM" or "HH:MM:SS"
   restaurantTz: IANA tz string, default Asia/Bangkok
------------------------------------------------------------- */
function isWithinWorkingHours(dateTimeISO, openTime, closeTime, restaurantTz = 'Asia/Bangkok') {
  if (!dateTimeISO) return false;

  const cleaned = normalizeISO(dateTimeISO);

  let dt = DateTime.fromISO(cleaned, { setZone: true });
  if (!dt.isValid) {
    // fallback: treat as in restaurant timezone
    dt = DateTime.fromISO(cleaned, { zone: restaurantTz });
    if (!dt.isValid) return false;
  }

  const local = dt.setZone(restaurantTz);
  if (!local.isValid) return false;

  const totalSeconds = local.hour * 3600 + local.minute * 60 + local.second;

  const openSeconds = parseHHMMToSeconds(openTime);
  const closeSeconds = parseHHMMToSeconds(closeTime);
  if (openSeconds === null || closeSeconds === null) return false;

  if (openSeconds <= closeSeconds) {
    // inclusive endpoints: allowed if >= open and <= close
    return totalSeconds >= openSeconds && totalSeconds <= closeSeconds;
  } else {
    // overnight: allowed if after open OR before close (e.g., 20:00 - 03:00)
    return totalSeconds >= openSeconds || totalSeconds <= closeSeconds;
  }
}

/* -------------------------------------------------------------
   Utility: parse incoming date string -> JS Date (or null)
   Uses Luxon to respect offsets and restaurant timezone
------------------------------------------------------------- */
function parseIncomingToJSDate(dateTimeISO, restaurantTz = 'Asia/Bangkok') {
  if (!dateTimeISO) return null;
  const cleaned = normalizeISO(dateTimeISO);

  let dt = DateTime.fromISO(cleaned, { setZone: true });
  if (!dt.isValid) {
    dt = DateTime.fromISO(cleaned, { zone: restaurantTz });
    if (!dt.isValid) return null;
  }

  return dt.toJSDate();
}

/* -------------------------------------------------------------
   GET /reservations
------------------------------------------------------------- */
exports.getReservations = async (req, res, next) => {
  let query;

  if (req.user.role !== 'admin') {
    const payload = req.params.restaurantId
      ? { user: req.user.id, restaurant: req.params.restaurantId }
      : { user: req.user.id };

    query = Reservation.find(payload).populate({
      path: 'restaurant',
      select: 'name address district province tel openTime closeTime timezone'
    });
  } else {
    if (req.params.restaurantId) {
      query = Reservation.find({ restaurant: req.params.restaurantId }).populate({
        path: 'restaurant',
        select: 'name address district province tel openTime closeTime timezone'
      });
    } else {
      query = Reservation.find().populate({
        path: 'restaurant',
        select: 'name address district province tel openTime closeTime timezone'
      });
    }
  }

  try {
    const reservations = await query;
    res.status(200).json({ success: true, count: reservations.length, data: reservations });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Cannot find reservation" });
  }
};

/* -------------------------------------------------------------
   GET /reservations/:id
------------------------------------------------------------- */
exports.getReservation = async (req, res, next) => {
  try {
    const reservation = await Reservation.findById(req.params.id).populate({
      path: 'restaurant',
      select: 'name address district province tel openTime closeTime timezone'
    });

    if (!reservation) {
      return res.status(404).json({ success: false, message: `No reservation with the id of ${req.params.id}` });
    }

    res.status(200).json({ success: true, data: reservation });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Cannot find reservation" });
  }
};

/* -------------------------------------------------------------
   POST /restaurants/:restaurantId/reservations
   - normalize & convert date before create to avoid CastError
------------------------------------------------------------- */
exports.addReservation = async (req, res, next) => {
  try {
    req.body.restaurant = req.params.restaurantId;

    if (!req.body.user) {
      return res.status(400).json({ success: false, message: "user is required in request body" });
    }

    if (req.user.role !== 'admin' && req.body.user !== req.user.id) {
      return res.status(401).json({ success: false, message: `User ${req.user.id} is not authorized to create this reservation` });
    }

    const restaurant = await Restaurant.findById(req.params.restaurantId);
    if (!restaurant) {
      return res.status(404).json({ success: false, message: `No restaurant with the id of ${req.params.restaurantId}` });
    }

    if (!req.body.dateTime) {
      return res.status(400).json({ success: false, message: "dateTime is required" });
    }

    const tz = restaurant.timezone || 'Asia/Bangkok';
    // validate using raw incoming string (will be normalized inside)
    const ok = isWithinWorkingHours(req.body.dateTime, restaurant.openTime, restaurant.closeTime, tz);
    if (!ok) {
      return res.status(400).json({
        success: false,
        message: `Reservation time is outside restaurant working hours (${restaurant.openTime} - ${restaurant.closeTime})`
      });
    }

    const existedReservations = await Reservation.find({ user: req.body.user });
    if (existedReservations.length >= 3 && req.user.role !== 'admin') {
      return res.status(400).json({ success: false, message: `The user with ID ${req.body.user} has already made 3 reservations` });
    }

    // convert incoming to JS Date for mongoose
    const jsDate = parseIncomingToJSDate(req.body.dateTime, tz);
    if (!jsDate) {
      return res.status(400).json({ success: false, message: 'Invalid dateTime' });
    }
    req.body.dateTime = jsDate;

    req.body.status = 'booked';

    const reservation = await Reservation.create(req.body);
    res.status(201).json({ success: true, data: reservation });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Cannot create reservation" });
  }
};

/* -------------------------------------------------------------
   PUT /reservations/:id
   - when updating dateTime, normalize & convert before update
------------------------------------------------------------- */
exports.updateReservation = async (req, res, next) => {
  try {
    let reservation = await Reservation.findById(req.params.id);
    if (!reservation) {
      return res.status(404).json({ success: false, message: `No reservation with the id of ${req.params.id}` });
    }

    if (reservation.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(401).json({ success: false, message: `User ${req.user.id} is not authorized to update this reservation` });
    }

    // If dateTime is being changed -> validate and convert
    if (req.body.dateTime) {
      const restaurant = await Restaurant.findById(reservation.restaurant);
      if (!restaurant) {
        return res.status(404).json({ success: false, message: `No restaurant with the id of ${reservation.restaurant}` });
      }

      const tz = restaurant.timezone || 'Asia/Bangkok';
      const ok = isWithinWorkingHours(req.body.dateTime, restaurant.openTime, restaurant.closeTime, tz);
      if (!ok) {
        return res.status(400).json({
          success: false,
          message: `Reservation time is outside restaurant working hours (${restaurant.openTime} - ${restaurant.closeTime})`
        });
      }

      const jsDate = parseIncomingToJSDate(req.body.dateTime, tz);
      if (!jsDate) {
        return res.status(400).json({ success: false, message: 'Invalid dateTime' });
      }
      req.body.dateTime = jsDate;
    }

    // If user attempts to set status -> validate transition
    if (req.body.status) {
      const allowedStatuses = ['booked', 'completed', 'cancelled'];
      if (!allowedStatuses.includes(req.body.status)) {
        return res.status(400).json({ success: false, message: 'Invalid status value' });
      }

      if (req.body.status === 'completed' && req.user.role !== 'admin') {
        // determine target instant as milliseconds
        let targetMs;
        if (req.body.dateTime) {
          // req.body.dateTime is now JS Date (converted above)
          targetMs = new Date(req.body.dateTime).getTime();
        } else {
          targetMs = new Date(reservation.dateTime).getTime();
        }
        if (isNaN(targetMs)) {
          return res.status(400).json({ success: false, message: 'Invalid dateTime' });
        }
        const nowMs = Date.now();
        if (nowMs < targetMs) {
          return res.status(400).json({ success: false, message: 'Cannot mark as completed before the reservation time' });
        }
      }
    }

    reservation = await Reservation.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    res.status(200).json({ success: true, data: reservation });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Cannot update reservation" });
  }
};

/* -------------------------------------------------------------
   DELETE /reservations/:id
------------------------------------------------------------- */
exports.deleteReservation = async (req, res, next) => {
  try {
    const reservation = await Reservation.findById(req.params.id);
    if (!reservation) {
      return res.status(404).json({ success: false, message: `No reservation with the id of ${req.params.id}` });
    }
    if (reservation.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(401).json({ success: false, message: `User ${req.user.id} is not authorized to delete this reservation` });
    }
    await reservation.deleteOne();
    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Cannot delete reservation" });
  }
};

/* -------------------------------------------------------------
   PATCH /reservations/:id/complete
------------------------------------------------------------- */
exports.markCompleted = async (req, res, next) => {
  try {
    const reservation = await Reservation.findById(req.params.id);
    if (!reservation) {
      return res.status(404).json({ success: false, message: `No reservation with the id of ${req.params.id}` });
    }
    if (reservation.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(401).json({ success: false, message: `User ${req.user.id} is not authorized to mark this reservation completed` });
    }

    const targetMs = new Date(reservation.dateTime).getTime();
    if (isNaN(targetMs)) {
      return res.status(400).json({ success: false, message: 'Invalid reservation dateTime' });
    }
    const nowMs = Date.now();
    if (nowMs < targetMs && req.user.role !== 'admin') {
      return res.status(400).json({ success: false, message: 'Cannot mark as completed before the reservation time' });
    }

    reservation.status = 'completed';
    await reservation.save();
    return res.status(200).json({ success: true, data: reservation });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Cannot update reservation' });
  }
};
