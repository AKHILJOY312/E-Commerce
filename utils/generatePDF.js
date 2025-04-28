const PDFDocument = require('pdfkit');
const moment = require('moment');

const generatePDF = async (reportData, { period, startDate, endDate }) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const buffers = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', (err) => reject(err));

    const drawTableRow = (doc, y, rowData, columnConfigs, isHeader = false) => {
      doc.font(isHeader ? 'Helvetica-Bold' : 'Helvetica');
      doc.fontSize(10);

      columnConfigs.forEach(col => {
        let val = rowData[col.key];
        let text = '';

        if (col.format) {
          text = col.format(val);
        } else if (val !== undefined && val !== null) {
          text = String(val);
        } else {
          text = col.defaultValue || '';
        }

        // Use PDFKit's built-in alignment options
        doc.text(text, col.x, y, {
          width: col.width,
          align: col.align || 'left',
          continued: false
        });
      });
    };

    const mainTableColumns = [
        { header: 'Date', key: 'date', width: 70, x: 50, align: 'left', defaultValue: period },
        { header: 'Sales Count', key: 'salesCount', width: 80, x: 120, align: 'right', format: (val) => (val !== undefined && val !== null) ? String(val) : '0' },
        { header: 'Total Orders', key: 'totalOrders', width: 80, x: 200, align: 'right', format: (val) => (val !== undefined && val !== null) ? String(val) : '0' },
        {
          header: 'Total Revenue',
          key: 'totalRevenue',
          width: 90,
          x: 280,
          align: 'right',
          format: (val) => (val !== undefined && val !== null && typeof val === 'number') ? `INR ${val.toFixed(2)}` : 'INR 0.00'
        },
        {
          header: 'Total Discounts',
          key: 'totalDiscounts',
          width: 90,
          x: 370,
          align: 'right',
          format: (val) => (val !== undefined && val !== null && typeof val === 'number') ? `INR ${val.toFixed(2)}` : 'INR 0.00'
        },
        {
          header: 'Avg Order Value',
          key: 'averageOrderValue',
          width: 90,
          x: 460,
          align: 'right',
          format: (val) => (val !== undefined && val !== null && typeof val === 'number') ? `INR ${val.toFixed(2)}` : 'N/A'
        },
    ];
    const mainTableStartX = 50;
    const mainTableEndX = mainTableColumns[mainTableColumns.length - 1].x + mainTableColumns[mainTableColumns.length - 1].width;
    const mainTableWidth = mainTableEndX - mainTableStartX;

    const productTableColumns = [
      { header: 'Product Name', key: 'name', width: 300, x: 50, align: 'left', defaultValue: 'Unknown Product' },
      {
        header: 'Quantity Sold',
        key: 'quantity',
        width: 100,
        x: 350,
        align: 'right',
        format: (val) => (val !== undefined && val !== null) ? String(val) : '0'
      },
    ];
    const productTableStartX = 50;
    const productTableEndX = productTableColumns[productTableColumns.length - 1].x + productTableColumns[productTableColumns.length - 1].width;
    const productTableWidth = productTableEndX - productTableStartX;


    doc.fontSize(20).font('Helvetica-Bold').text('Solo Fashion Sales Report', { align: 'center' });
    doc.fontSize(12).font('Helvetica').text(`Period: ${period}`, { align: 'center' });
    doc.text(
      `Date Range: ${moment(startDate).format('YYYY-MM-DD')} to ${moment(endDate).format('YYYY-MM-DD')}`,
      { align: 'center' }
    );
    doc.moveDown(2);

    let currentY = doc.y + 20;
    drawTableRow(doc, currentY,
        mainTableColumns.reduce((acc, col) => ({ ...acc, [col.key]: col.header }), {}),
        mainTableColumns,
        true
    );
    currentY += 15;
    doc.lineWidth(1);
    doc.moveTo(mainTableStartX, currentY).lineTo(mainTableEndX, currentY).stroke();
    currentY += 15;
    doc.lineWidth(0.5);

    const mainTableRowHeight = 20;
    const mainTableMaxY = doc.page.height - doc.page.margins.bottom - mainTableRowHeight;

    reportData.forEach((row) => {
      if (currentY + mainTableRowHeight > mainTableMaxY) {
        doc.addPage();
        currentY = doc.page.margins.top;

        drawTableRow(doc, currentY,
            mainTableColumns.reduce((acc, col) => ({ ...acc, [col.key]: col.header }), {}),
            mainTableColumns,
            true
        );
        currentY += 15;
        doc.lineWidth(1);
        doc.moveTo(mainTableStartX, currentY).lineTo(mainTableEndX, currentY).stroke();
        currentY += 15;
        doc.lineWidth(0.5);
      }

      drawTableRow(doc, currentY, row, mainTableColumns);
      currentY += mainTableRowHeight;

      doc.moveTo(mainTableStartX, currentY - 5).lineTo(mainTableEndX, currentY - 5).stroke();
    });

    currentY += 30;

     const productDetailsHeadingHeight = 30;
     if (currentY + productDetailsHeadingHeight > mainTableMaxY) {
        doc.addPage();
        currentY = doc.page.margins.top;
     }

    doc.fontSize(14).font('Helvetica-Bold');
    doc.text('Product Details', productTableStartX, currentY);

    currentY = doc.y + 20;
    doc.font('Helvetica');

    const productTableRowHeight = 20;
    const productTableMaxY = doc.page.height - doc.page.margins.bottom - productTableRowHeight;

    reportData.forEach((row, index) => {
       const periodSubheaderHeight = 25;
       const productTableHeaderHeight = 25;

       if (currentY + periodSubheaderHeight + productTableHeaderHeight + productTableRowHeight > productTableMaxY) {
            doc.addPage();
            currentY = doc.page.margins.top;
       }

      doc.fontSize(12).font('Helvetica-Bold');
      doc.text(`Period: ${row.date || period}`, productTableStartX, currentY);
      currentY = doc.y + 15;
      doc.font('Helvetica');

      drawTableRow(doc, currentY,
        productTableColumns.reduce((acc, col) => ({ ...acc, [col.key]: col.header }), {}),
        productTableColumns,
        true
      );
      currentY += 15;
      doc.lineWidth(1);
      doc.moveTo(productTableStartX, currentY).lineTo(productTableEndX, currentY).stroke();
      currentY += 15;
      doc.lineWidth(0.5);

      if (row.products && row.products.length > 0) {
        row.products.forEach((product) => {
          if (currentY + productTableRowHeight > productTableMaxY) {
            doc.addPage();
            currentY = doc.page.margins.top;

             drawTableRow(doc, currentY,
                productTableColumns.reduce((acc, col) => ({ ...acc, [col.key]: col.header }), {}),
                productTableColumns,
                true
             );
             currentY += 15;
             doc.lineWidth(1);
             doc.moveTo(productTableStartX, currentY).lineTo(productTableEndX, currentY).stroke();
             currentY += 15;
             doc.lineWidth(0.5);
          }

          drawTableRow(doc, currentY, product, productTableColumns);
          currentY += productTableRowHeight;
          doc.moveTo(productTableStartX, currentY - 5).lineTo(productTableEndX, currentY - 5).stroke();
        });
      } else {
         if (currentY + productTableRowHeight > productTableMaxY) {
            doc.addPage();
            currentY = doc.page.margins.top;
             drawTableRow(doc, currentY,
                productTableColumns.reduce((acc, col) => ({ ...acc, [col.key]: col.header }), {}),
                productTableColumns,
                true
             );
             currentY += 15;
             doc.lineWidth(1);
             doc.moveTo(productTableStartX, currentY).lineTo(productTableEndX, currentY).stroke();
             currentY += 15;
             doc.lineWidth(0.5);
         }
        doc.text('No products found for this period.', productTableStartX, currentY, { width: productTableWidth });
        currentY += productTableRowHeight;
        doc.moveTo(productTableStartX, currentY - 5).lineTo(productTableEndX, currentY - 5).stroke();
      }

      if (index < reportData.length - 1) {
         currentY += 20;
      }

       if (index < reportData.length - 1 && currentY + periodSubheaderHeight + productTableHeaderHeight + productTableRowHeight > productTableMaxY) {
            doc.addPage();
            currentY = doc.page.margins.top;
       }
    });

    doc.end();
  });
};

module.exports = { generatePDF };