const cron = require('node-cron');
const OfferService = require('../services/OfferService');

const scheduleOfferJobs = () => {
  // Run every day at midnight
  cron.schedule('0 0 * * *', async () => {
    console.log('Running scheduled sale price update');
    await OfferService.updateSalePrices();
  });
};

module.exports = scheduleOfferJobs;