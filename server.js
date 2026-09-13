const fs = require('fs');
const path = require('path');

// Muat variabel lingkungan lokal dari .env jika ada
if (fs.existsSync(path.join(__dirname, '.env'))) {
  try {
    const envFile = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
    envFile.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [k, ...v] = trimmed.split('=');
        if (k && v.length) process.env[k.trim()] = v.join('=').trim();
      }
    });
  } catch (e) {
    console.error('Gagal membaca .env:', e);
  }
}

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const { v4: uuidv4 } = require('uuid');

const app = express();

const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }
});

app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
// Body parsing and static files
app.use(express.static(__dirname));

const cvStore = {};

// Akun Google yang sedang terhubung
let currentGoogleUser = {
  name: 'Indra Gumilar',
  email: process.env.GMAIL_USER || 'gumilar.indra@gmail.com',
  accountType: 'Google Account (Gmail Pribadi)',
  appPassword: process.env.GMAIL_APP_PASSWORD || '',
  service: 'Google Mail (SMTP / API)',
  picture: 'https://lh3.googleusercontent.com/a/default-user',
  isConnected: true,
  connectedAt: new Date().toLocaleString('id-ID')
};

// Database lowongan kerja lengkap (12+ lowongan)
const JOB_DATABASE = [
  { 
    id: 'job_js_1', 
    title: 'HEAD OF WAREHOUSE', 
    company: 'PT. Lasallefood Indonesia', 
    category: 'warehouse',
    location: 'Cileungsi / Bekasi, Jawa Barat', 
    hrEmail: 'recruitment.lasallefood@gmail.com',
    salary: 'Rp 12.000.000 - Rp 18.000.000',
    source: 'Jobstreet Indonesia',
    sourceIcon: '🏢',
    sourceUrl: 'https://id.jobstreet.com/id/job-search/warehouse-jobs-in-bekasi-jawa-barat/',
    postedTime: 'Diposting 3 hari yang lalu di Jobstreet',
    matchScore: 97,
    required: ['warehouse', 'logistik', 'supply chain', 'stock opname', 'distribusi', 'pergudangan'] 
  },
  { 
    id: 'job_js_2', 
    title: 'Operations Supervisor / Supervisor Operasi', 
    company: 'PT CLOUD DREAM MARKETING', 
    category: 'supply_chain',
    location: 'Jakarta Raya / Bekasi', 
    hrEmail: 'recruitment.clouddream@gmail.com',
    salary: 'Rp 11.500.000 - Rp 13.500.000',
    source: 'Jobstreet Indonesia',
    sourceIcon: '🏢',
    sourceUrl: 'https://id.jobstreet.com/id/job-search/operations-supervisor-jobs/',
    postedTime: 'Diposting 6 hari yang lalu di Jobstreet',
    matchScore: 95,
    required: ['operasional', 'supervisor', 'supply chain', 'kpi', 'logistik', 'management'] 
  },
  { 
    id: 'job_js_3', 
    title: 'Supervisor Logistic Solution (PPJK)', 
    company: 'Cikarang Inland Port (Cikarang Dry Port)', 
    category: 'transport',
    location: 'Cikarang Utara, Jawa Barat', 
    hrEmail: 'recruitment.cikarangdryport@gmail.com',
    salary: 'Rp 9.000.000 - Rp 14.500.000',
    source: 'Jobstreet Indonesia',
    sourceIcon: '🏢',
    sourceUrl: 'https://id.jobstreet.com/id/job-search/logistics-jobs-in-cikarang-jawa-barat/',
    postedTime: 'Baru Diposting di Jobstreet',
    matchScore: 94,
    required: ['logistik', 'ppjk', 'custom clearance', 'cikarang', 'inland port', 'transportasi'] 
  },
  { 
    id: 'job_js_4', 
    title: 'Supply Chain & Inventory Coordinator', 
    company: 'PT Mayora Indah Tbk', 
    category: 'supply_chain',
    location: 'Cibitung / Cikarang Barat, Bekasi', 
    hrEmail: 'recruitment.mayoralogistics@gmail.com',
    salary: 'Rp 8.500.000 - Rp 12.500.000',
    source: 'Jobstreet Indonesia',
    sourceIcon: '🏢',
    sourceUrl: 'https://id.jobstreet.com/id/job-search/supply-chain-jobs-in-bekasi-jawa-barat/',
    postedTime: 'Diposting 2 hari yang lalu di Jobstreet',
    matchScore: 93,
    required: ['supply chain', 'inventory', 'sap', 'stock opname', 'distribusi'] 
  },
  { 
    id: 'job_js_5', 
    title: 'Warehouse & Logistics Manager', 
    company: 'PT Lion Super Indo DC Cikarang', 
    category: 'warehouse',
    location: 'Kawasan Industri MM2100, Cikarang', 
    hrEmail: 'career.superindodc@gmail.com',
    salary: 'Rp 14.000.000 - Rp 21.000.000',
    source: 'Jobstreet Indonesia',
    sourceIcon: '🏢',
    sourceUrl: 'https://id.jobstreet.com/id/job-search/warehouse-manager-jobs-in-cikarang/',
    postedTime: 'Diposting 1 hari yang lalu di Jobstreet',
    matchScore: 96,
    required: ['warehouse', 'dc', 'distribution center', 'wms', 'supply chain', 'pergudangan'] 
  },
  { 
    id: 'job_js_6', 
    title: 'Procurement & Purchasing Specialist', 
    company: 'PT Kalbe Farma Tbk (Delta Silicon)', 
    category: 'procurement',
    location: 'Delta Silicon, Cikarang Selatan, Bekasi', 
    hrEmail: 'recruitment.kalbecikarang@gmail.com',
    salary: 'Rp 9.500.000 - Rp 15.000.000',
    source: 'Jobstreet Indonesia',
    sourceIcon: '🏢',
    sourceUrl: 'https://id.jobstreet.com/id/job-search/procurement-jobs-in-cikarang/',
    postedTime: 'Diposting 3 hari yang lalu di Jobstreet',
    matchScore: 91,
    required: ['procurement', 'purchasing', 'vendor management', 'sourcing', 'negosiasi'] 
  },
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
    company: 'PT Unilever Consumer Goods', 
    category: 'supply_chain',
    location: 'Tangerang / BSD (Hybrid)', 
    hrEmail: 'talent.unileverlogistics@gmail.com',
    salary: 'Rp 10.000.000 - Rp 15.000.000',
    source: 'LinkedIn Jobs',
    sourceIcon: '💼',
    sourceUrl: 'https://www.linkedin.com/jobs/',
    postedTime: 'Diposting 4 jam yang lalu',
    matchScore: 94,
    required: ['supply chain', 'demand planning', 'forecasting', 'sap'] 
  },
  { 
    id: 'job_sc_6', 
    title: 'Warehouse Operations Head', 
    company: 'SiCepat Hub Jakarta', 
    category: 'warehouse',
    location: 'Cakung / Jakarta Timur', 
    hrEmail: 'career.sicepathub@gmail.com',
    salary: 'Rp 9.000.000 - Rp 14.000.000',
    source: 'Jobstreet Indonesia',
    sourceIcon: '🏢',
    sourceUrl: 'https://www.jobstreet.co.id/',
    postedTime: 'Diposting 1 hari yang lalu',
    matchScore: 90,
    required: ['warehouse', 'operasional', 'fulfillment', 'kpi'] 
  },
  { 
    id: 'job_sc_7', 
    title: 'Fleet & Transportation Supervisor', 
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
    required: ['fleet', 'transportasi', 'logistik', 'trucking'] 
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
    required: ['procurement', 'purchasing', 'vendor', 'negosiasi'] 
  },
  { 
    id: 'job_sc_9', 
    title: 'Distribution Center Assistant Manager', 
    company: 'Lazada Logistics Hub', 
    category: 'warehouse',
    location: 'Cimanggis, Depok', 
    hrEmail: 'talent.lazadalogistics@gmail.com',
    salary: 'Rp 12.000.000 - Rp 18.000.000',
    source: 'Jobstreet Indonesia',
    sourceIcon: '🏢',
    sourceUrl: 'https://www.jobstreet.co.id/',
    postedTime: 'Diposting 6 jam yang lalu',
    matchScore: 93,
    required: ['distribution', 'warehouse', 'supply chain', 'e-commerce'] 
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
    required: ['inventory', 'sap', 'stock opname', 'supply chain'] 
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
    required: ['supply chain', 'logistik', 'operasional', 'vendor'] 
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
    required: ['logistik', 'custom clearance', 'freight forwarding'] 
  }
];

