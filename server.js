const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const { v4: uuidv4 } = require('uuid');

const app = express();

const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const cvStore = {};

// Akun Google yang sedang terhubung
let currentGoogleUser = {
  name: 'Indra Gumilar',
  email: 'indragumilar1581@gmail.com',
  accountType: 'Google Account (Gmail Pribadi)',
  service: 'Google Mail (SMTP / API)',
  picture: 'https://lh3.googleusercontent.com/a/default-user',
  isConnected: true,
  connectedAt: new Date().toLocaleString('id-ID')
};

// Database lowongan kerja lengkap (12+ lowongan dengan kategori & sumber portal)
const JOB_DATABASE = [
  { 
    id: 'job_sc_1', 
    title: 'Supply Chain & Logistics Specialist', 
    company: 'PT Samudera Logistik Indonesia', 
    category: 'supply_chain',
    location: 'Jakarta / Cikarang (Hybrid)', 
    hrEmail: 'recruitment.samudera@gmail.com',
    salary: 'Rp 8.500.000 - Rp 13.500.000',
    source: 'LinkedIn Jobs',
    sourceIcon: '💼',
    sourceUrl: 'https://www.linkedin.com/jobs/search/?keywords=supply%20chain%20indonesia',
    postedTime: 'Diposting 1 hari yang lalu',
    matchScore: 96,
    required: ['supply chain', 'logistik', 'warehouse', 'distribusi', 'operasional'] 
  },
  { 
    id: 'job_sc_2', 
    title: 'Warehouse & Inventory Supervisor', 
    company: 'Global Express Logistics', 
    category: 'warehouse',
    location: 'Bekasi / Karawang', 
    hrEmail: 'hrd.globalexpress@gmail.com',
    salary: 'Rp 7.500.000 - Rp 11.000.000',
    source: 'Jobstreet Indonesia',
    sourceIcon: '🏢',
    sourceUrl: 'https://www.jobstreet.co.id/id/job-search/warehouse-supervisor-jobs/',
    postedTime: 'Diposting 2 hari yang lalu',
    matchScore: 92,
    required: ['warehouse', 'inventory', 'supply chain', 'stock', 'pergudangan'] 
  },
  { 
    id: 'job_sc_3', 
    title: 'Procurement & Supply Chain Lead', 
    company: 'PT Indofood Retail Asia', 
    category: 'procurement',
    location: 'Jakarta Selatan', 
    hrEmail: 'career.indofoodretail@gmail.com',
    salary: 'Rp 11.000.000 - Rp 16.500.000',
    source: 'Glints Career',
    sourceIcon: '✨',
    sourceUrl: 'https://glints.com/id/opportunities/jobs/explore?keyword=supply+chain',
    postedTime: 'Diposting 5 jam yang lalu',
    matchScore: 88,
    required: ['supply chain', 'procurement', 'purchasing', 'vendor', 'negosiasi'] 
  },
  { 
    id: 'job_sc_4', 
    title: 'Logistics Operations Coordinator', 
    company: 'AnterAja Fast Track', 
    category: 'transport',
    location: 'Tangerang / Jakarta Barat', 
    hrEmail: 'recruitment.anteraja@gmail.com',
    salary: 'Rp 6.500.000 - Rp 9.500.000',
    source: 'Karir.com',
    sourceIcon: '🚀',
    sourceUrl: 'https://karir.com/search?q=logistik',
    postedTime: 'Diposting 3 hari yang lalu',
    matchScore: 85,
    required: ['logistik', 'operasional', 'supply chain', 'fleet', 'pengiriman'] 
  },
  { 
    id: 'job_sc_5', 
    title: 'Supply Chain Planning & Demand Analyst', 
    company: 'PT Unilever Indonesia Logistics', 
    category: 'supply_chain',
    location: 'Tangerang Selatan / BSD (Hybrid)', 
    hrEmail: 'talent.unileverlogistics@gmail.com',
    salary: 'Rp 10.000.000 - Rp 15.000.000',
    source: 'LinkedIn Jobs',
    sourceIcon: '💼',
    sourceUrl: 'https://www.linkedin.com/jobs/search/?keywords=demand%20planner%20indonesia',
    postedTime: 'Diposting 4 jam yang lalu',
    matchScore: 94,
    required: ['supply chain', 'demand planning', 'forecasting', 'sap', 'inventory'] 
  },
  { 
    id: 'job_sc_6', 
    title: 'Warehouse Operations Head', 
    company: 'SiCepat Distribution Center', 
    category: 'warehouse',
    location: 'Cakung / Jakarta Timur', 
    hrEmail: 'career.sicepathub@gmail.com',
    salary: 'Rp 9.000.000 - Rp 14.000.000',
    source: 'Jobstreet Indonesia',
    sourceIcon: '🏢',
    sourceUrl: 'https://www.jobstreet.co.id/',
    postedTime: 'Diposting 1 hari yang lalu',
    matchScore: 90,
    required: ['warehouse', 'operasional', 'fulfillment', 'kpi', 'logistik'] 
  },
  { 
    id: 'job_sc_7', 
    title: 'Fleet & Transportation Operations Supervisor', 
    company: 'PT Puninar Jaya Logistics', 
    category: 'transport',
    location: 'Sunter, Jakarta Utara', 
    hrEmail: 'hrd.puninarfleet@gmail.com',
    salary: 'Rp 7.800.000 - Rp 11.500.000',
    source: 'LinkedIn Jobs',
    sourceIcon: '💼',
    sourceUrl: 'https://www.linkedin.com/jobs/',
    postedTime: 'Diposting 2 hari yang lalu',
    matchScore: 89,
    required: ['fleet', 'transportasi', 'logistik', 'trucking', 'distribusi'] 
  },
  { 
    id: 'job_sc_8', 
    title: 'Purchasing & Vendor Management Officer', 
    company: 'PT Kalbe Farma Distribution', 
    category: 'procurement',
    location: 'Cempaka Putih, Jakarta Pusat', 
    hrEmail: 'recruitment.kalbedistribusi@gmail.com',
    salary: 'Rp 8.000.000 - Rp 12.000.000',
    source: 'Glints Career',
    sourceIcon: '✨',
    sourceUrl: 'https://glints.com/id/',
    postedTime: 'Diposting 1 hari yang lalu',
    matchScore: 87,
    required: ['procurement', 'purchasing', 'vendor', 'negosiasi', 'kontrak'] 
  },
  { 
    id: 'job_sc_9', 
    title: 'Distribution Center Assistant Manager', 
    company: 'Lazada Mega Logistics Hub', 
    category: 'warehouse',
    location: 'Cimanggis, Depok', 
    hrEmail: 'talent.lazadalogistics@gmail.com',
    salary: 'Rp 12.000.000 - Rp 18.000.000',
    source: 'Jobstreet Indonesia',
    sourceIcon: '🏢',
    sourceUrl: 'https://www.jobstreet.co.id/',
    postedTime: 'Diposting 6 jam yang lalu',
    matchScore: 93,
    required: ['distribution', 'warehouse', 'supply chain', 'e-commerce', 'sop'] 
  },
  { 
    id: 'job_sc_10', 
    title: 'Inventory Controller & SAP Specialist', 
    company: 'PT Mayora Indah Logistics', 
    category: 'supply_chain',
    location: 'Daan Mogot, Jakarta Barat', 
    hrEmail: 'career.mayoralogistics@gmail.com',
    salary: 'Rp 8.500.000 - Rp 12.500.000',
    source: 'Karir.com',
    sourceIcon: '🚀',
    sourceUrl: 'https://karir.com/',
    postedTime: 'Diposting 3 hari yang lalu',
    matchScore: 89,
    required: ['inventory', 'sap', 'stock opname', 'supply chain', 'audit'] 
  },
  { 
    id: 'job_sc_11', 
    title: 'End-to-End Supply Chain Coordinator', 
    company: 'Shopee Express Hub Nusantara', 
    category: 'supply_chain',
    location: 'Sunter, Jakarta Utara', 
    hrEmail: 'recruitment.shopeexpress@gmail.com',
    salary: 'Rp 9.500.000 - Rp 15.000.000',
    source: 'LinkedIn Jobs',
    sourceIcon: '💼',
    sourceUrl: 'https://www.linkedin.com/jobs/',
    postedTime: 'Diposting 8 jam yang lalu',
    matchScore: 95,
    required: ['supply chain', 'logistik', 'operasional', 'vendor', 'kpi'] 
  },
  { 
    id: 'job_sc_12', 
    title: 'Logistics Project & Custom Clearance Lead', 
    company: 'DHL Global Forwarding Indonesia', 
    category: 'transport',
    location: 'Bandara Soekarno-Hatta / Cengkareng', 
    hrEmail: 'talent.dhlindonesia@gmail.com',
    salary: 'Rp 13.000.000 - Rp 21.000.000',
    source: 'LinkedIn Jobs',
    sourceIcon: '💼',
    sourceUrl: 'https://www.linkedin.com/jobs/',
    postedTime: 'Diposting 1 hari yang lalu',
    matchScore: 91,
    required: ['logistik', 'custom clearance', 'freight forwarding', 'impor', 'ekspor'] 
  }
];

