// tests/reviews.test.js
/**
 * Jest tests for controllers/reviews.js
 *
 * - Mocks Review, Reservation, Restaurant models
 * - Tests realistic createReview business rule: user must have at least one completed reservation
 * - Tests getReviews filtering, pagination
 * - Tests getReview, updateReview (ownership/admin), deleteReview (ownership/admin)
 * - Asserts logging on error paths
 */

// deterministic timezone for date handling
process.env.TZ = 'UTC';

jest.mock('../models/Review');
jest.mock('../models/Reservation');
jest.mock('../models/Restaurant');

const Review = require('../models/Review');
const Reservation = require('../models/Reservation');
const Restaurant = require('../models/Restaurant');

// require controllers after mocks so mocked modules are used
const controllers = require('../controllers/reviews');

function mockReq(options = {}) {
  // allow explicitly passing user: null by checking own property
  const user = Object.prototype.hasOwnProperty.call(options, 'user') ? options.user : { id: 'user1', role: 'user' };
  return {
    params: options.params || {},
    body: options.body || {},
    user,
    query: options.query || {},
  };
}

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
}

// small dataset for list tests
const reviewsDataset = [
  { _id: 'rvA', user: 'userA', restaurant: 'rest1', stars: 5, message: 'Great' },
  { _id: 'rvB', user: 'userB', restaurant: 'rest1', stars: 4, message: 'Good' },
  { _id: 'rvC', user: 'userA', restaurant: 'rest2', stars: 3, message: 'Ok' },
];

beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterAll(() => {
  console.error.mockRestore();
  console.log.mockRestore();
});

beforeEach(() => {
  jest.clearAllMocks();
  console.error.mockClear();
  console.log.mockClear();
});

