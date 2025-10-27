const mongoose = require('mongoose');

const ReviewSchema = new mongoose.Schema({
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
    stars: {
        type: Number,
        required: [true, 'Please provide a star rating'],
        min: [0, 'Rating must be at least 0'],
        max: [5, 'Rating cannot exceed 5'],
    },
    message: {
        type: String,
        trim: true,
        maxlength: [500, 'Review message cannot exceed 500 characters'],
    },
}, { timestamps: true });

module.exports = mongoose.model('Review', ReviewSchema);