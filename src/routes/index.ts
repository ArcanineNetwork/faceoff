import express from 'express';
import path from 'path';

// Create a router
const router = express.Router();

// Serve static files
const publicDir = path.join(__dirname, '..', 'public');

router.use(express.static(publicDir));

// API routes
router.use('/api/questionSets', require('./api/questionSets').default);

// Fallback to index.html for SPA routing
router.get('*', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

export default router;