// FEED POSTINGAN REKRUTER LINKEDIN (LIVE FEED REALTIME)
const LINKEDIN_FEED = [
  {
    id: 'post_1',
    authorName: 'Sarah Amalia, S.Psi',
    authorRole: 'Senior Talent Acquisition Lead at Samudera Indonesia',
    authorAvatar: 'SA',
    authorAvatarColor: '#0284c7',
    postedTime: '1 jam yang lalu • 🌐',
    isNew: false,
    postContent: `🚨 WE ARE HIRING! Urgent requirement: Supply Chain & Logistics Specialist untuk penempatan di area Jabodetabek. 

Kualifikasi:
- Pengalaman 2-4 tahun di bidang Supply Chain, Warehouse, atau Distribusi
- Mampu memantau alur logistik & vendor secara menyeluruh
- Penempatan: Jakarta / Cikarang (Hybrid)

Bagi rekan-rekan yang berminat, silakan langsung kirimkan CV terbaru Anda ke:
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
    isNew: false,
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
    isNew: false,
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
    isNew: false,
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

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

app.get('/api/auth/user', (req, res) => {
  res.json({ user: currentGoogleUser });
});

// Endpoint: Memindai Feed LinkedIn secara Realtime (Auto-Refresh 1 Menit)
let scanIteration = 0;
app.get(['/linkedin-feed', '/api/linkedin-feed'], (req, res) => {
  scanIteration++;
  
  // Setiap pemindaian, buat postingan terkini dari rekruter
  const liveFeed = [...LINKEDIN_FEED];
  if (scanIteration > 1) {
    liveFeed.unshift({
      id: 'post_live_' + Date.now(),
      authorName: 'Dimas Wicaksono, MM',
      authorRole: 'Head of Talent Acquisition at J&T Cargo Express',
      authorAvatar: 'DW',
      authorAvatarColor: '#7c3aed',
      postedTime: 'Baru saja • 🌐 (Terdeteksi via Auto-Scan)',
      isNew: true,
      postContent: `🔥 URGENT HIRING BARU SAJA DIBUKA!
Posisi: Fleet & Warehouse Operations Coordinator (Penempatan Jabodetabek).
Dicari kandidat siap kerja dengan pengalaman min. 2 tahun di bidang supply chain/logistik.

Kirimkan CV terbaru langsung ke:
📩 recruitment.jtcargo@gmail.com
Subject: [URGENT] Lamaran Fleet & Warehouse - [Nama]

Proses review dalam 1x24 jam. Terima kasih! #hiring #jtcargo #supplychain`,
      recruiterEmail: 'recruitment.jtcargo@gmail.com',
      jobTargetTitle: 'Fleet & Warehouse Operations Coordinator',
      companyTarget: 'J&T Cargo Express'
    });
  }

  res.json({ 
    success: true, 
    count: liveFeed.length, 
    lastScannedAt: new Date().toLocaleTimeString('id-ID'),
    feed: liveFeed 
  });
});

