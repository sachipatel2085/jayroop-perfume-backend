import { buildOverview, buildReport, REPORT_TYPES } from '../services/reports/reportData.js';
import { renderReportXlsx } from '../services/reports/excelExport.js';
import { renderReportPdf } from '../services/reports/pdfExport.js';
import { logAdminAction } from '../utils/auditLogger.js';

// @desc    Report types available for export
// @route   GET /api/v1/admin/reports/types
export const getReportTypes = (req, res) => {
  res.status(200).json({
    success: true,
    data: Object.entries(REPORT_TYPES).map(([key, title]) => ({ key, title })),
  });
};

// @desc    Interactive analytics for the admin Reports page
// @route   GET /api/v1/admin/reports/overview?from=YYYY-MM-DD&to=YYYY-MM-DD&groupBy=day|month
export const getReportOverview = async (req, res, next) => {
  try {
    const data = await buildOverview({ from: req.query.from, to: req.query.to, groupBy: req.query.groupBy === 'month' ? 'month' : 'day' });
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// @desc    Preview a report as JSON (first 200 rows per sheet)
// @route   GET /api/v1/admin/reports/:type?from&to
export const previewReport = async (req, res, next) => {
  try {
    const report = await buildReport(req.params.type, { from: req.query.from, to: req.query.to });
    res.status(200).json({
      success: true,
      data: {
        ...report,
        sheets: report.sheets.map((s) => ({ ...s, totalRows: s.rows.length, rows: s.rows.slice(0, 200) })),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Download report as Excel (.xlsx) or PDF
// @route   GET /api/v1/admin/reports/:type/export?format=xlsx|pdf&from&to
export const exportReport = async (req, res, next) => {
  try {
    const format = req.query.format === 'pdf' ? 'pdf' : 'xlsx';
    const report = await buildReport(req.params.type, { from: req.query.from, to: req.query.to });
    const buffer = format === 'pdf' ? await renderReportPdf(report) : Buffer.from(await renderReportXlsx(report));
    const filename = `Jayrup-${report.title.replace(/[^a-z0-9]+/gi, '-')}-${report.from}_to_${report.to}.${format}`;

    await logAdminAction({ req, action: 'REPORT_EXPORTED', resource: 'Report', resourceId: req.params.type, details: { format, from: report.from, to: report.to } });

    res.setHeader(
      'Content-Type',
      format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'private, no-store');
    res.end(buffer);
  } catch (error) {
    next(error);
  }
};
