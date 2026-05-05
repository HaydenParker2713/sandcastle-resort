const { pool } = require('../config/db');

const statsService = {
  // All four queries are independent — run them in parallel with Promise.all
  // instead of sequentially so the endpoint is ~4x faster.
  async getAdminStats() {
    const [
      [[revenue]],
      [monthly],
      [[avgRating]],
      [[avgPerGuest]],
    ] = await Promise.all([
      pool.execute(
        `SELECT COALESCE(SUM(total_amount), 0) AS total_revenue,
                COUNT(*) AS total_invoices
         FROM invoices WHERE status = 'paid'`
      ),
      pool.execute(
        `SELECT DATE_FORMAT(i.created_at, '%Y-%m') AS month,
                COALESCE(SUM(i.total_amount), 0)   AS revenue,
                COUNT(*) AS bookings
         FROM invoices i
         JOIN reservations r ON i.reservation_id = r.reservation_id
         WHERE r.status = 'confirmed'
           AND i.status = 'paid'
           AND i.created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
         GROUP BY month
         ORDER BY month ASC`
      ),
      pool.execute(
        `SELECT ROUND(AVG(rating), 1) AS avg_rating,
                COUNT(*) AS total_reviews
         FROM reviews`
      ),
      pool.execute(
        `SELECT ROUND(AVG(guest_total), 2) AS avg_revenue_per_guest
         FROM (
           SELECT r.user_id, SUM(i.total_amount) AS guest_total
           FROM reservations r
           JOIN invoices i ON r.reservation_id = i.reservation_id
           WHERE i.status = 'paid'
           GROUP BY r.user_id
         ) guest_totals`
      ),
    ]);

    return { revenue, monthly, avgRating, avgPerGuest };
  },
};

module.exports = statsService;
