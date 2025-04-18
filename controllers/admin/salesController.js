const SalesReport = require('../../models/SalesReport');
const Category = require('../../models/Category');
const { generatePDF } = require('../../utils/generatePDF');
const { generateExcel } = require('../../utils/generateExcel');

class SalesReportController {
  // Render sales report page
  static async getSalesReport(req, res, next) {
    try {
      const {
        period = 'daily',
        startDate,
        endDate,
        search,
        categoryId,
        region,
        page = 1,
      } = req.query;

      // Log query parameters for debugging
      console.log('Query Parameters:', { period, startDate, endDate, search, categoryId, region, page });

      // Fetch report data from model
      const { reportData, totalPages, currentPage, startDate: reportStartDate, endDate: reportEndDate } = await SalesReport.getReport({
        period,
        startDate,
        endDate,
        search,
        categoryId,
        region,
        page,
      });

      // Fetch categories for filter modal
      const categories = await Category.find({ isDeleted: false });

      // Render view
      res.render('sales/salesReport', {
        reportData,
        categories,
        period,
        startDate: startDate || reportStartDate?.toISOString().split('T')[0],
        endDate: endDate || reportEndDate?.toISOString().split('T')[0],
        searchQuery: search,
        categoryId,
        region,
        currentPage,
        totalPages,
        messages: req.session.messages || {},
      });

      // Clear session messages
      req.session.messages = {};
    } catch (error) {
      console.error('Error in getSalesReport:', error);
      req.session.messages = { error: [error.message] };
      res.redirect('/admin/sales');
    }
  }

  // API to get sales report data
  static async getSalesReportApi(req, res, next) {
    try {
      const { period, startDate, endDate, categoryId, region, search, page = 1 } = req.query;

      // Log query parameters for debugging
      console.log('API Query Parameters:', { period, startDate, endDate, categoryId, region, search, page });

      // Validate period
      const validPeriods = ['daily', 'weekly', 'yearly', 'custom'];
      if (!period || !validPeriods.includes(period)) {
        return res.status(400).json({ message: 'Invalid period. Use daily, weekly, yearly, or custom.' });
      }

      // Fetch report data
      const { reportData, startDate: reportStartDate, endDate: reportEndDate } = await SalesReport.getReport({
        period,
        startDate,
        endDate,
        search,
        categoryId,
        region,
        page,
      });

      res.status(200).json({
        period,
        startDate: reportStartDate,
        endDate: reportEndDate,
        data: reportData,
      });
    } catch (error) {
      console.error('Error in getSalesReportApi:', error);
      next(error);
    }
  }

  // Download report as PDF or Excel
  static async downloadSalesReport(req, res, next) {
    try {
      const { format, period, startDate, endDate, categoryId, region, search } = req.query;

      // Log query parameters for debugging
      console.log('Download Query Parameters:', { format, period, startDate, endDate, categoryId, region, search });

      if (!format || !['pdf', 'excel'].includes(format)) {
        return res.status(400).json({ message: 'Invalid format. Use pdf or excel.' });
      }

      // Fetch report data
      const { reportData } = await SalesReport.getReport({
        period,
        startDate,
        endDate,
        search,
        categoryId,
        region,
      });

      if (format === 'pdf') {
        const pdfBuffer = await generatePDF(reportData, { period, startDate, endDate });
        res.set({
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename=sales_report_${period}_${Date.now()}.pdf`,
        });
        res.send(pdfBuffer);
      } else {
        const excelBuffer = await generateExcel(reportData, { period, startDate, endDate });
        res.set({
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename=sales_report_${period}_${Date.now()}.xlsx`,
        });
        res.send(excelBuffer);
      }
    } catch (error) {
      console.error('Error in downloadSalesReport:', error);
      next(error);
    }
  }
}

module.exports = SalesReportController;