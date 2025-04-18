const PDFDocument = require('pdfkit');
const moment = require('moment');

const generatePDF = async (reportData, { period, startDate, endDate }) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    const buffers = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));

    // Header
    doc.fontSize(20).text('E-commerce Sales Report', { align: 'center' });
    doc.fontSize(12).text(`Period: ${period}`, { align: 'center' });
    doc.text(`Date Range: ${moment(startDate).format('YYYY-MM-DD')} to ${moment(endDate).format('YYYY-MM-DD')}`, { align: 'center' });
    doc.moveDown();

    // Table Header
    doc.fontSize(10).text('Date', 50, 150, { width: 100 });
    doc.text('Sales Count', 150, 150, { width: 100 });
    doc.text('Total Revenue', 250, 150, { width: 100 });
    doc.text('Total Discounts', 350, 150, { width: 100 });
    doc.moveTo(50, 170).lineTo(450, 170).stroke();

    // Table Data
    let y = 180;
    reportData.forEach((row) => {
      doc.text(row.date || period, 50, y, { width: 100 });
      doc.text(row.salesCount.toString(), 150, y, { width: 100 });
      doc.text(`INR${row.totalRevenue.toFixed(2)}`, 250, y, { width: 100 });
      doc.text(`INR${row.totalDiscounts.toFixed(2)}`, 350, y, { width: 100 });
      y += 20;
    });

    doc.end();
  });
};

module.exports = { generatePDF };