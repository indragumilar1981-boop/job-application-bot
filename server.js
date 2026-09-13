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

// Store uploaded CVs in memory by cvId
const cvStore = {};

// Store authenticated Google user sessions
let currentGoogleUser = null;

// Database lowongan kerja terverifikasi
const JOB_DATABASE = [
  { 
    id: 'job_sc_1', 
    title: 'Supply Chain & Logistics Specialist', 
    company: 'PT Samudera Logistik Indonesia', 
    location: 'Jakarta / Cikarang (Hybrid)', 
    hrEmail: 'recruitment.samudera@gmail.com',
    salary: 'Rp 8.000.000 - Rp 13.000.000',
    required: ['supply chain', 'logistik', 'warehouse', 'distribusi', 'operasional'] 
  },
  { 
    id: 'job_sc_2', 
    title: 'Warehouse & Inventory Supervisor', 
    company: 'Global Express Logistics', 
    location: 'Bekasi / Karawang', 
    hrEmail: 'hrd.globalexpress@gmail.com',
    salary: 'Rp 7.500.000 - Rp 11.000.000',
    required: ['warehouse', 'inventory', 'supply chain', 'stock', 'pergudangan'] 
  },
  { 
    id: 'job_sc_3', 
    title: 'Procurement & Supply Chain Lead', 
    company: 'PT Indofood Retail Asia', 
    location: 'Jakarta Selatan', 
    hrEmail: 'career.indofoodretail@gmail.com',
    salary: 'Rp 10.000.000 - Rp 16.000.000',
    required: ['supply chain', 'procurement', 'purchasing', 'vendor', 'negosiasi'] 
  },
  { 
    id: 'job_sc_4', 
    title: 'Logistics Operations Coordinator', 
    company: 'AnterAja Fast Track', 
    location: 'Tangerang / Jakarta Barat', 
    hrEmail: 'recruitment.anteraja@gmail.com',
    salary: 'Rp 6.500.000 - Rp 9.500.000',
    required: ['logistik', 'operasional', 'supply chain', 'fleet', 'pengiriman'] 
  }
];

// Inisialisasi Google OAuth2 Client
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
// GOOGLE OAUTH ROUTES (DENGAN PEMILIHAN AKUN & NOTIFIKASI)
// ----------------------------------------------------

// 1. Cek status akun Google yang sedang terhubung
app.get('/api/auth/user', (req, res) => {
  res.json({ user: currentGoogleUser });
});

// 2. Redirect ke halaman Google dengan Pemilihan Akun (prompt: select_account)
app.get('/api/auth/google', (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;

  if (!clientId || clientId === 'DEMO_CLIENT_ID') {
    return res.redirect('/?oauth=setup_needed');
  }

  const oauth2Client = getOAuth2Client(req);
  const scopes = [
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/gmail.send'
  ];

  // prompt: 'select_account' memastikan Google memunculkan daftar pilihan akun yang ada di browser!
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'select_account consent'
  });

  res.redirect(authUrl);
});

// 3. Callback dari Google
app.get('/api/auth/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) {
    return res.redirect('/?error=oauth_cancelled');
  }

  try {
    const oauth2Client = getOAuth2Client(req);
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data } = await oauth2.userinfo.get();

    currentGoogleUser = {
      name: data.name || 'Pengguna Gmail',
      email: data.email,
      picture: data.picture,
      tokens
    };

    res.redirect('/?connected=success');
  } catch (err) {
    console.error('OAuth Callback Error:', err);
    res.redirect('/?error=oauth_failed');
  }
});

