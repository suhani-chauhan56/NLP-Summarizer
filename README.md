# NPL Clinic

Full-stack MERN app to upload clinical text or report images, OCR them, and generate AI summaries. 

## Structure
- client/ — React + Vite + Tailwind
- server/ — Node + Express + MongoDB, OCR (tesseract.js), Summaries (OpenAI)

## Prerequisites
- Node.js 20.19+ (or 22.12+) for the client
- Node.js 18+ for the server
- MongoDB Atlas connection string
- OpenAI API key

## Setup

### Server
1. Copy env
```
cp server/.env.example server/.env
```
2. Fill values in `server/.env`:
```
MONGODB_URI=your_mongodb_uri
JWT_ACCESS_SECRET=your_access_secret
JWT_REFRESH_SECRET=your_refresh_secret
OPENAI_API_KEY=your_openai_key
ALLOWED_ORIGIN=http://localhost:5173
```
3. Install & run
```
cd server
npm install
npm run dev
```
Health: http://localhost:5000/api/health

### Client
1. Copy env
```
cp client/.env.example client/.env
```
2. Install & run (requires Node 20.19+)
```
cd client
npm install
npm run dev
```
App: http://localhost:5173

## Flow
1. Sign up or login
2. Create report by text or image (OCR)
3. Generate summary
4. View side-by-side, copy or download

## Notes
- Image OCR uses `sharp` pre-processing and `tesseract.js`.
- AI summaries use OpenAI Chat Completions (`gpt-4o-mini`).
- Auth uses JWT access/refresh tokens via httpOnly cookies.