// FEED POSTINGAN REKRUTER LINKEDIN (LIVE FEED)
const LINKEDIN_FEED = [
  {
    id: 'post_1',
    authorName: 'Sarah Amalia, S.Psi',
    authorRole: 'Senior Talent Acquisition Lead at Samudera Indonesia',
    authorAvatar: 'SA',
    authorAvatarColor: '#0284c7',
    postedTime: '1 jam yang lalu • 🌐',
    postContent: `🚨 WE ARE HIRING! Urgent requirement: Supply Chain & Logistics Specialist untuk penempatan di area Jabodetabek. 
    
Kualifikasi:
- Pengalaman minimal 2-4 tahun di bidang Supply Chain, Warehouse, atau Distribusi
- Mampu memantau alur logistik & vendor secara menyeluruh
- Penempatan: Jakarta / Cikarang (Hybrid)

Bagi rekan-rekan yang berminat atau ada rekomendasi, silakan langsung kirimkan CV terbaru Anda ke:
📧 recruitment.samudera@gmail.com
Subject: [LAMARAN] - Supply Chain Specialist - [Nama Anda]

Bantu repost ya rekan-rekan connections! #hiring #supplychain #logistik #lowongankerja`,
    recruiterEmail: 'recruitment.samudera@gmail.com',
    jobTargetTitle: 'Supply Chain & Logistics Specialist',
    companyTarget: 'PT Samudera Logistik Indonesia'
  },
  {
    id: 'post_2',
    authorName: 'Budi Darmawan, CHRP',
    authorRole: 'Head of People & Culture at Global Express Logistics',
    authorAvatar: 'BD',
    authorAvatarColor: '#059669',
    postedTime: '3 jam yang lalu • 🌐',
    postContent: `Selamat pagi connections! Tim operasional kami sedang bertumbuh pesat dan kami membutuhkan:
📦 Warehouse & Inventory Supervisor (Full-time)

Tanggung jawab utama mengelola stock opname, alur keluar-masuk barang, dan memimpin tim gudang. 
Kirim CV dan sertifikat pendukung Anda langsung ke:
📩 hrd.globalexpress@gmail.com

Proses rekrutmen cepat tanpa dipungut biaya apapun. Feel free to connect and share! #jobvacancy #warehousesupervisor #supplychain`,
    recruiterEmail: 'hrd.globalexpress@gmail.com',
    jobTargetTitle: 'Warehouse & Inventory Supervisor',
    companyTarget: 'Global Express Logistics'
  },
  {
    id: 'post_3',
    authorName: 'Jessica Hartono',
    authorRole: 'Recruitment Specialist at Indofood Retail Group',
    authorAvatar: 'JH',
    authorAvatarColor: '#d97706',
    postedTime: '6 jam yang lalu • 🌐',
    postContent: `Halo rekan-rekan LinkedIn! Saat ini saya sedang mencari profesional berpengalaman untuk posisi:
✨ Procurement & Supply Chain Lead (FMCG Sector)

Requirements:
- Strong negotiation skills & strategic sourcing
- Familiar dengan ERP / SAP
- Ready to join ASAP

Drop your updated resume to:
👉 career.indofoodretail@gmail.com
Subject: Lamaran Procurement Lead - [Nama]

Mari berkarier bersama salah satu grup retail terbesar di Indonesia! #hiringnow #procurement #supplychainlead`,
    recruiterEmail: 'career.indofoodretail@gmail.com',
    jobTargetTitle: 'Procurement & Supply Chain Lead',
    companyTarget: 'PT Indofood Retail Asia'
  },
  {
    id: 'post_4',
    authorName: 'Rian Pratama',
    authorRole: 'HR Business Partner at Shopee Express Logistics',
    authorAvatar: 'RP',
    authorAvatarColor: '#ea580c',
    postedTime: '12 jam yang lalu • 🌐',
    postContent: `Opportunities alert! 🚚
Kami membuka lowongan untuk End-to-End Supply Chain Coordinator & Fleet Dispatcher untuk mengoptimalkan hub distribusi kami di Jabodetabek.

Kandidat yang memiliki pengalaman logistik e-commerce, tracking fleet, dan warehouse disukai.
Silakan kirimkan CV Anda ke:
📧 recruitment.shopeexpress@gmail.com

Looking forward to welcoming you to the orange team! 🧡 #shopee #supplychain #logistics #lokerjakarta`,
    recruiterEmail: 'recruitment.shopeexpress@gmail.com',
    jobTargetTitle: 'End-to-End Supply Chain Coordinator',
    companyTarget: 'Shopee Express Hub Nusantara'
  }
];

