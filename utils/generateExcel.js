const ExcelJS = require('exceljs');
const moment = require('moment');

const generateExcel = async (reportData, { period, startDate, endDate }) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Sales Report');

  // Metadata
  worksheet.addRow(['Solo Sales Report']);
  worksheet.addRow(['Period', period]);
  worksheet.addRow(['Date Range', `${moment(startDate).format('YYYY-MM-DD')} to ${moment(endDate).format('YYYY-MM-DD')}`]);
  worksheet.addRow([]);

  // Headers
  worksheet.addRow(['Date', 'Sales Count', 'Total Revenue', 'Total Discounts']);
  worksheet.getRow(5).font = { bold: true };

  // Data
  reportData.forEach((row) => {
    worksheet.addRow([
      row.date || period,
      row.salesCount,
      row.totalRevenue,
      row.totalDiscounts,
    ]);
  });

  // Formatting
  worksheet.columns.forEach((column, i) => {
    column.width = i === 0 ? 15 : 20;
    if (i >= 2) column.numFmt = '₹#,##0.00';
  });

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
};

module.exports = { generateExcel };