const Reservation = require('../models/Reservation');
const Restaurant = require('../models/Restaurant');

// helper at top of file (add below requires)
function parseHHMMToMinutes(hhmm) {
  // hhmm: "HH:MM"
  if (!hhmm || typeof hhmm !== 'string') return null;
  const [hh, mm] = hhmm.split(':').map(Number);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
  return hh * 60 + mm;
}

function isWithinWorkingHours(dateTimeISO, openTime, closeTime) {
  // dateTimeISO: ISO string -> create Date
  // openTime, closeTime: "HH:MM"
  const dt = new Date(dateTimeISO);
  if (isNaN(dt.getTime())) return false; // invalid date

  // minutes since midnight for the reservation local time
  const minutes = dt.getHours() * 60 + dt.getMinutes();

  const openMinutes = parseHHMMToMinutes(openTime);
  const closeMinutes = parseHHMMToMinutes(closeTime);

  if (openMinutes === null || closeMinutes === null) {
    // if restaurant times invalid, be conservative and reject
    return false;
  }

  if (openMinutes <= closeMinutes) {
    // normal same-day schedule: e.g., 10:00 - 22:00
    return minutes >= openMinutes && minutes <= closeMinutes;
  } else {
    // overnight schedule: e.g., 20:00 - 03:00
    // valid if time is after open (>= open) OR before close (<= close)
    return minutes >= openMinutes || minutes <= closeMinutes;
  }
}



exports.getReservations = async (req, res, next) => {
  let query;
  // General user can see only their reservations
  if (req.user.role !== 'admin') {
    // NOTE: use req.user.id (not req.body.user)
    const payload = (req.params.restaurantId)
      ? { user: req.user.id, restaurant: req.params.restaurantId }
      : { user: req.user.id };

    query = Reservation.find(payload).populate({
      path: 'restaurant',
      select: 'name address district province tel openTime closeTime'
    });
  } else { // Admin can see all reservations
    if (req.params.restaurantId) {
      query = Reservation.find({ restaurant: req.params.restaurantId }).populate({
        path: 'restaurant',
        select: 'name address district province tel openTime closeTime',
      });
    } else {
      query = Reservation.find().populate({
        path: 'restaurant',
        select: 'name address district province tel openTime closeTime'
      });
    }
  }

  try {
    const reservations = await query;

    res.status(200).json({
      success: true,
      count: reservations.length,
      data: reservations
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Cannot find reservation"
    });
  }
};

