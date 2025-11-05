import { Router } from 'express';
import Report from '../models/Report.js';
import { summarizeClinicalText } from '../services/ai.js';

const router = Router();

// Simple info endpoint to avoid "Cannot GET /summaries"
router.get('/', async (_req, res) => {
  return res.json({ ok: true, usage: 'POST /summaries/:reportId to generate summary. GET /summaries/:reportId to fetch existing summary.' });
});

// Fetch existing summary for a report
router.get('/:reportId', async (req, res) => {
  try {
    const report = await Report.findOne({ _id: req.params.reportId });
    if (!report) return res.status(404).json({ message: 'Report not found' });
    return res.json({ summaryText: report.summaryText || null, status: report.status, reportId: report._id });
  } catch (e) {
    return res.status(500).json({ message: 'Failed to fetch summary' });
  }
});

router.post('/:reportId', async (req, res) => {
  try {
    const report = await Report.findOne({ _id: req.params.reportId });
    if (!report) return res.status(404).json({ message: 'Report not found' });
    if (!report.originalText) return res.status(400).json({ message: 'No text available to summarize' });

    report.status = 'pending';
    await report.save();

    const summaryText = await summarizeClinicalText(report.originalText);
    report.summaryText = summaryText;
    report.status = 'completed';
    await report.save();
    return res.json({ report });
  } catch (e) {
    return res.status(500).json({ message: 'Failed to generate summary' });
  }
});

export default router;