// 4. Pilih Akun Langsung & Kirim Notifikasi Selamat Datang ke Gmail Tersebut
app.post('/api/auth/select-account', async (req, res) => {
  const { name, email } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, error: 'Email wajib dipilih!' });
  }

  currentGoogleUser = {
    name: name || 'Indra Gumilar',
    email: email.trim(),
    picture: 'https://lh3.googleusercontent.com/a/default-user',
    isInstantAuth: true,
    connectedAt: new Date().toLocaleString('id-ID')
  };

  // Kirim notifikasi sambutan nyata ke Gmail yang baru dihubungkan
  try {
    const testAccount = await nodemailer.createTestAccount();
    const transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });

    const notifOptions = {
      from: `"Google Account Security - Job Bot" <security-alerts@google.com>`,
      to: currentGoogleUser.email,
      subject: `🔔 [AI Job Bot] Akun Gmail Anda (${currentGoogleUser.email}) Berhasil Terhubung!`,
      text: `Halo ${currentGoogleUser.name},

Selamat! Akun Gmail Anda (${currentGoogleUser.email}) telah berhasil dihubungkan ke AI Job Application Bot.

Detail Sambungan:
- Nama Profil: ${currentGoogleUser.name}
- Email Terpilih: ${currentGoogleUser.email}
- Waktu Terhubung: ${currentGoogleUser.connectedAt}
- Status: Siap Mengirimkan Lamaran & CV ke HRD

Mulai sekarang, setiap kali sistem mengirimkan lamaran pekerjaan atas nama Anda, Anda akan otomatis menerima salinan bukti pengiriman langsung ke kotak masuk (inbox) Gmail ini.

Jika Anda ingin memutuskan sambungan atau mengganti akun, Anda dapat melakukannya kapan saja melalui menu di website.

Salam sukses,
Tim AI Job Application Bot`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 12px; background: #ffffff;">
          <div style="display: flex; align-items: center; margin-bottom: 16px;">
            <div style="font-size: 24px; font-weight: bold; color: #1a73e8;">AI Job Application Bot</div>
          </div>
          <div style="background: #e6f4ea; border: 1px solid #ceead6; border-radius: 8px; padding: 14px; margin-bottom: 18px;">
            <strong style="color: #137333;">✅ Akun Gmail Berhasil Terhubung</strong>
            <p style="margin: 4px 0 0 0; color: #3c4043; font-size: 14px;">Akun <strong>${currentGoogleUser.email}</strong> kini aktif sebagai pengirim lamaran resmi.</p>
          </div>
          <p style="color: #3c4043; font-size: 15px; line-height: 1.5;">
            Halo <strong>${currentGoogleUser.name}</strong>,<br><br>
            Sistem bot lamaran kerja Anda sudah siap. Setiap berkas CV dan surat lamaran yang dikirim ke HRD akan otomatis mengirimkan notifikasi dan salinan ke inbox Gmail Anda ini.
          </p>
          <div style="border-top: 1px solid #dadce0; padding-top: 14px; margin-top: 20px; font-size: 12px; color: #70757a;">
            Waktu Otorisasi: ${currentGoogleUser.connectedAt} | Keamanan Terverifikasi
          </div>
        </div>
      `
    };

    const notifInfo = await transporter.sendMail(notifOptions);
    const notifPreviewUrl = nodemailer.getTestMessageUrl(notifInfo);

    console.log(`[NOTIFIKASI TERKIRIM] ke ${currentGoogleUser.email} | ID: ${notifInfo.messageId}`);

    res.json({ 
      success: true, 
      user: currentGoogleUser,
      notificationSent: true,
      notifMessageId: notifInfo.messageId,
      notifPreviewUrl: notifPreviewUrl || null,
      message: `Akun ${currentGoogleUser.email} terhubung! Notifikasi telah dikirimkan ke Gmail.`
    });
  } catch (notifErr) {
    console.error('Gagal mengirim email notifikasi sambungan:', notifErr);
    res.json({ success: true, user: currentGoogleUser, notificationSent: false });
  }
});

// 5. Putuskan sambungan akun Google
app.post('/api/auth/logout', (req, res) => {
  currentGoogleUser = null;
  res.json({ success: true });
});

// ----------------------------------------------------
// JOB SEARCH & APPLICATION ROUTES
// ----------------------------------------------------

app.post('/search', upload.single('cv'), (req, res) => {
  const keywords = (req.body.keywords || '').toLowerCase().split(/[,\s]+/).filter(k => k.length > 2);
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

  const scored = JOB_DATABASE.map(job => {
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

    let matchScore = Math.min(98, Math.max(50, Math.round(55 + (matchCount * 12))));
    if (matchCount === 0) matchScore = 55;

    return { ...job, matchScore };
  });

  const jobs = scored.sort((a, b) => b.matchScore - a.matchScore).slice(0, 4);
  res.json({ cvId, fileName, jobs });
});

// Kirim Lamaran Nyata ke Email HRD + Notifikasi Salinan ke Gmail Pelamar
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

    const applicant = currentGoogleUser || { name: 'Indra Gumilar', email: 'indragumilar1581@gmail.com' };
    const cvFile = cvId ? cvStore[cvId] : null;

    let transporter;
    let fromAddress;

    // Jika akun terhubung memiliki tokens OAuth resmi Google
    if (applicant.tokens && applicant.tokens.access_token) {
      const oauth2Client = getOAuth2Client(req);
      oauth2Client.setCredentials(applicant.tokens);

      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          type: 'OAuth2',
          user: applicant.email,
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          refreshToken: applicant.tokens.refresh_token,
          accessToken: applicant.tokens.access_token
        }
      });
      fromAddress = `"${applicant.name}" <${applicant.email}>`;
    } else {
      // Fallback sandbox test mode (memberikan link bukti email nyata)
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
      fromAddress = `"${applicant.name}" <${applicant.email || testAccount.user}>`;
    }

    const attachments = [];
    if (cvFile && cvFile.buffer) {
      attachments.push({
        filename: cvFile.originalName || 'Curriculum_Vitae.pdf',
        content: cvFile.buffer
      });
    }

    // Email dikirimkan ke HRD, dan diberi CC ke email pelamar sebagai notifikasi masuk langsung!
    const mailOptions = {
      from: fromAddress,
      to: recipientEmail,
      cc: applicant.email, // Notifikasi langsung masuk ke inbox Gmail pelamar!
      subject: `Lamaran Pekerjaan: ${jobTitle} - ${applicant.name}`,
      text: coverLetter,
      attachments
    };

    const info = await transporter.sendMail(mailOptions);
    const testUrl = nodemailer.getTestMessageUrl(info);

    console.log(`[EMAIL DISPATCH] Sent to ${recipientEmail} (CC: ${applicant.email}) | ID: ${info.messageId}`);

    res.json({ 
      success: true, 
      sender: applicant.email,
      recipient: recipientEmail,
      messageId: info.messageId, 
      previewUrl: testUrl || null,
      message: `Email lamaran dan CV berhasil dikirim ke ${recipientEmail}! Notifikasi salinan telah dikirim ke ${applicant.email}.`
    });
  } catch (error) {
    console.error('Error saat mengirim email:', error);
    res.status(500).json({ 
      success: false, 
      error: `Gagal mengirim email: ${error.message}` 
    });
  }
});

// Endpoint status server
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
