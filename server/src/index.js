import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';

import authRouter from './routes/auth.js';
import reportsRouter from './routes/reports.js';
import summariesRouter from './routes/summaries.js';

const app = express();

const allowedOrigin = process.env.ALLOWED_ORIGIN || 'http://localhost:5173';

app.use(cors({  origin: ["https://nlp-summarizer-zanw.vercel.app/"], origin: allowedOrigin, credentials: true }));
app.use(helmet());
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
app.use(limiter);

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/summaries', summariesRouter);

app.use((err, req, res, next) => {
  const status = err.status || 500;
  res.status(status).json({ message: err.message || 'Server error' });
});

const MONGODB_URI = process.env.MONGODB_URI || '';
const PORT = process.env.PORT || 5000;

async function start() {
  try {
    if (!MONGODB_URI) {
      console.warn('MONGODB_URI not set. Server will start without DB connection.');
    } else {
      await mongoose.connect(MONGODB_URI);
      console.log('MongoDB connected');
    }
    app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
  } catch (e) {
    console.error('Failed to start server', e);
    process.exit(1);
  }
}

start();
