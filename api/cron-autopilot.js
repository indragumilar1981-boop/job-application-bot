/**
 * Vercel Cron Job - Auto Pilot Pengiriman Lamaran
 * Berjalan otomatis setiap jam tanpa perlu buka browser
 * Schedule: Setiap 2 jam (0 */2 * * *)
 */

const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

// =========================================================
// DATABASE LOWONGAN (Sync dengan server.js & index.html)
// =========================================================
const JOB_DATABASE = [
  { 
    id: 'job_js_1', 
    title: 'HEAD OF WAREHOUSE', 
    company: 'PT. Lasallefood Indonesia', 
    location: 'Cileungsi / Bekasi, Jawa Barat', 
    hrEmail: 'recruitment.lasallefood@gmail.com',
    source: 'Jobstreet Indonesia'
  },
  { 
    id: 'job_js_2', 
    title: 'Operations Supervisor / Supervisor Operasi', 
    company: 'PT CLOUD DREAM MARKETING', 
    location: 'Jakarta Raya / Bekasi', 
    hrEmail: 'recruitment.clouddream@gmail.com',
    source: 'Jobstreet Indonesia'
  },
  { 
    id: 'job_js_3', 
    title: 'Warehouse Supervisor / Kepala Gudang', 
    company: 'PT. Maju Bersama Logistics', 
    location: 'Bekasi / Cikarang Barat', 
    hrEmail: 'hrd.majubersama@gmail.com',
    source: 'Jobstreet Indonesia'
  },
  { 
    id: 'job_js_4', 
    title: 'Supply Chain Coordinator', 
    company: 'PT Eka Sari Lorena Transport', 
    location: 'Jakarta Timur / Bekasi', 
    hrEmail: 'rekrutmen.lorena@gmail.com',
    source: 'Jobstreet Indonesia'
  },
  { 
    id: 'job_js_5', 
    title: 'Purchasing / Procurement Supervisor', 
    company: 'PT. Sumber Makmur Sejahtera', 
    location: 'Cikarang / Bekasi', 
    hrEmail: 'hrd.sms.cikarang@gmail.com',
    source: 'Jobstreet Indonesia'
  },
  { 
    id: 'job_js_6', 
    title: 'Logistics & Distribution Manager', 
    company: 'PT Pegasus Express Indonesia', 
    location: 'Bekasi / Bogor', 
    hrEmail: 'career.pegasusexpress@gmail.com',
    source: 'Jobstreet Indonesia'
  },
  {
    id: 'job_ln_1',
    title: 'Logistics & Fleet Operations Supervisor',
    company: 'PT Wahana Trans Lestari',
    location: 'Jakarta / Bekasi',
    hrEmail: 'recruitment.wahana.trans@gmail.com',
    source: 'LinkedIn'
  },
  {
    id: 'job_ln_2',
    title: 'Supply Chain & Warehouse Manager',
    company: 'PT Lazada Logistics Indonesia',
    location: 'Cikarang, Bekasi',
    hrEmail: 'talent.lazada.id@gmail.com',
    source: 'LinkedIn'
  },
  {
    id: 'job_ln_3',
    title: 'Kepala Gudang / Warehouse Head',
    company: 'PT Global Anugrah Mandiri',
    location: 'Bekasi Timur, Jawa Barat',
    hrEmail: 'hrd.global.anugrah@gmail.com',
    source: 'LinkedIn'
  },
  {
    id: 'job_scf_1',
    title: 'End-to-End Supply Chain Coordinator',
    company: 'Shopee Express Hub Nusantara',
    location: 'Jakarta / Bekasi',
    hrEmail: 'recruitment.shopeexpress@gmail.com',
    source: 'LinkedIn Feed'
  },
  {
    id: 'job_scf_2',
    title: 'Fleet & Warehouse Operations Coordinator',
    company: 'J&T Cargo Express',
    location: 'Jabodetabek',
    hrEmail: 'recruitment.jtcargo@gmail.com',
    source: 'LinkedIn Feed'
  },
  {
    id: 'job_scf_3',
    title: 'Senior Supply Chain Analyst',
    company: 'Tokopedia Logistics Hub',
    location: 'Bekasi / Cikarang',
    hrEmail: 'scm.recruitment.tokopedia@gmail.com',
    source: 'LinkedIn Feed'
  }
];

