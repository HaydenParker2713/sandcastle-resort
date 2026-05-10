const reviewRepo = require('../repositories/reviewRepository');

const reviewService = {
  async createReview({ reservation_id, user_id, unit_id, rating, comment }) {
    return reviewRepo.insert({ reservation_id, user_id, unit_id, rating, comment });
  },

  async getReviewByReservation(reservation_id) {
    return reviewRepo.findByReservation(reservation_id);
  },

  async getReviewsByUnit(unit_id) {
    return reviewRepo.findByUnit(unit_id);
  },

  async getReviewedReservationIds(user_id) {
    return reviewRepo.findReviewedReservationIds(user_id);
  },

  async getAllReviews() {
    return reviewRepo.findAll();
  },
};

module.exports = reviewService;
