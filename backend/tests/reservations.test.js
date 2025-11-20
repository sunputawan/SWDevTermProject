// tests/reservations.test.js
/**
 * Comprehensive Jest tests for controllers/reservations.js
 *
 * - Mocks Reservation and Restaurant models
 * - Tests realistic getReservations by mocking Reservation.find to filter a shared dataset
 * - Asserts error logging (console.error / console.log) on error paths
 * - Asserts both status and returned error message where applicable
 *
 * Place this file at tests/reservations.test.js
 */

// Deterministic timezone for date handling in tests
process.env.TZ = 'UTC';

jest.mock('../models/Reservation');
jest.mock('../models/Restaurant');

const Reservation = require('../models/Reservation');
const Restaurant = require('../models/Restaurant');

// require controller after mocks so it uses mocked modules
const controllers = require('../controllers/reservations');

function mockReq(options = {}) {
  return {
    params: options.params || {},
    body: options.body || {},
    user: options.user || { id: 'user1', role: 'user' },
    query: options.query || {},
  };
}

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

// Shared dataset used for "realistic" getReservations tests
const allReservationsDataset = [
  { _id: 'resA', user: 'userA', restaurant: 'rest1', dateTime: '2025-11-02T19:00:00Z' },
  { _id: 'resB', user: 'userB', restaurant: 'rest1', dateTime: '2025-11-02T20:00:00Z' },
  { _id: 'resC', user: 'userA', restaurant: 'rest2', dateTime: '2025-11-03T18:00:00Z' },
  { _id: 'resD', user: 'userC', restaurant: 'rest2', dateTime: '2025-11-04T21:00:00Z' },
];