// =========================================================
// COVER LETTER GENERATOR (sama dengan server.js)
// =========================================================
function generateCoverLetter(jobTitle, company, senderName, senderEmail) {
  const cleanTitle = jobTitle || 'Posisi Terkait';
  const cleanCompany = company || 'Perusahaan';

  let specialization = 'manajemen operasional logistik, tata kelola pergudangan, serta koordinasi rantai pasok (supply chain)';
  let keyHighlights = 'pengelolaan alur keluar-masuk barang, akurasi stok, kepemimpinan tim lapangan, dan efisiensi biaya operasional';

  if (/fleet|transport|sopir|driver|armada|kendaraan/i.test(cleanTitle)) {
    specialization = 'manajemen operasional armada (fleet management), koordinasi distribusi rute logistik, dan pengelolaan tim driver';
    keyHighlights = 'perencanaan utilisasi kendaraan secara efisien, pemeliharaan armada, monitoring SLA, serta kepatuhan standar keselamatan';
  } else if (/warehouse|gudang|inventory|stock/i.test(cleanTitle)) {
    specialization = 'manajemen pergudangan (warehouse operations), akurasi stock opname, dan sistem manajemen pergudangan (WMS)';
    keyHighlights = 'penerapan 5S di gudang, pengawasan alur inbound-outbound barang, pemenuhan order tepat waktu, serta minimalisasi selisih stok';
  } else if (/procurement|purchasing|sourcing|vendor/i.test(cleanTitle)) {
    specialization = 'pengadaan barang & jasa (strategic procurement), negosiasi vendor, dan pengendalian anggaran';
    keyHighlights = 'evaluasi kinerja pemasok, pengadaan material tepat waktu, analisis perbandingan harga pasar';
  } else if (/supply chain|demand|planning|logistik/i.test(cleanTitle)) {
    specialization = 'perencanaan rantai pasok terintegrasi (end-to-end supply chain planning), manajemen logistik, dan forecasting';
    keyHighlights = 'sinkronisasi demand dan supply, koordinasi lintas divisi, pemanfaatan ERP/SAP, dan optimalisasi siklus persediaan';
  }

  const htmlContent = `
    <div style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.6; color: #1e293b; max-width: 650px;">
      <p>Kepada Yth.<br>
      <strong>Tim Rekrutmen / HRD ${cleanCompany}</strong><br>
      Di tempat</p>

      <p>Dengan hormat,</p>

      <p>Sehubungan dengan informasi lowongan pekerjaan untuk posisi <strong>${cleanTitle}</strong> di <strong>${cleanCompany}</strong> yang saya peroleh melalui <em>${'Portal Karir / LinkedIn'}</em>, saya yang bertanda tangan di bawah ini:</p>

      <table style="margin: 12px 0; border-collapse: collapse; font-size: 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; width: 100%;">
        <tr><td style="padding: 6px 12px; font-weight: bold; width: 140px; color: #475569;">Nama Lengkap</td><td style="padding: 6px 12px;">: <strong>${senderName}</strong></td></tr>
        <tr><td style="padding: 6px 12px; font-weight: bold; color: #475569;">Email Kontak</td><td style="padding: 6px 12px;">: <a href="mailto:${senderEmail}" style="color: #2563eb;">${senderEmail}</a></td></tr>
        <tr><td style="padding: 6px 12px; font-weight: bold; color: #475569;">Posisi Dilamar</td><td style="padding: 6px 12px;">: <span style="background: #e0e7ff; color: #3730a3; padding: 2px 8px; border-radius: 4px; font-weight: bold;">${cleanTitle}</span></td></tr>
      </table>

      <p>Bermaksud untuk mengajukan diri guna berkontribusi secara profesional pada posisi tersebut. Saya memiliki latar belakang pengalaman kerja yang solid di bidang <strong>${specialization}</strong>.</p>

      <p>Selama berkarier, saya terbiasa mengelola dan mengoptimalkan <strong>${keyHighlights}</strong>, serta memiliki kemampuan pemecahan masalah yang adaptif demi mendukung pertumbuhan <strong>${cleanCompany}</strong>.</p>

      <p>Sebagai bahan pertimbangan, bersama email ini saya lampirkan <strong>Curriculum Vitae (CV)</strong> terbaru saya.</p>

      <p>Besar harapan saya untuk diberikan kesempatan menghadiri sesi wawancara. Atas perhatian dan kesempatan yang diberikan, saya ucapkan terima kasih.</p>

      <p style="margin-top: 25px; border-top: 1px solid #e2e8f0; padding-top: 15px;">
        Hormat saya,<br><br>
        <strong>${senderName}</strong><br>
        <span style="color: #64748b; font-size: 13px;">${senderEmail}</span>
      </p>
    </div>
  `;

  return htmlContent;
}

// =========================================================
// PERSISTENT SENT LOG (menggunakan file JSON di /tmp)
// Vercel menyediakan /tmp sebagai temporary storage per instance
// =========================================================
const SENT_LOG_PATH = '/tmp/cron_sent_log.json';

