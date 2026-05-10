const invoiceRepo = require('../repositories/invoiceRepository');

const invoiceService = {
  async getInvoicesByUser(user_id) {
    return invoiceRepo.findByUser(user_id);
  },

  async getAllInvoices() {
    return invoiceRepo.findAll();
  },

  async markInvoicePaid(invoice_id) {
    return invoiceRepo.markPaid(invoice_id);
  },

  async getInvoiceById(invoice_id) {
    return invoiceRepo.findById(invoice_id);
  },
};

module.exports = invoiceService;