beforeAll(() => {
  // spy and mock implementation to avoid noisy logs in test output
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

describe('reservations controller', () => {
  describe('getReservations', () => {
    beforeEach(() => {
      // Mock Reservation.find so that it filters the shared dataset according to the payload argument.
      Reservation.find.mockImplementation((payload) => {
        let results = allReservationsDataset.slice();

        if (payload && typeof payload === 'object') {
          results = results.filter((r) => {
            if (payload.user && r.user !== payload.user) return false;
            if (payload.restaurant && r.restaurant !== payload.restaurant) return false;
            return true;
          });
        }

        return {
          populate: jest.fn().mockResolvedValue(results),
        };
      });
    });

    test('non-admin sees only own reservations (no restaurantId)', async () => {
      const req = mockReq({ user: { id: 'userA', role: 'user' } });
      const res = mockRes();

      await controllers.getReservations(req, res, jest.fn());

      expect(Reservation.find).toHaveBeenCalledWith({ user: 'userA' });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 2,
        data: expect.arrayContaining([
          expect.objectContaining({ _id: 'resA', user: 'userA' }),
          expect.objectContaining({ _id: 'resC', user: 'userA' }),
        ]),
      });
      expect(console.error).not.toHaveBeenCalled();
    });

    test('non-admin sees only own reservations for specific restaurantId', async () => {
      const req = mockReq({ user: { id: 'userA', role: 'user' }, params: { restaurantId: 'rest2' } });
      const res = mockRes();

      await controllers.getReservations(req, res, jest.fn());

      expect(Reservation.find).toHaveBeenCalledWith({ user: 'userA', restaurant: 'rest2' });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 1,
        data: expect.arrayContaining([expect.objectContaining({ _id: 'resC' })]),
      });
      expect(console.error).not.toHaveBeenCalled();
    });

    test('admin sees all reservations (no restaurantId)', async () => {
      const req = mockReq({ user: { id: 'admin1', role: 'admin' } });
      const res = mockRes();

      await controllers.getReservations(req, res, jest.fn());

      expect(Reservation.find).toHaveBeenCalledWith();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: allReservationsDataset.length,
        data: allReservationsDataset,
      });
      expect(console.error).not.toHaveBeenCalled();
    });

    test('admin sees reservations for a specific restaurantId', async () => {
      const req = mockReq({ user: { id: 'admin2', role: 'admin' }, params: { restaurantId: 'rest1' } });
      const res = mockRes();

      await controllers.getReservations(req, res, jest.fn());

      expect(Reservation.find).toHaveBeenCalledWith({ restaurant: 'rest1' });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 2,
        data: expect.arrayContaining([
          expect.objectContaining({ _id: 'resA' }),
          expect.objectContaining({ _id: 'resB' }),
        ]),
      });
      expect(console.error).not.toHaveBeenCalled();
    });

    test('getReservations returns 500 on db error and logs error', async () => {
      const populateMock = jest.fn().mockRejectedValue(new Error('db fail'));
      Reservation.find.mockReturnValue({ populate: populateMock });

      const req = mockReq({ user: { id: 'user1', role: 'user' } });
      const res = mockRes();

      await controllers.getReservations(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Cannot find reservation',
      });

      expect(console.error).toHaveBeenCalled();
      const firstArg = console.error.mock.calls[0][0];
      expect(firstArg).toBeInstanceOf(Error);
      expect(firstArg.message).toBe('db fail');
    });
  });

  describe('getReservation', () => {
    test('returns reservation if found', async () => {
      const fake = { _id: 'res1' };
      Reservation.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(fake),
      });

      const req = mockReq({ params: { id: 'res1' } });
      const res = mockRes();

      await controllers.getReservation(req, res, jest.fn());

      expect(Reservation.findById).toHaveBeenCalledWith('res1');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: fake });
      expect(console.error).not.toHaveBeenCalled();
    });

    test('returns 404 if not found', async () => {
      Reservation.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(null),
      });

      const req = mockReq({ params: { id: 'missing' } });
      const res = mockRes();

      await controllers.getReservation(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'No reservation with the id of missing',
      });
      expect(console.error).not.toHaveBeenCalled();
    });

    test('getReservation returns 500 on error and logs error', async () => {
      Reservation.findById.mockImplementation(() => { throw new Error('boom'); });

      const req = mockReq({ params: { id: 'err' } });
      const res = mockRes();

      await controllers.getReservation(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Cannot find reservation' });

      expect(console.error).toHaveBeenCalled();
      const arg = console.error.mock.calls[0][0];
      expect(arg).toBeInstanceOf(Error);
      expect(arg.message).toBe('boom');
    });
  });

  describe('addReservation', () => {
    test('404 when restaurant not found', async () => {
      Restaurant.findById.mockResolvedValue(null);

      const req = mockReq({
        params: { restaurantId: 'r404' },
        body: { user: 'u1', dateTime: '2025-01-01T10:00:00Z' },
        user: { id: 'u1', role: 'user' },
      });
      const res = mockRes();

      await controllers.addReservation(req, res, jest.fn());

      expect(Restaurant.findById).toHaveBeenCalledWith('r404');
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'No restaurant with the id of r404',
      });

      expect(console.log).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
    });

    test('400 when dateTime missing', async () => {
      Restaurant.findById.mockResolvedValue({ openTime: '10:00', closeTime: '22:00' });

      const req = mockReq({
        params: { restaurantId: 'r1' },
        body: { user: 'u1' },
        user: { id: 'u1', role: 'user' },
      });
      const res = mockRes();

      await controllers.addReservation(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'dateTime is required',
      });
      expect(console.log).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
    });

    test('400 when dateTime outside normal working hours (reject)', async () => {
      Restaurant.findById.mockResolvedValue({ openTime: '10:00', closeTime: '22:00' });

      const req = mockReq({
        params: { restaurantId: 'r2' },
        body: { user: 'u2', dateTime: '2025-01-01T23:00:00Z' },
        user: { id: 'u2', role: 'user' },
      });
      const res = mockRes();

      await controllers.addReservation(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Reservation time is outside restaurant working hours (10:00 - 22:00)',
      });
      expect(console.log).not.toHaveBeenCalled();
    });

    test('allows reservation during overnight schedule for 22:00', async () => {
      Restaurant.findById.mockResolvedValue({ openTime: '20:00', closeTime: '03:00' });

      const req = mockReq({
        params: { restaurantId: 'overnight' },
        body: { user: 'u3', dateTime: '2025-01-01T22:00:00' },
        user: { id: 'u3', role: 'user' },
      });
      const res = mockRes();

      Reservation.create.mockResolvedValue({ _id: 'created1' });

      await controllers.addReservation(req, res, jest.fn());

      expect(Reservation.create).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: { _id: 'created1' } });
      expect(console.log).not.toHaveBeenCalled();
    });

    test('allows reservation during overnight schedule (before close) i.e., 02:00', async () => {
      Restaurant.findById.mockResolvedValue({ openTime: '20:00', closeTime: '03:00' });

      const req = mockReq({
        params: { restaurantId: 'overnight2' },
        body: { user: 'u4', dateTime: '2025-01-02T02:00:00' },
        user: { id: 'u4', role: 'user' },
      });
      const res = mockRes();

      Reservation.create.mockResolvedValue({ _id: 'created2' });

      await controllers.addReservation(req, res, jest.fn());

      expect(Reservation.create).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: { _id: 'created2' } });
      expect(console.log).not.toHaveBeenCalled();
    });

    test('400 when user missing in body', async () => {
      Restaurant.findById.mockResolvedValue({ openTime: '10:00', closeTime: '22:00' });

      const req = mockReq({
        params: { restaurantId: 'r3' },
        body: { dateTime: '2025-01-01T12:00:00' },
        user: { id: 'u5', role: 'user' },
      });
      const res = mockRes();

      await controllers.addReservation(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'user is required in request body',
      });
      expect(console.log).not.toHaveBeenCalled();
    });

    test('400 when user already has 3 reservations and is not admin', async () => {
      Restaurant.findById.mockResolvedValue({ openTime: '10:00', closeTime: '22:00' });

      Reservation.find.mockResolvedValue([1, 2, 3]);

      const req = mockReq({
        params: { restaurantId: 'r4' },
        body: { user: 'u6', dateTime: '2025-01-01T12:00:00' },
        user: { id: 'u6', role: 'user' },
      });
      const res = mockRes();

      await controllers.addReservation(req, res, jest.fn());

      expect(Reservation.find).toHaveBeenCalledWith({ user: 'u6' });
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'The user with ID u6 has already made 3 reservations',
      });
      expect(console.log).not.toHaveBeenCalled();
    });

    test('admin can create even if user has 3 reservations', async () => {
      Restaurant.findById.mockResolvedValue({ openTime: '10:00', closeTime: '22:00' });

      Reservation.find.mockResolvedValue([1, 2, 3]); // >=3

      const req = mockReq({
        params: { restaurantId: 'r5' },
        body: { user: 'u7', dateTime: '2025-01-01T12:00:00' },
        user: { id: 'adminX', role: 'admin' },
      });
      const res = mockRes();

      Reservation.create.mockResolvedValue({ _id: 'createdAdmin' });

      await controllers.addReservation(req, res, jest.fn());

      expect(Reservation.create).toHaveBeenCalledWith(expect.objectContaining({ user: 'u7', restaurant: 'r5' }));
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: { _id: 'createdAdmin' } });
      expect(console.log).not.toHaveBeenCalled();
    });

    test('500 on create error and logs error', async () => {
      Restaurant.findById.mockResolvedValue({ openTime: '10:00', closeTime: '22:00' });
      Reservation.find.mockResolvedValue([]);
      Reservation.create.mockImplementation(() => { throw new Error('create fail'); });

      const req = mockReq({
        params: { restaurantId: 'r6' },
        body: { user: 'u9', dateTime: '2025-01-01T12:00:00' },
        user: { id: 'u9', role: 'user' },
      });
      const res = mockRes();

      await controllers.addReservation(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Cannot create reservation' });

      expect(console.log).toHaveBeenCalled();
      const arg = console.log.mock.calls[0][0];
      expect(arg).toBeInstanceOf(Error);
      expect(arg.message).toBe('create fail');
    });
  });

  describe('updateReservation', () => {
    test('404 if reservation not found', async () => {
      Reservation.findById.mockResolvedValue(null);

      const req = mockReq({ params: { id: 'missing' }, body: {}, user: { id: 'u1', role: 'user' }});
      const res = mockRes();

      await controllers.updateReservation(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: 'No reservation with the id of missing' });
      expect(console.log).not.toHaveBeenCalled();
    });

    test('401 if not owner and not admin', async () => {
      const reservation = { _id: 'rX', user: 'ownerId', restaurant: 'restX' };
      Reservation.findById.mockResolvedValue(reservation);

      const req = mockReq({ params: { id: 'rX' }, body: {}, user: { id: 'notOwner', role: 'user' }});
      const res = mockRes();

      await controllers.updateReservation(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'User notOwner is not authorized to update this reservation',
      });
      expect(console.log).not.toHaveBeenCalled();
    });

    test('404 when restaurant not found during update (dateTime change)', async () => {
      const reservation = { _id: 'rMissingRest', user: 'u12', restaurant: 'restMissing' };
      Reservation.findById.mockResolvedValue(reservation);

      Restaurant.findById.mockResolvedValue(null);

      const req = mockReq({
        params: { id: 'rMissingRest' },
        body: { dateTime: '2025-01-01T12:00:00' },
        user: { id: 'u12', role: 'user' },
      });
      const res = mockRes();

      await controllers.updateReservation(req, res, jest.fn());

      expect(Restaurant.findById).toHaveBeenCalledWith('restMissing');
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'No restaurant with the id of restMissing'
      });

      expect(console.log).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
    });

    test('400 if updating dateTime outside working hours', async () => {
      const reservation = { _id: 'rY', user: 'u10', restaurant: 'restY' };
      Reservation.findById.mockResolvedValue(reservation);

      Restaurant.findById.mockResolvedValue({ openTime: '10:00', closeTime: '18:00' });

      const req = mockReq({
        params: { id: 'rY' },
        body: { dateTime: '2025-01-01T20:00:00' },
        user: { id: 'u10', role: 'user' },
      });
      const res = mockRes();

      await controllers.updateReservation(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Reservation time is outside restaurant working hours (10:00 - 18:00)',
      });
      expect(console.log).not.toHaveBeenCalled();
    });

    test('200 on successful update', async () => {
      const reservation = { _id: 'rZ', user: 'u11', restaurant: 'restZ' };
      Reservation.findById.mockResolvedValue(reservation);

      Restaurant.findById.mockResolvedValue({ openTime: '08:00', closeTime: '23:00' });

      const updated = { _id: 'rZ', user: 'u11', restaurant: 'restZ', dateTime: '2025-01-01T10:00:00' };
      Reservation.findByIdAndUpdate.mockResolvedValue(updated);

      const req = mockReq({
        params: { id: 'rZ' },
        body: { dateTime: '2025-01-01T10:00:00' },
        user: { id: 'u11', role: 'user' },
      });
      const res = mockRes();

      await controllers.updateReservation(req, res, jest.fn());

      expect(Reservation.findByIdAndUpdate).toHaveBeenCalledWith('rZ', { dateTime: '2025-01-01T10:00:00' }, { new: true, runValidators: true});
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: updated });
      expect(console.log).not.toHaveBeenCalled();
    });

    test('500 on update error and logs error', async () => {
      Reservation.findById.mockResolvedValue({ _id: 'rErr', user: 'uErr', restaurant: 'rErr' });
      Restaurant.findById.mockResolvedValue({ openTime: '08:00', closeTime: '23:00' });

      Reservation.findByIdAndUpdate.mockImplementation(() => { throw new Error('update fail'); });

      const req = mockReq({ params: { id: 'rErr' }, body: { dateTime: '2025-01-01T09:00:00' }, user: { id: 'uErr', role: 'user' }});
      const res = mockRes();

      await controllers.updateReservation(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Cannot update reservation' });

      expect(console.log).toHaveBeenCalled();
      const arg = console.log.mock.calls[0][0];
      expect(arg).toBeInstanceOf(Error);
      expect(arg.message).toBe('update fail');
    });
  });

  describe('deleteReservation', () => {
    test('404 if reservation not found', async () => {
      Reservation.findById.mockResolvedValue(null);

      const req = mockReq({ params: { id: 'notfound' }, user: { id: 'u1', role: 'user' }});
      const res = mockRes();

      await controllers.deleteReservation(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: 'No reservation with the id of notfound' });
      expect(console.error).not.toHaveBeenCalled();
      expect(console.log).not.toHaveBeenCalled();
    });

    test('401 if not owner and not admin', async () => {
      Reservation.findById.mockResolvedValue({ _id: 'rDel', user: 'owner', restaurant: 'r' });

      const req = mockReq({ params: { id: 'rDel' }, user: { id: 'someone', role: 'user' }});
      const res = mockRes();

      await controllers.deleteReservation(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: 'User someone is not authorized to delete this reservation' });
      expect(console.error).not.toHaveBeenCalled();
    });

    test('200 on successful delete', async () => {
      const reservation = { _id: 'rOK', user: 'uDel', deleteOne: jest.fn().mockResolvedValue() };
      Reservation.findById.mockResolvedValue(reservation);

      const req = mockReq({ params: { id: 'rOK' }, user: { id: 'uDel', role: 'user' }});
      const res = mockRes();

      await controllers.deleteReservation(req, res, jest.fn());

      expect(reservation.deleteOne).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: {} });
      expect(console.error).not.toHaveBeenCalled();
    });

    test('500 on delete error and logs error', async () => {
      Reservation.findById.mockImplementation(() => { throw new Error('boom delete'); });

      const req = mockReq({ params: { id: 'errDel' }, user: { id: 'uErr', role: 'user' }});
      const res = mockRes();

      await controllers.deleteReservation(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Cannot delete reservation' });

      expect(console.error).toHaveBeenCalled();
      const arg = console.error.mock.calls[0][0];
      expect(arg).toBeInstanceOf(Error);
      expect(arg.message).toBe('boom delete');
    });
  });

  // Extra tests to cover parseHHMMToMinutes/isWithinWorkingHours edge cases
  describe('isWithinWorkingHours / parseHHMMToMinutes edge cases', () => {
    test('invalid restaurant hours cause addReservation to reject', async () => {
      Restaurant.findById.mockResolvedValue({ openTime: null, closeTime: 'xx' });

      const req = mockReq({
        params: { restaurantId: 'badtimes' },
        body: { user: 'uX', dateTime: '2025-01-01T12:00:00' },
        user: { id: 'uX', role: 'user' },
      });
      const res = mockRes();

      await controllers.addReservation(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Reservation time is outside restaurant working hours (null - xx)'
      });
      expect(console.log).not.toHaveBeenCalled();
    });

    test('reservation exactly at open time is allowed', async () => {
      Restaurant.findById.mockResolvedValue({ openTime: '10:00', closeTime: '22:00' });
      Reservation.find.mockResolvedValue([]);
      Reservation.create.mockResolvedValue({ _id: 'atOpen' });

      const req = mockReq({
        params: { restaurantId: 'rOpen' },
        body: { user: 'uOpen', dateTime: '2025-01-01T10:00:00' },
        user: { id: 'uOpen', role: 'user' },
      });
      const res = mockRes();
      await controllers.addReservation(req, res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(201);
      expect(Reservation.create).toHaveBeenCalled();
    });

    test('reservation exactly at close time is allowed', async () => {
      Restaurant.findById.mockResolvedValue({ openTime: '10:00', closeTime: '22:00' });
      Reservation.find.mockResolvedValue([]);
      Reservation.create.mockResolvedValue({ _id: 'atClose' });

      const req = mockReq({
        params: { restaurantId: 'rClose' },
        body: { user: 'uClose', dateTime: '2025-01-01T22:00:00' },
        user: { id: 'uClose', role: 'user' },
      });
      const res = mockRes();
      await controllers.addReservation(req, res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(201);
      expect(Reservation.create).toHaveBeenCalled();
    });
  });
});