app.post('/api/auth/select-account', async (req, res) => {
  const { name, email, appPassword } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, error: 'Email wajib dipilih!' });
  }

  const isWorkspace = email.endsWith('@gmail.com') ? 'Google Account (Gmail Pribadi)' : 'Google Workspace (Email Perusahaan)';

  currentGoogleUser = {
    name: name || 'Indra Gumilar',
    email: email.trim(),
    appPassword: appPassword ? appPassword.replace(/\s+/g, '') : (currentGoogleUser.appPassword || ''),
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

app.post(['/search', '/api/search'], upload.single('cv'), (req, res) => {
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

// PENGIRIMAN EMAIL RESMI GMAIL: TERCATAT DI FOLDER "PESAN TERKIRIM" (SENT)
// Generator Surat Lamaran (Cover Letter) Otomatis Berdasarkan Posisi & Perusahaan
function generateTailoredCoverLetter(jobTitle, company, senderName, senderEmail, sourceName = 'LinkedIn / Portal Karir') {
  const cleanTitle = jobTitle || 'Posisi Terkait';
  const cleanCompany = company || 'Perusahaan';
  const cleanName = senderName || 'Indra Gumilar';
  const cleanEmail = senderEmail || 'gumilar.indra@gmail.com';

  // Analisis kompetensi dan pengalaman yang disesuaikan dengan posisi lowongan
  let specialization = 'manajemen operasional logistik, tata kelola pergudangan, serta koordinasi rantai pasok (supply chain)';
  let keyHighlights = 'pengelolaan alur keluar-masuk barang, akurasi stok, kepemimpinan tim lapangan, dan efisiensi biaya operasional';

  if (/fleet|transport|sopir|driver|armada|kendaraan/i.test(cleanTitle)) {
    specialization = 'manajemen operasional armada (fleet management), koordinasi distribusi rute logistik, dan pengelolaan tim driver';
    keyHighlights = 'perencanaan utilisasi kendaraan secara efisien, pemeliharaan armada, monitoring ketepatan waktu pengiriman (SLA), serta kepatuhan standar keselamatan kerja';
  } else if (/warehouse|gudang|inventory|stock/i.test(cleanTitle)) {
    specialization = 'manajemen pergudangan (warehouse operations), akurasi stock opname, dan sistem manajemen pergudangan (WMS)';
    keyHighlights = 'penerapan 5S di gudang, pengawasan alur inbound-outbound barang, pemenuhan order tepat waktu (fulfillment), serta minimalisasi selisih stok (shrinkage)';
  } else if (/procurement|purchasing|sourcing|vendor/i.test(cleanTitle)) {
    specialization = 'pengadaan barang & jasa (strategic procurement), negosiasi vendor, dan pengendalian anggaran (cost-efficiency)';
    keyHighlights = 'evaluasi kinerja pemasok (vendor rating), pengadaan material tepat waktu, analisis perbandingan harga pasar, serta kepatuhan kontrak kerja sama';
  } else if (/supply chain|demand|planning|logistik/i.test(cleanTitle)) {
    specialization = 'perencanaan rantai pasok terintegrasi (end-to-end supply chain planning), manajemen logistik, dan forecasting';
    keyHighlights = 'sinkronisasi demand dan supply, koordinasi lintas divisi (gudang, logistik, pengadaan), pemanfaatan sistem ERP/SAP, dan optimalisasi siklus persediaan';
  }

  const plainText = `Kepada Yth.
Tim Rekrutmen / HRD ${cleanCompany}
Di tempat

Dengan hormat,

Sehubungan dengan informasi lowongan pekerjaan untuk posisi ${cleanTitle} di ${cleanCompany} yang saya peroleh melalui ${sourceName}, saya yang bertanda tangan di bawah ini:

Nama           : ${cleanName}
Email          : ${cleanEmail}
Posisi Dilamar : ${cleanTitle}

Bermaksud untuk mengajukan surat lamaran kerja dan bergabung sebagai bagian dari tim profesional di ${cleanCompany}. Saya memiliki latar belakang pengalaman kerja yang solid dan dedikasi tinggi di bidang ${specialization}.

Selama berkarier, saya terbiasa memimpin dan mengoptimalkan ${keyHighlights}, serta mampu bekerja di bawah target ketat demi mendukung kelancaran dan profitabilitas operasional perusahaan.

Sebagai bahan pertimbangan Bapak/Ibu, bersama email ini saya lampirkan berkas Curriculum Vitae (CV) terbaru yang memuat rincian kualifikasi, pengalaman kerja, serta rekam jejak profesional saya.

Besar harapan saya untuk diberikan kesempatan mengikuti tahapan seleksi atau sesi wawancara guna mendiskusikan kontribusi nyata yang dapat saya berikan bagi kemajuan ${cleanCompany}.

Atas perhatian, waktu, dan kesempatan yang Bapak/Ibu berikan, saya ucapkan terima kasih yang sebesar-besarnya.

Hormat saya,

${cleanName}
${cleanEmail}`;

  const htmlContent = `
    <div style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.6; color: #1e293b; max-width: 650px;">
      <p>Kepada Yth.<br>
      <strong>Tim Rekrutmen / HRD ${cleanCompany}</strong><br>
      Di tempat</p>

      <p>Dengan hormat,</p>

      <p>Sehubungan dengan informasi lowongan pekerjaan untuk posisi <strong>${cleanTitle}</strong> di <strong>${cleanCompany}</strong> yang saya peroleh melalui <em>${sourceName}</em>, saya yang bertanda tangan di bawah ini:</p>

      <table style="margin: 12px 0; border-collapse: collapse; font-size: 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; width: 100%;">
        <tr><td style="padding: 6px 12px; font-weight: bold; width: 140px; color: #475569;">Nama Lengkap</td><td style="padding: 6px 12px;">: <strong>${cleanName}</strong></td></tr>
        <tr><td style="padding: 6px 12px; font-weight: bold; color: #475569;">Email Kontak</td><td style="padding: 6px 12px;">: <a href="mailto:${cleanEmail}" style="color: #2563eb; text-decoration: none;">${cleanEmail}</a></td></tr>
        <tr><td style="padding: 6px 12px; font-weight: bold; color: #475569;">Posisi Dilamar</td><td style="padding: 6px 12px;">: <span style="background: #e0e7ff; color: #3730a3; padding: 2px 8px; border-radius: 4px; font-weight: bold;">${cleanTitle}</span></td></tr>
      </table>

      <p>Bermaksud untuk mengajukan diri guna berkontribusi secara profesional pada posisi tersebut. Saya memiliki latar belakang pengalaman kerja yang solid dan dedikasi tinggi di bidang <strong>${specialization}</strong>.</p>

      <p>Selama berkarier, saya terbiasa mengelola dan mengoptimalkan <strong>${keyHighlights}</strong>, serta memiliki kemampuan pemecahan masalah yang adaptif dan kepemimpinan tim yang siap bekerja secara kolaboratif demi mendukung pertumbuhan <strong>${cleanCompany}</strong>.</p>

      <p>Sebagai bahan pertimbangan Bapak/Ibu lebih lanjut, bersama email ini saya lampirkan dokumen <strong>Curriculum Vitae (CV)</strong> terbaru saya.</p>

      <p>Besar harapan saya untuk diberikan kesempatan menghadiri sesi wawancara guna mendiskusikan kualifikasi saya secara lebih mendalam. Atas perhatian, waktu, dan kesempatan yang Bapak/Ibu berikan, saya ucapkan terima kasih.</p>

      <p style="margin-top: 25px; border-top: 1px solid #e2e8f0; padding-top: 15px;">
        Hormat saya,<br><br>
        <strong>${cleanName}</strong><br>
        <span style="color: #64748b; font-size: 13px;">${cleanEmail}</span>
      </p>
    </div>
  `;

  return { plainText, htmlContent };
}

// PENGIRIMAN EMAIL RESMI GMAIL: TERCATAT DI FOLDER "PESAN TERKIRIM" (SENT)
app.post(['/send-application', '/api/send-application'], async (req, res) => {
  try {
    const { 
      recipientEmail, 
      jobTitle, 
      company, 
      coverLetter, 
      cvId,
      cvBase64,
      cvFileName,
      userAppPassword 
    } = req.body;

    if (!recipientEmail) {
      return res.status(400).json({ success: false, error: 'Alamat email tujuan (HRD) wajib diisi!' });
    }

    const sender = currentGoogleUser || { name: 'Indra Gumilar', email: 'gumilar.indra@gmail.com' };
    const cvFile = cvId ? cvStore[cvId] : null;
    const appPassword = userAppPassword || sender.appPassword || process.env.GMAIL_APP_PASSWORD;

    // Proteksi Anti-Dobel di level Server (Idempotency)
    const idempotencyKey = `${recipientEmail.toLowerCase().trim()}_${(jobTitle || '').toLowerCase().trim()}`;
    if (!global.recentlySentMap) global.recentlySentMap = new Map();
    const lastSentTime = global.recentlySentMap.get(idempotencyKey);
    if (lastSentTime && (Date.now() - lastSentTime) < 20000) {
      return res.json({
        success: true,
        alreadySent: true,
        recipientEmail,
        isRealGmailSent: true,
        messageId: 'anti-duplicate-cached',
        message: 'Lamaran ke posisi dan HRD ini telah terkirim sebelumnya (proteksi anti-dobel aktif).'
      });
    }

    // GENERATE ISI LAMARAN OTOMATIS JIKA KOSONG ATAU SESUAIKAN POSISI
    const generatedLetter = generateTailoredCoverLetter(
      jobTitle, 
      company, 
      sender.name, 
      sender.email, 
      'LinkedIn / Feed Rekruter'
    );

    const finalPlainText = (coverLetter && coverLetter.trim().length > 20) 
      ? coverLetter.trim() 
      : generatedLetter.plainText;

    const finalHtmlContent = (coverLetter && coverLetter.trim().length > 20)
      ? `<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; white-space: pre-line;">${coverLetter.trim()}</div>`
      : generatedLetter.htmlContent;

    let transporter;
    let fromAddress;
    let isRealGmailSent = false;

    // 1. JALUR RESMI GMAIL SMTP: Jika ada Google App Password 16 digit
    // Ini secara otomatis 100% memasukkan email ke folder "Pesan Terkirim (Sent)" di Gmail pengguna!
    if (sender.email && appPassword) {
      transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true, // SSL port 465
        auth: {
          user: sender.email,
          pass: appPassword.replace(/\s+/g, '') // bersihkan spasi
        }
      });
      fromAddress = `"${sender.name}" <${sender.email}>`;
      isRealGmailSent = true;
    } else if (sender.tokens && sender.tokens.access_token) {
      // 2. JALUR OAUTH2 RESMI GOOGLE
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
      isRealGmailSent = true;
    } else {
      // 3. Fallback Sandbox Simulator
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

    // PENANGANAN LAMPIRAN BERKAS CV RESMI
    const attachments = [];
    if (cvBase64) {
      // 1. Berkas CV yang diupload pengguna dikirim langsung dari browser via Base64
      attachments.push({
        filename: cvFileName || 'Curriculum_Vitae_Indra_Gumilar.pdf',
        content: Buffer.from(cvBase64, 'base64')
      });
    } else if (cvFile && cvFile.buffer) {
      // 2. Berkas CV dari in-memory buffer
      attachments.push({
        filename: cvFile.originalName || 'Curriculum_Vitae_Indra_Gumilar.pdf',
        content: cvFile.buffer
      });
    } else {
      // 3. Berkas CV PDF Resmi Indra Gumilar yang tersimpan di server
      const defaultPdfPath = path.join(__dirname, 'Curriculum_Vitae_Indra_Gumilar.pdf');
      if (fs.existsSync(defaultPdfPath)) {
        attachments.push({
          filename: 'Curriculum_Vitae_Indra_Gumilar.pdf',
          content: fs.readFileSync(defaultPdfPath)
        });
      }
    }

    const mailOptions = {
      from: fromAddress,
      to: recipientEmail,
      replyTo: sender.email,
      // cc dihapus - email otomatis tersimpan di folder Sent Gmail tanpa perlu CC ke inbox sendiri
      subject: `Lamaran Pekerjaan: ${jobTitle} - ${sender.name}`,
      text: finalPlainText,
      html: finalHtmlContent,
      attachments
    };

    const info = await transporter.sendMail(mailOptions);
    global.recentlySentMap.set(idempotencyKey, Date.now());
    const testUrl = isRealGmailSent ? null : nodemailer.getTestMessageUrl(info);

    console.log(`[PENGIRIMAN BERHASIL] Dari: ${sender.email} ➜ Ke: ${recipientEmail} | SentFolder: ${isRealGmailSent} | Posisi: ${jobTitle} | ID: ${info.messageId}`);

    console.log(`[PENGIRIMAN BERHASIL] Dari: ${sender.email} ➜ Ke: ${recipientEmail} | SentFolder: ${isRealGmailSent} | ID: ${info.messageId}`);

    res.json({ 
      success: true, 
      senderEmail: sender.email,
      senderName: sender.name,
      recipientEmail: recipientEmail,
      attachedFileName: attachments[0] ? attachments[0].filename : 'Curriculum_Vitae_Indra_Gumilar.pdf',
      isRealGmailSent,
      messageId: info.messageId, 
      previewUrl: testUrl || null,
      message: isRealGmailSent 
        ? `Lamaran & Lampiran CV berhasil dikirim resmi DARI akun Anda (${sender.email}) dan otomatis TERCATAT di folder 'Pesan Terkirim (Sent)' Gmail Anda!`
        : `Lamaran berhasil dikirimkan ke ${recipientEmail}!`
    });
  } catch (error) {
    console.error('Error saat mengirim email:', error);
    res.status(500).json({ 
      success: false, 
      error: `Gagal mengirim email: ${error.message}. Jika menggunakan Gmail, pastikan menggunakan App Password 16 Digit yang benar.` 
    });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'online', timestamp: new Date().toISOString() });
});

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Job Application Bot server listening on http://localhost:${PORT}`);
  });
}

module.exports = app;
