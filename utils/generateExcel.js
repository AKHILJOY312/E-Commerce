const ExcelJS = require('exceljs');
const moment = require('moment');

const generateExcel = async (reportData, { period, startDate, endDate }) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Sales Report');

  // Document title and metadata
  worksheet.addRow(['Solo Fashion Sales Report']);
  worksheet.getRow(1).font = { bold: true, size: 16 };
  worksheet.getRow(1).alignment = { horizontal: 'center' };
  worksheet.mergeCells('A1:F1');
  
  worksheet.addRow(['Period', period]);
  worksheet.addRow(['Date Range', `${moment(startDate).format('YYYY-MM-DD')} to ${moment(endDate).format('YYYY-MM-DD')}`]);
  worksheet.addRow([]);

  // Sales Summary Headers
  const headerRow = worksheet.addRow(['Date', 'Sales Count', 'Total Orders', 'Total Revenue', 'Total Discounts', 'Avg Order Value']);
  headerRow.font = { bold: true };
  headerRow.alignment = { horizontal: 'center' };

  // Apply cell formatting for the header row
  ['A', 'B', 'C', 'D', 'E', 'F'].forEach(col => {
    worksheet.getCell(`${col}5`).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' }  // Light gray background
    };
    worksheet.getCell(`${col}5`).border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
  });

  // Sales Summary Data
  let rowIndex = 6;
  reportData.forEach((row) => {
    const dataRow = worksheet.addRow([
      row.date || period,
      row.salesCount || 0,
      row.totalOrders || 0,
      row.totalRevenue || 0,
      row.totalDiscounts || 0,
      row.averageOrderValue || 0
    ]);
    
    // Apply right alignment to numeric cells
    dataRow.getCell(2).alignment = { horizontal: 'right' };
    dataRow.getCell(3).alignment = { horizontal: 'right' };
    dataRow.getCell(4).alignment = { horizontal: 'right' };
    dataRow.getCell(5).alignment = { horizontal: 'right' };
    dataRow.getCell(6).alignment = { horizontal: 'right' };
    
    // Apply borders
    ['A', 'B', 'C', 'D', 'E', 'F'].forEach(col => {
      worksheet.getCell(`${col}${rowIndex}`).border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });
    
    rowIndex++;
  });

  // Formatting for columns
  worksheet.getColumn(1).width = 15;  // Date
  worksheet.getColumn(2).width = 15;  // Sales Count
  worksheet.getColumn(3).width = 15;  // Total Orders
  worksheet.getColumn(4).width = 20;  // Total Revenue
  worksheet.getColumn(5).width = 20;  // Total Discounts
  worksheet.getColumn(6).width = 20;  // Avg Order Value
  
  // Currency formatting
  worksheet.getColumn(4).numFmt = '₹#,##0.00';  // Total Revenue
  worksheet.getColumn(5).numFmt = '₹#,##0.00';  // Total Discounts
  worksheet.getColumn(6).numFmt = '₹#,##0.00';  // Avg Order Value

  // Add space before product details
  worksheet.addRow([]);
  rowIndex++;
  
  // Product Details Title
  const productTitleRow = worksheet.addRow(['Product Details']);
  productTitleRow.font = { bold: true, size: 14 };
  worksheet.mergeCells(`A${rowIndex}:B${rowIndex}`);
  rowIndex++;
  
  worksheet.addRow([]);
  rowIndex++;

  // For each period, add product details
  reportData.forEach((row) => {
    // Period title
    const periodTitleRow = worksheet.addRow([`Period: ${row.date || period}`]);
    periodTitleRow.font = { bold: true };
    worksheet.mergeCells(`A${rowIndex}:B${rowIndex}`);
    rowIndex++;
    
    // Product table headers
    const productHeaderRow = worksheet.addRow(['Product Name', 'Quantity Sold']);
    productHeaderRow.font = { bold: true };
    
    // Apply formatting to product headers
    ['A', 'B'].forEach(col => {
      worksheet.getCell(`${col}${rowIndex}`).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD3D3D3' }  // Light gray background
      };
      worksheet.getCell(`${col}${rowIndex}`).border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });
    
    rowIndex++;
    
    // Product data
    if (row.products && row.products.length > 0) {
      row.products.forEach(product => {
        const productRow = worksheet.addRow([
          product.name || 'Unknown Product',
          product.quantity || 0
        ]);
        
        // Apply right alignment to quantity
        productRow.getCell(2).alignment = { horizontal: 'right' };
        
        // Apply borders
        ['A', 'B'].forEach(col => {
          worksheet.getCell(`${col}${rowIndex}`).border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        });
        
        rowIndex++;
      });
    } else {
      const noProductsRow = worksheet.addRow(['No products found for this period.']);
      worksheet.mergeCells(`A${rowIndex}:B${rowIndex}`);
      
      // Apply borders
      ['A', 'B'].forEach(col => {
        worksheet.getCell(`${col}${rowIndex}`).border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
      
      rowIndex++;
    }
    
    // Add space after each period's product section
    worksheet.addRow([]);
    rowIndex++;
  });

  // Set column widths for product details
  worksheet.getColumn(1).width = 40;  // Product Name
  worksheet.getColumn(2).width = 15;  // Quantity Sold

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
};

module.exports = { generateExcel };