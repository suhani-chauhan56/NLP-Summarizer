import sharp from 'sharp';
import Tesseract from 'tesseract.js';

/**
 * Safely extract text from an image buffer.
 * Works locally and on Vercel (auto-skip if CPU limit reached)
 */
export async function extractTextFromImage(buffer) {
  try {
    // 🧩 Pre-process image to improve OCR accuracy
    const processed = await sharp(buffer)
      .grayscale()
      .normalise()
      .toBuffer();

    // 🧠 Run OCR
    const { data } = await Tesseract.recognize(processed, 'eng', {
      tessedit_pageseg_mode: Tesseract.PSM.AUTO,
    });

    return (data.text || '').trim();
  } catch (err) {
    console.error('⚠️ OCR failed or skipped due to environment limits:', err.message);

    // 🪶 Return fallback message instead of crashing on Vercel
    return '[OCR temporarily unavailable – try running locally]';
  }
}
