import { Router } from "express";
import multer from "multer";
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import mongoose from 'mongoose'
import { requireAuth } from "../middleware/auth.js";
import Report from "../models/Report.js";
import { createReportSchema } from "../validators/reports.js";
import { extractTextFromImage } from "../services/ocr.js";
import { summarizeClinicalText } from "../services/ai.js";

// 🧩 Node ke liye DOM polyfills (pdf-parse ke liye zaruri)
if (typeof globalThis.DOMMatrix === "undefined") {
  globalThis.DOMMatrix = class {};
  globalThis.DOMMatrixReadOnly = class {};
  globalThis.ImageData = class {};
  globalThis.Path2D = class {};
  globalThis.CanvasRenderingContext2D = class {};
  globalThis.window = {};
  globalThis.document = {};
  globalThis.PDFJS_DISABLE_WORKER = true;
}

// pdf-parse loader (resolved at runtime when needed)
let pdfParse = null;

const router = Router();

// 🧩 Multer config for file uploads (PDF/Image) - use disk storage for reliability
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

// ----------------------------------
// 📄 List all reports
// ----------------------------------
router.get("/", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit || "10", 10)));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Report.find({})
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Report.countDocuments({}),
    ]);

    res.json({ items, total, page, limit });
  } catch (err) {
    console.error("Error listing reports:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ----------------------------------
// 📄 Get a single report
// ----------------------------------
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params
    console.log('🔎 Fetch report by id:', id)
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid report id' })
    }
    const report = await Report.findById(id)
    if (!report) return res.status(404).json({ message: "Not found" });
    res.json({ report });
  } catch (err) {
    console.error("Error fetching report:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ----------------------------------
// 📝 Create report from text or image
// ----------------------------------
router.post("/", requireAuth, upload.single("image"), async (req, res) => {
  try {
    const body = { sourceType: req.body.sourceType, text: req.body.text };
    const parsed = createReportSchema.safeParse(body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid input" });

    const { sourceType, text } = parsed.data;
    let extractedText = "";

    if (sourceType === "text") {
      if (!text?.trim()) return res.status(400).json({ message: "Text is required" });
      extractedText = text.trim();
    } else if (sourceType === "image") {
      if (!req.file) return res.status(400).json({ message: "Image file required" });
      const mime = req.file.mimetype || "";
      if (!/^image\/(png|jpeg|jpg|webp|tiff|bmp)$/.test(mime)) {
        return res.status(400).json({ message: "Unsupported image type" });
      }

      extractedText = await extractTextFromImage(req.file.buffer);
      if (!extractedText) {
        return res.status(400).json({ message: "Unable to extract text from image" });
      }
    }

    // 🔹 Try to summarize; if it fails (rate limit, etc.), still create report
    let summaryText
    let status = 'completed'
    try {
      summaryText = await summarizeClinicalText(extractedText)
    } catch (err) {
      console.warn('Summarize failed, creating report without summary:', err?.message)
      status = 'pending'
    }

    const report = await Report.create({
      userId: req.user.id,
      sourceType,
      originalText: extractedText,
      summaryText: summaryText || undefined,
      status,
    });

    res.status(201).json({ report });
  } catch (err) {
    console.error("Error creating report:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ----------------------------------
// 📄 Upload & summarize PDF report
// ----------------------------------
router.post("/pdf", requireAuth, upload.any(), async (req, res) => {
  try {
    console.log("📥 Received PDF upload request");

    // Accept any field name; pick first PDF-like file
    const files = Array.isArray(req.files) ? req.files : []
    let file = files.find(f => {
      const mime = (f.mimetype || '').toLowerCase()
      const name = (f.originalname || '').toLowerCase()
      return mime === 'application/pdf' || mime === 'application/x-pdf' || name.endsWith('.pdf')
    }) || files[0]
    if (!file) {
      return res.status(400).json({ message: "PDF file is required" });
    }
    // Try in-memory buffer first, then fallback to disk path (with small retry)
    let fileBuffer = file.buffer
    if (!fileBuffer || fileBuffer.length === 0) {
      const tryRead = async (attempts = 3) => {
        for (let i = 0; i < attempts; i++) {
          try {
            if (file.path) {
              const buf = await fs.readFile(file.path)
              if (buf && buf.length > 0) return buf
            }
          } catch (_) {}
          // wait a bit before retrying (handles occasional FS latency)
          await new Promise(r => setTimeout(r, 120))
        }
        return null
      }
      fileBuffer = await tryRead(3)
    }
    const bufLen = fileBuffer ? fileBuffer.length : 0
    const fileSize = typeof file.size === 'number' ? file.size : -1
    if (!fileBuffer || bufLen === 0) {
      console.warn(`⚠️ Uploaded PDF appears empty (bufferLength=${bufLen}, size=${fileSize}, path=${file.path || 'n/a'})`)
      return res.status(400).json({ message: 'Uploaded PDF is empty' })
    }

    const mime = file.mimetype || "";
    const name = file.originalname?.toLowerCase() || "";
    const isPdf =
      mime === "application/pdf" ||
      mime === "application/x-pdf" ||
      name.endsWith(".pdf");

    if (!isPdf) {
      return res.status(400).json({ message: "Only PDF files are allowed" });
    }

    console.log("📂 File info:", name, mime, fileSize, `bufferLength=${bufLen}`);

    // ✅ Extract text using pdfjs-dist directly (no pdf-parse)
    globalThis.PDFJS_DISABLE_WORKER = true
    let pdfText = ''
    try {
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
      const uint8 = new Uint8Array(fileBuffer)
      const loadingTask = pdfjs.getDocument({ data: uint8 })
      const doc = await loadingTask.promise
      const pageTexts = []
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i)
        const content = await page.getTextContent()
        const strings = content.items?.map(it => it.str).filter(Boolean) || []
        pageTexts.push(strings.join(' '))
      }
      pdfText = pageTexts.join('\n').trim()
    } catch (err) {
      console.error('❌ pdfjs text extraction failed:', err)
      return res.status(400).json({ message: 'Unable to read PDF file' })
    }

    if (!pdfText) {
      return res.status(400).json({ message: "No readable text found in PDF" });
    }

    // 🔹 Try to summarize; if it fails, still create report
    let summaryText
    let status = 'completed'
    try {
      summaryText = await summarizeClinicalText(pdfText)
    } catch (err) {
      console.warn('Summarize failed, creating PDF report without summary:', err?.message)
      status = 'pending'
    }

    // ✅ Save to DB
    const report = await Report.create({
      userId: req.user?.id,
      sourceType: "pdf",
      originalText: pdfText,
      summaryText: summaryText || undefined,
      status,
    });

    return res.status(201).json({ success: true, report });
  } catch (e) {
    console.error("❌ PDF upload error:", e);
    return res.status(500).json({ message: "Failed to process PDF", error: e?.message });
  }
});

export default router;
