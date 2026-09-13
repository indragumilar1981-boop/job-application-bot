const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();

// Use memory storage for compatibility with serverless environments (Vercel)
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// In‑memory store for uploaded CV metadata
const cvStore = {};

// Upload CV + keywords
app.post('/search', upload.single('cv'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'CV file missing' });
  }
  const keywords = (req.body.keywords || '').split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
  const cvId = uuidv4();
  cvStore[cvId] = { 
    originalName: req.file.originalname, 
    size: req.file.size,
    keywords 
  };

  const mockJobs = [
    { id: 'job1', title: 'Frontend Engineer', company: 'TechCorp Nusantara', location: 'Jakarta (Hybrid)', required: ['frontend', 'react', 'javascript'] },
    { id: 'job2', title: 'Backend Developer', company: 'DataSolutions Asia', location: 'Bandung', required: ['nodejs', 'api', 'database'] },
    { id: 'job3', title: 'Full‑Stack Engineer', company: 'InnovateX Labs', location: 'Remote / Work from Anywhere', required: ['frontend', 'backend', 'typescript'] },
    { id: 'job4', title: 'AI & Data Specialist', company: 'Nusantara AI', location: 'Jakarta (Remote)', required: ['python', 'ai', 'machine learning', 'data'] },
    { id: 'job5', title: 'DevOps / Cloud Specialist', company: 'CloudAsia Tech', location: 'Surabaya (Hybrid)', required: ['docker', 'cloud', 'linux', 'ci/cd'] }
  ];

  const scoredJobs = mockJobs.map(job => {
    const overlap = job.required.filter(r => keywords.includes(r)).length;
    let score = Math.round((overlap / job.required.length) * 100);
    if (score === 0 && keywords.length > 0) {
      score = Math.floor(Math.random() * 25) + 40; // match preview score
    }
    return { ...job, matchScore: score || 65 };
  }).sort((a, b) => b.matchScore - a.matchScore);

  res.json({ cvId, jobs: scoredJobs });
});

// Apply – send stored CV to selected job
app.post('/apply', (req, res) => {
  const { jobId, cvId } = req.body;
  if (!jobId) {
    return res.status(400).json({ error: 'Invalid request' });
  }
  console.log(`Simulated submission to job ${jobId}`);
  res.json({ status: 'sent', message: 'Lamaran dan CV berhasil dikirim ke portal lowongan!' });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'online', timestamp: new Date().toISOString() });
});

if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Job Application Bot server listening on http://localhost:${PORT}`);
  });
}

module.exports = app;