describe('reviews controller', () => {
  describe('createReview', () => {
    beforeEach(() => {
      // default mocks
      Restaurant.findById.mockResolvedValue({ _id: 'rest1' });
      // by default, user has a completed reservation (unless a test overrides)
      Reservation.findOne.mockResolvedValue({ _id: 'resCompleted', status: 'completed' });
      Review.create.mockImplementation(async (doc) => ({ _id: 'newReview', ...doc }));
    });

    test('401 when not authenticated (no req.user)', async () => {
      const req = mockReq({ user: null, body: { restaurant: 'rest1', stars: 5 } });
      const res = mockRes();

      await controllers.createReview(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Not authenticated' });
      expect(Review.create).not.toHaveBeenCalled();
    });

    test('400 when restaurant is missing', async () => {
      const req = mockReq({ body: { stars: 5 }, user: { id: 'u1', role: 'user' } });
      const res = mockRes();

      await controllers.createReview(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'restaurant is required' });
      expect(Review.create).not.toHaveBeenCalled();
    });

    test('400 when stars missing', async () => {
      const req = mockReq({ body: { restaurant: 'rest1' }, user: { id: 'u1', role: 'user' } });
      const res = mockRes();

      await controllers.createReview(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'stars is required (0-5)' });
      expect(Review.create).not.toHaveBeenCalled();
    });

    test('400 when stars out of range', async () => {
      const req = mockReq({ body: { restaurant: 'rest1', stars: 10 }, user: { id: 'u1' } });
      const res = mockRes();

      await controllers.createReview(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'stars must be a number between 0 and 5' });
      expect(Review.create).not.toHaveBeenCalled();
    });

    test('404 when restaurant not found', async () => {
      Restaurant.findById.mockResolvedValue(null);

      const req = mockReq({ body: { restaurant: 'nope', stars: 4 }, user: { id: 'u1' } });
      const res = mockRes();

      await controllers.createReview(req, res);

      expect(Restaurant.findById).toHaveBeenCalledWith('nope');
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Restaurant not found' });
      expect(Review.create).not.toHaveBeenCalled();
    });

    test('400 when user has no completed reservation at restaurant', async () => {
      Reservation.findOne.mockResolvedValue(null);

      const req = mockReq({ body: { restaurant: 'rest1', stars: 4 }, user: { id: 'uX' } });
      const res = mockRes();

      await controllers.createReview(req, res);

      expect(Reservation.findOne).toHaveBeenCalledWith({
        user: 'uX',
        restaurant: 'rest1',
        status: 'completed'
      });

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'User can leave a review only after having at least one completed reservation at this restaurant'
      });
      expect(Review.create).not.toHaveBeenCalled();
    });

    test('201 on successful create (allows multiple reviews)', async () => {
      // ensure Reservation.findOne returns something
      Reservation.findOne.mockResolvedValue({ _id: 'res123', status: 'completed' });
      Review.create.mockResolvedValue({ _id: 'created1', user: 'u1', restaurant: 'rest1', stars: 5, message: 'ok' });

      const req = mockReq({ body: { restaurant: 'rest1', stars: 5, message: 'Nice' }, user: { id: 'u1' } });
      const res = mockRes();

      await controllers.createReview(req, res);

      expect(Review.create).toHaveBeenCalledWith(expect.objectContaining({
        user: 'u1',
        restaurant: 'rest1',
        stars: 5,
        message: 'Nice'
      }));

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: { _id: 'created1', user: 'u1', restaurant: 'rest1', stars: 5, message: 'ok' } });
      expect(console.error).not.toHaveBeenCalled();
    });

    test('500 on create error and logs error', async () => {
      Reservation.findOne.mockResolvedValue({ _id: 'res123', status: 'completed' });
      Review.create.mockImplementation(() => { throw new Error('create fail'); });

      const req = mockReq({ body: { restaurant: 'rest1', stars: 5 }, user: { id: 'u1' } });
      const res = mockRes();

      await controllers.createReview(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Server error' });

      expect(console.error).toHaveBeenCalled();
      const arg = console.error.mock.calls[0][0];
      expect(arg).toBeInstanceOf(Error);
      expect(arg.message).toBe('create fail');
    });

    test('handles ValidationError from mongoose and returns 400', async () => {
      const ve = new Error('validation');
      ve.name = 'ValidationError';
      Review.create.mockImplementation(() => { throw ve; });
      Reservation.findOne.mockResolvedValue({ _id: 'res', status: 'completed' });

      const req = mockReq({ body: { restaurant: 'rest1', stars: 5 }, user: { id: 'u1' } });
      const res = mockRes();

      await controllers.createReview(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'validation' });
    });
  });

  describe('getReviews', () => {
    beforeEach(() => {
      // mock Review.find to support chainable calls: sort().skip().limit().populate() => resolves dataset slice
      Review.find.mockImplementation((filter) => {
        let results = reviewsDataset.slice();
        if (filter && typeof filter === 'object') {
          results = results.filter(r => {
            if (filter.user && r.user !== filter.user) return false;
            if (filter.restaurant && r.restaurant !== filter.restaurant) return false;
            return true;
          });
        }

        // provide chainable API
        return {
          sort: jest.fn().mockReturnThis(),
          skip: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          // return a single populate that resolves to the results (works for two populate calls)
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockResolvedValue(results)
          }),
        };
      });

      Review.countDocuments.mockImplementation((filter) => {
        let results = reviewsDataset.slice();
        if (filter && typeof filter === 'object') {
          results = results.filter(r => {
            if (filter.user && r.user !== filter.user) return false;
            if (filter.restaurant && r.restaurant !== filter.restaurant) return false;
            return true;
          });
        }
        return Promise.resolve(results.length);
      });
    });

    test('list all reviews with pagination defaults', async () => {
      const req = mockReq({ query: {} });
      const res = mockRes();

      await controllers.getReviews(req, res);

      expect(Review.find).toHaveBeenCalledWith({});
      expect(Review.countDocuments).toHaveBeenCalledWith({});
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        total: reviewsDataset.length,
        page: 1,
        pages: Math.ceil(reviewsDataset.length / 10),
        data: reviewsDataset,
      });
    });

    test('filter by restaurant returns subset', async () => {
      const req = mockReq({ query: { restaurant: 'rest1', page: '1', limit: '10' } });
      const res = mockRes();

      await controllers.getReviews(req, res);

      expect(Review.find).toHaveBeenCalledWith({ restaurant: 'rest1' });
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        total: 2,
        page: 1,
        pages: 1,
        data: expect.arrayContaining([
          expect.objectContaining({ _id: 'rvA' }),
          expect.objectContaining({ _id: 'rvB' }),
        ])
      }));
    });

    test('filter by user returns subset', async () => {
      const req = mockReq({ query: { user: 'userA' } });
      const res = mockRes();

      await controllers.getReviews(req, res);

      expect(Review.find).toHaveBeenCalledWith({ user: 'userA' });
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        total: 2,
        page: 1,
        pages: 1,
      }));
    });

    test('500 on db error', async () => {
      // Make the populate() chain reject when invoked (second populate rejects)
      Review.find.mockImplementation(() => {
        return {
          sort: jest.fn().mockReturnThis(),
          skip: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockImplementation(() => Promise.reject(new Error('db fail')))
          }),
        };
      });

      // Let countDocuments resolve (so Promise.all rejects only due to populate)
      Review.countDocuments.mockResolvedValue(0);

      const req = mockReq({ query: {} });
      const res = mockRes();

      await controllers.getReviews(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Server error' });
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('getReview', () => {
    test('returns review when found', async () => {
      const fake = { _id: 'r1', user: 'u1', restaurant: 'rest1' };
      Review.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(fake)
        })
      });

      const req = mockReq({ params: { id: 'r1' } });
      const res = mockRes();

      await controllers.getReview(req, res);

      expect(Review.findById).toHaveBeenCalledWith('r1');
      expect(res.json).toHaveBeenCalledWith({ success: true, data: fake });
    });

    test('404 when not found', async () => {
      Review.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(null)
        })
      });

      const req = mockReq({ params: { id: 'nope' } });
      const res = mockRes();

      await controllers.getReview(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Review not found' });
    });

    test('400 on invalid id (throws)', async () => {
      Review.findById.mockImplementation(() => { throw new Error('bad id'); });

      const req = mockReq({ params: { id: 'bad' } });
      const res = mockRes();

      await controllers.getReview(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Invalid review ID' });
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('updateReview', () => {
    test('404 if review not found', async () => {
      Review.findById.mockResolvedValue(null);

      const req = mockReq({ params: { id: 'missing' }, user: { id: 'u1', role: 'user' }});
      const res = mockRes();

      await controllers.updateReview(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Review not found' });
    });

    test('403 if not owner and not admin', async () => {
      Review.findById.mockResolvedValue({ _id: 'rvX', user: 'ownerId', restaurant: 'r1' });

      const req = mockReq({ params: { id: 'rvX' }, user: { id: 'someone', role: 'user' }});
      const res = mockRes();

      await controllers.updateReview(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Not authorized to update this review' });
    });

    test('400 when runValidators fails (ValidationError)', async () => {
      // simulate owner updating with invalid value -> mongoose throws ValidationError
      Review.findById.mockResolvedValue({ _id: 'rvOK', user: 'owner', restaurant: 'r1' });
      const ve = new Error('val');
      ve.name = 'ValidationError';
      Review.findByIdAndUpdate.mockImplementation(() => { throw ve; });

      const req = mockReq({ params: { id: 'rvOK' }, user: { id: 'owner', role: 'user' }, body: { stars: 10 }});
      const res = mockRes();

      await controllers.updateReview(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'val' });
    });

    test('200 when owner updates successfully', async () => {
      Review.findById.mockResolvedValue({ _id: 'rvY', user: 'owner1', restaurant: 'r1' });
      Review.findByIdAndUpdate.mockResolvedValue({ _id: 'rvY', user: 'owner1', restaurant: 'r1', stars: 4 });

      const req = mockReq({ params: { id: 'rvY' }, user: { id: 'owner1', role: 'user' }, body: { stars: 4 }});
      const res = mockRes();

      await controllers.updateReview(req, res);

      expect(Review.findByIdAndUpdate).toHaveBeenCalledWith('rvY', expect.objectContaining({ stars: 4 }), { new: true, runValidators: true });
      expect(res.json).toHaveBeenCalledWith({ success: true, data: { _id: 'rvY', user: 'owner1', restaurant: 'r1', stars: 4 } });
    });

    test('500 on update error and logs error', async () => {
      Review.findById.mockResolvedValue({ _id: 'rvErr', user: 'uErr', restaurant: 'rErr' });
      Review.findByIdAndUpdate.mockImplementation(() => { throw new Error('update fail'); });

      const req = mockReq({ params: { id: 'rvErr' }, user: { id: 'uErr', role: 'user' }, body: { stars: 3 }});
      const res = mockRes();

      await controllers.updateReview(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Invalid review ID' });
      // controller logs error too
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('deleteReview', () => {
    test('404 if not found', async () => {
      Review.findById.mockResolvedValue(null);

      const req = mockReq({ params: { id: 'nope' }, user: { id: 'u1', role: 'user' }});
      const res = mockRes();

      await controllers.deleteReview(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Review not found' });
    });

    test('403 if not owner and not admin', async () => {
      Review.findById.mockResolvedValue({ _id: 'rvD', user: 'ownerA', restaurant: 'r1' });

      const req = mockReq({ params: { id: 'rvD' }, user: { id: 'someone', role: 'user' }});
      const res = mockRes();

      await controllers.deleteReview(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Not authorized to delete this review' });
    });

    test('204 when owner deletes successfully', async () => {
      Review.findById.mockResolvedValue({ _id: 'rvOk', user: 'ownerB', restaurant: 'r1' });
      Review.findByIdAndDelete.mockResolvedValue({ _id: 'rvOk' });

      const req = mockReq({ params: { id: 'rvOk' }, user: { id: 'ownerB', role: 'user' }});
      const res = mockRes();

      await controllers.deleteReview(req, res);

      expect(Review.findByIdAndDelete).toHaveBeenCalledWith('rvOk');
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    test('admin can delete any review', async () => {
      Review.findById.mockResolvedValue({ _id: 'rvAdm', user: 'ownerX', restaurant: 'r1' });
      Review.findByIdAndDelete.mockResolvedValue({ _id: 'rvAdm' });

      const req = mockReq({ params: { id: 'rvAdm' }, user: { id: 'adminUser', role: 'admin' }});
      const res = mockRes();

      await controllers.deleteReview(req, res);

      expect(Review.findByIdAndDelete).toHaveBeenCalledWith('rvAdm');
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    test('400 on delete error logs error', async () => {
      Review.findById.mockImplementation(() => { throw new Error('boom del'); });

      const req = mockReq({ params: { id: 'errDel' }, user: { id: 'uErr', role: 'user' }});
      const res = mockRes();

      await controllers.deleteReview(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Invalid review ID' });
      expect(console.error).toHaveBeenCalled();
      const arg = console.error.mock.calls[0][0];
      expect(arg).toBeInstanceOf(Error);
      expect(arg.message).toBe('boom del');
    });
  });
});