function loadSentLog() {
  try {
    if (fs.existsSync(SENT_LOG_PATH)) {
      const data = fs.readFileSync(SENT_LOG_PATH, 'utf8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('[CRON] Gagal membaca sent log:', e.message);
  }
  return {};
}

function saveSentLog(log) {
  try {
    fs.writeFileSync(SENT_LOG_PATH, JSON.stringify(log, null, 2));
  } catch (e) {
    console.error('[CRON] Gagal menyimpan sent log:', e.message);
  }
}

// =========================================================
// HANDLER UTAMA CRON
// =========================================================
module.exports = async function handler(req, res) {
  // Verifikasi bahwa ini dipanggil oleh Vercel Cron (bukan akses liar)
  const authHeader = req.headers['authorization'];
  const cronSecret = process.env.CRON_SECRET || 'autopilot-bot-2025';

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Hanya izinkan dari Vercel Cron atau manual trigger dengan secret
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const isManualTrigger = authHeader === `Bearer ${cronSecret}`;
  
  if (!isVercelCron && !isManualTrigger) {
    return res.status(401).json({ 
      error: 'Unauthorized. Gunakan Authorization: Bearer ' + cronSecret + ' untuk trigger manual.' 
    });
  }

  const senderEmail = process.env.GMAIL_USER || 'gumilar.indra@gmail.com';
  const senderName = process.env.SENDER_NAME || 'Indra Gumilar';
  const appPassword = process.env.GMAIL_APP_PASSWORD;

  if (!appPassword) {
    console.error('[CRON] GMAIL_APP_PASSWORD tidak dikonfigurasi!');
    return res.status(500).json({ 
      success: false, 
      error: 'GMAIL_APP_PASSWORD tidak dikonfigurasi di Vercel Environment Variables!' 
    });
  }

  // Load history yang sudah terkirim
  const sentLog = loadSentLog();
  const today = new Date().toISOString().split('T')[0]; // Format: 2025-01-15
  
  // Inisialisasi log hari ini jika belum ada
  if (!sentLog[today]) {
    sentLog[today] = [];
  }

  // Buat transporter Gmail
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: senderEmail,
      pass: appPassword.replace(/\s+/g, '')
    }
  });

  // Load CV PDF dari file sistem
  const cvPath = path.join('/var/task', 'Curriculum_Vitae_Indra_Gumilar.pdf');
  const attachments = [];
  if (fs.existsSync(cvPath)) {
    attachments.push({
      filename: 'Curriculum_Vitae_Indra_Gumilar.pdf',
      content: fs.readFileSync(cvPath)
    });
  }

  const results = [];
  let sentCount = 0;
  let skippedCount = 0;

  for (const job of JOB_DATABASE) {
    // Cek apakah sudah pernah dikirim (cek berdasarkan job ID)
    const alreadySentEver = Object.values(sentLog).some(dayLog => 
      dayLog.includes(job.id)
    );

    if (alreadySentEver) {
      skippedCount++;
      results.push({ 
        jobId: job.id, 
        title: job.title, 
        company: job.company,
        status: 'SKIPPED', 
        reason: 'Sudah pernah dikirim sebelumnya (anti-duplikat)' 
      });
      continue;
    }

    // Kirim email
    try {
      const htmlBody = generateCoverLetter(job.title, job.company, senderName, senderEmail);
      
      const mailOptions = {
        from: `"${senderName}" <${senderEmail}>`,
        to: job.hrEmail,
        replyTo: senderEmail,
        cc: senderEmail,
        subject: `Lamaran Pekerjaan: ${job.title} - ${senderName}`,
        html: htmlBody,
        attachments
      };

      const info = await transporter.sendMail(mailOptions);

      // Catat sebagai sudah terkirim
      sentLog[today].push(job.id);
      sentCount++;

      results.push({ 
        jobId: job.id,
        title: job.title, 
        company: job.company,
        hrEmail: job.hrEmail,
        status: 'SENT', 
        messageId: info.messageId,
        sentAt: new Date().toLocaleString('id-ID')
      });

      console.log(`[CRON ✅] Terkirim: ${job.title} @ ${job.company} → ${job.hrEmail}`);

      // Jeda 3 detik antar email untuk menghindari spam filter
      await new Promise(r => setTimeout(r, 3000));

    } catch (err) {
      results.push({ 
        jobId: job.id,
        title: job.title, 
        company: job.company,
        hrEmail: job.hrEmail,
        status: 'ERROR', 
        error: err.message 
      });
      console.error(`[CRON ❌] Gagal: ${job.title} @ ${job.company} - ${err.message}`);
    }
  }

  // Simpan log yang diupdate
  saveSentLog(sentLog);

  const response = {
    success: true,
    runAt: new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }),
    summary: {
      totalJobs: JOB_DATABASE.length,
      sent: sentCount,
      skipped: skippedCount,
      errors: results.filter(r => r.status === 'ERROR').length
    },
    results
  };

  console.log(`[CRON SELESAI] Terkirim: ${sentCount}, Dilewati: ${skippedCount}`);
  return res.json(response);
};
