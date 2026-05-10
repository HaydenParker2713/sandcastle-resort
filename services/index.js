// Re-exports all services so existing route files can keep their current import:
//   const { unitService } = require('../services');
module.exports = {
  unitService:          require('./unit'),
  authService:          require('./auth'),
  userService:          require('./userService'),
  passwordService:      require('./passwordService'),
  reservationService:   require('./reservation'),
  invoiceService:       require('./invoice'),
  ticketService:        require('./ticket'),
  reviewService:        require('./review'),
  statsService:         require('./stats'),
  eventService:         require('./event'),
  barService:           require('./bar'),
  activityListService:  require('./activityList'),
};
