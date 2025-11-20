const mongoose = require('mongoose');

const RestaurantSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please add a name'],
        unique: true,
        trim: true,
        maxlength: [50, 'Name can not be more than 50 characters'],
    },
    address: {
        type: String,
        required: [true, 'Please add an address'],
    },
    district: {
        type: String,
        required: [true, 'Please add a district'],
    },
    province: {
        type: String,
        required: [true, 'Please add a province'],
    },
    postalcode: {
        type: String,
        required: [true, 'Please add a postalcode'],
        maxlength: [5, 'Postal Code can not be more than 5 digits'],
    },
    tel: {
        type: String,
    },
    openTime: {
        type: String,
        required: true,
        match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Use 24h HH:MM format'],
    },
    closeTime: {
        type: String,
        required: true,
        match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Use 24h HH:MM format'],
    },
    image: {
        type: String,
        default: 'no-photo.jpg',
    },

    // Aggregates for fast read
    averageRating: {
        type: Number,
        default: 0,
    },
    reviewCount: {
        type: Number,
        default: 0,
    }
}, {
    toJSON: {virtuals: true},
    toObject: {virtuals: true}
});

//Reverse populate with virtuals
RestaurantSchema.virtual('reservations', {
    ref: 'Reservation',
    localField: '_id',
    foreignField: 'restaurant',
    justOne: false
});

RestaurantSchema.virtual('reviews', {
  ref: 'Review',
  localField: '_id',
  foreignField: 'restaurant',
  justOne: false
});


module.exports = mongoose.model('Restaurant', RestaurantSchema);