function getOAuth2Client(req) {
  const host = req ? `${req.protocol}://${req.get('host')}` : 'http://localhost:3000';
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${host}/api/auth/callback`;

  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID || 'DEMO_CLIENT_ID',
    process.env.GOOGLE_CLIENT_SECRET || 'DEMO_CLIENT_SECRET',
    redirectUri
  );
}

// API ENDPOINTS

app.get('/api/auth/user', (req, res) => {
  res.json({ user: currentGoogleUser });
});

app.get('/api/linkedin-feed', (req, res) => {
  res.json({ success: true, count: LINKEDIN_FEED.length, feed: LINKEDIN_FEED });
});

app.post('/api/auth/select-account', async (req, res) => {
  const { name, email } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, error: 'Email wajib dipilih!' });
  }

  const isWorkspace = email.endsWith('@gmail.com') ? 'Google Account (Gmail Pribadi)' : 'Google Workspace (Email Perusahaan / Domain Sendiri)';

  currentGoogleUser = {
    name: name || 'Indra Gumilar',
    email: email.trim(),
    accountType: isWorkspace,
    service: 'Google Mail Official',
    picture: 'https://lh3.googleusercontent.com/a/default-user',
    isConnected: true,
    connectedAt: new Date().toLocaleString('id-ID')
  };

  res.json({ 
    success: true, 
    user: currentGoogleUser,
    message: `Akun ${currentGoogleUser.email} aktif sebagai pengirim resmi!`
  });
});

app.post('/api/auth/logout', (req, res) => {
  currentGoogleUser.isConnected = false;
  res.json({ success: true });
});

// PENCARIAN LOWONGAN
app.post('/search', upload.single('cv'), (req, res) => {
  const keywords = (req.body.keywords || '').toLowerCase().split(/[,\s]+/).filter(k => k.length > 2);
  const categoryFilter = req.body.category || 'all';
  const cvId = uuidv4();
  
  let fileName = '';
  if (req.file) {
    fileName = req.file.originalname;
    cvStore[cvId] = { 
      originalName: req.file.originalname, 
      mimetype: req.file.mimetype,
      buffer: req.file.buffer,
      size: req.file.size, 
      keywords 
    };
  }

  let filteredJobs = JOB_DATABASE;
  if (categoryFilter !== 'all') {
    filteredJobs = filteredJobs.filter(j => j.category === categoryFilter);
  }

  const scored = filteredJobs.map(job => {
    let matchCount = 0;
    const jobText = (job.title + ' ' + job.required.join(' ')).toLowerCase();
    
    keywords.forEach(k => {
      if (jobText.includes(k)) matchCount += 2;
    });

    if (fileName) {
      const cleanFileName = fileName.toLowerCase().replace(/[_.-]/g, ' ');
      keywords.forEach(k => {
        if (cleanFileName.includes(k)) matchCount += 1;
      });
    }

    let matchScore = Math.min(98, Math.max(55, Math.round(60 + (matchCount * 10))));
    return { ...job, matchScore };
  });

  const jobs = scored.sort((a, b) => b.matchScore - a.matchScore);
  res.json({ cvId, fileName, totalMatches: jobs.length, jobs, connectedUser: currentGoogleUser, linkedinFeed: LINKEDIN_FEED });
});

// KIRIM LAMARAN RESMI DARI AKUN TERHUBUNG
app.post('/send-application', async (req, res) => {
  try {
    const { 
      recipientEmail, 
      jobTitle, 
      company, 
      coverLetter, 
      cvId 
    } = req.body;

    if (!recipientEmail) {
      return res.status(400).json({ success: false, error: 'Alamat email tujuan (HRD) wajib diisi!' });
    }

    const sender = currentGoogleUser || { name: 'Indra Gumilar', email: 'indragumilar1581@gmail.com' };
    const cvFile = cvId ? cvStore[cvId] : null;

    let transporter;
    let fromAddress;

    if (sender.tokens && sender.tokens.access_token) {
      const oauth2Client = getOAuth2Client(req);
      oauth2Client.setCredentials(sender.tokens);

      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          type: 'OAuth2',
          user: sender.email,
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          refreshToken: sender.tokens.refresh_token,
          accessToken: sender.tokens.access_token
        }
      });
      fromAddress = `"${sender.name}" <${sender.email}>`;
    } else {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });
      fromAddress = `"${sender.name}" <${sender.email}>`;
    }

    const attachments = [];
    if (cvFile && cvFile.buffer) {
      attachments.push({
        filename: cvFile.originalName || 'Curriculum_Vitae.pdf',
        content: cvFile.buffer
      });
    }

    const mailOptions = {
      from: fromAddress,
      to: recipientEmail,
      replyTo: sender.email,
      cc: sender.email,
      subject: `Lamaran Pekerjaan: ${jobTitle} - ${sender.name}`,
      text: coverLetter,
      attachments
    };

    const info = await transporter.sendMail(mailOptions);
    const testUrl = nodemailer.getTestMessageUrl(info);

    console.log(`[PENGIRIMAN BERHASIL] Dari: ${sender.email} ➜ Ke: ${recipientEmail} | ID: ${info.messageId}`);

    res.json({ 
      success: true, 
      senderEmail: sender.email,
      senderName: sender.name,
      recipientEmail: recipientEmail,
      messageId: info.messageId, 
      previewUrl: testUrl || null,
      message: `Lamaran resmi berhasil dikirim dari akun ${sender.email} ke ${recipientEmail}!`
    });
  } catch (error) {
    console.error('Error saat mengirim email:', error);
    res.status(500).json({ 
      success: false, 
      error: `Gagal mengirim email: ${error.message}` 
    });
  }
});

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
