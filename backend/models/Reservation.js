const mongoose = require('mongoose');

const ReservationSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true,
    }, 
    restaurant: {
        type: mongoose.Schema.ObjectId,
        ref: 'Restaurant',
        required: true,
    },
    dateTime: {
        type: Date,
        required: [true, "Please specify the reservation date and time"],
    },
    status: {
        type: String,
        enum: ['booked', 'completed', 'cancelled'],
        default: 'booked',
        required: true,
    },
}, { timestamps: true });

module.exports = mongoose.model('Reservation', ReservationSchema);