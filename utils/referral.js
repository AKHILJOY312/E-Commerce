const { nanoid } = require('nanoid'); // For generating unique codes

const generateReferralCode = () => {
  return nanoid(8); // Generates an 8-character unique code
};

module.exports = { generateReferralCode };