exports.getReservation = async (req, res, next) => {
  try {
    const reservation = await Reservation.findById(req.params.id).populate({
      path: 'restaurant',
      select: 'name address district province tel openTime closeTime'
    });

    if (!reservation) {
      return res.status(404).json({ success: false, message: `No reservation with the id of ${req.params.id}` });
    }

    res.status(200).json({
      success: true,
      data: reservation
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Cannot find reservation" });
  }
};

exports.addReservation = async (req,res,next) => {
  try {
    // restaurantId must be in params (route: /restaurants/:restaurantId/reservations)
    req.body.restaurant = req.params.restaurantId;

    const restaurant = await Restaurant.findById(req.params.restaurantId);

    if(!restaurant) {
      return res.status(404).json({
        success: false,
        message: `No restaurant with the id of ${req.params.restaurantId}`,
      });
    }

    // Validate dateTime present
    if (!req.body.dateTime) {
      return res.status(400).json({
        success: false,
        message: "dateTime is required"
      });
    }

    // Check working hours
    const ok = isWithinWorkingHours(req.body.dateTime, restaurant.openTime, restaurant.closeTime);
    if (!ok) {
      return res.status(400).json({
        success: false,
        message: `Reservation time is outside restaurant working hours (${restaurant.openTime} - ${restaurant.closeTime})`
      });
    }

    // user is provided in req.body per your change
    if (!req.body.user) {
      return res.status(400).json({
        success: false,
        message: "user is required in request body"
      });
    }

    const existedReservations = await Reservation.find({user: req.body.user});

    if(existedReservations.length >= 3 && req.user.role !== 'admin') {
      return res.status(400).json({success: false, message: `The user with ID ${req.body.user} has already made 3 reservations`});
    }

    req.body.status = 'booked';

    const reservation = await Reservation.create(req.body);

    res.status(201).json({
      success: true,
      data: reservation
    });
  } catch(err) {
    console.log(err)
    return res.status(500).json({
      success: false,
      message: "Cannot create reservation"
    });
  }
}

// --- replace your updateReservation with this ---
exports.updateReservation = async (req,res,next) => {
  try {
    let reservation = await Reservation.findById(req.params.id);

    if(!reservation) {
      return res.status(404).json({
        success: false, message: `No reservation with the id of ${req.params.id}`
      });
    }

    if(reservation.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(401).json({success: false, message: `User ${req.user.id} is not authorized to update this reservation`});
    }

    // If dateTime is being changed, check restaurant hours
    if (req.body.dateTime) {
      const restaurantId = reservation.restaurant;
      const restaurant = await Restaurant.findById(restaurantId);
      if (!restaurant) {
        return res.status(404).json({
          success: false,
          message: `No restaurant with the id of ${restaurantId}`
        });
      }

      const ok = isWithinWorkingHours(req.body.dateTime, restaurant.openTime, restaurant.closeTime);
      if (!ok) {
        return res.status(400).json({
          success: false,
          message: `Reservation time is outside restaurant working hours (${restaurant.openTime} - ${restaurant.closeTime})`
        });
      }
    }

    // If user attempts to set status -> validate transition
    if (req.body.status) {
      const allowedStatuses = ['booked','completed','cancelled'];
      if (!allowedStatuses.includes(req.body.status)) {
        return res.status(400).json({ success: false, message: 'Invalid status value' });
      }

      // If marking as completed, ensure the reservation time is in the past (user can't mark as completed early),
      // unless the requester is an admin.
      if (req.body.status === 'completed' && req.user.role !== 'admin') {
        // use existing reservation dateTime unless they are changing dateTime too
        const targetDateTime = req.body.dateTime ? new Date(req.body.dateTime) : new Date(reservation.dateTime);
        if (isNaN(targetDateTime.getTime())) {
          return res.status(400).json({ success: false, message: 'Invalid dateTime' });
        }
        const now = new Date();
        if (now < targetDateTime) {
          return res.status(400).json({ success: false, message: 'Cannot mark as completed before the reservation time' });
        }
      }
    }

    reservation = await Reservation.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      data: reservation
    })
  } catch(err) {
    console.log(err);
    return res.status(500).json({success:false, message: "Cannot update reservation"});
  }
}


exports.deleteReservation = async (req, res, next) => {
  try {
    const reservation = await Reservation.findById(req.params.id);

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: `No reservation with the id of ${req.params.id}`,
      });
    }

    if (reservation.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(401).json({ success: false, message: `User ${req.user.id} is not authorized to delete this reservation` });
    }

    // delete this specific reservation document
    await reservation.deleteOne();

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Cannot delete reservation"
    });
  }
};


// controllers/reservations.js
exports.markCompleted = async (req,res,next) => {
  try {
    const reservation = await Reservation.findById(req.params.id);
    if(!reservation) return res.status(404).json({ success:false, message: `No reservation with the id of ${req.params.id}` });

    if(reservation.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(401).json({ success:false, message: `User ${req.user.id} is not authorized to mark this reservation completed`});
    }

    const now = new Date();
    if (now < new Date(reservation.dateTime) && req.user.role !== 'admin') {
      return res.status(400).json({ success:false, message: 'Cannot mark as completed before the reservation time' });
    }

    reservation.status = 'completed';
    await reservation.save();

    return res.status(200).json({ success:true, data: reservation });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success:false, message: 'Cannot update reservation' });
  }
};
