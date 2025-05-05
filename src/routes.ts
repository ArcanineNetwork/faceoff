import express from 'express';
import path from 'path';

const router = express.Router();

// Serve static files
router.use(express.static(path.join(__dirname, 'public')));

// Routes
router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

router.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

export default router;
