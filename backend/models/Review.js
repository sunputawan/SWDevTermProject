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


const updateRestaurantRating = async (restaurantId) => {
    if (!restaurantId) return;
    try {
        // const rId = mongoose.Types.ObjectId(restaurantId);

        const stats = await mongoose.model('Review').aggregate([
            { $match: { restaurant: restaurantId } },
            {
                $group: {
                    _id: '$restaurant',
                    avgRating: { $avg: '$stars' },
                    count: { $sum: 1 }
                }
            }
        ]);

        const update = stats.length > 0
            ? { averageRating: parseFloat(stats[0].avgRating.toFixed(2)), reviewCount: stats[0].count }
            : { averageRating: 0, reviewCount: 0 };

        await mongoose.model('Restaurant').findByIdAndUpdate(restaurantId, update).catch(err => {
            console.error('Failed to update restaurant rating:', err);
        });
    } catch (err) {
            console.error('updateRestaurantRating error:', err);
    }
}

// Hooks to trigger aggregation update on create/update/delete
ReviewSchema.post('save', function () {
    updateRestaurantRating(this.restaurant);
});

// findOneAndDelete (used by findByIdAndDelete)
ReviewSchema.post('findOneAndDelete', function (doc) {
    if (doc && doc.restaurant) updateRestaurantRating(doc.restaurant);
});

// findOneAndUpdate (used by findByIdAndUpdate)
ReviewSchema.post('findOneAndUpdate', function (doc) {
    if (doc && doc.restaurant) updateRestaurantRating(doc.restaurant);
});

// remove() on document
ReviewSchema.post('remove', function () {
    updateRestaurantRating(this.restaurant);
});

module.exports = mongoose.model('Review', ReviewSchema);