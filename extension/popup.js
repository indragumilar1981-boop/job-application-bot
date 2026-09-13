/**
 * Popup Script - Job Bot Extension
 * Mengelola UI popup dan komunikasi dengan storage & bot API
 */

const BOT_URL = 'https://job-application-bot-p5aq.vercel.app';
const CRON_SECRET = 'autopilot-bot-2025';

let allDetectedJobs = [];
let addedJobIds = new Set();
let currentTab = 'detected';

// Elemen DOM
const jobList = document.getElementById('jobList');
const totalCount = document.getElementById('totalCount');
const tabDetectedCount = document.getElementById('tabDetectedCount');
const tabAddedCount = document.getElementById('tabAddedCount');
const btnAddAll = document.getElementById('btnAddAll');
const btnClear = document.getElementById('btnClear');
const btnOpenBot = document.getElementById('btnOpenBot');
const lastScan = document.getElementById('lastScan');

// Toast notification
function showToast(msg, color = '#10b981') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.style.background = color;
  toast.style.display = 'block';
  setTimeout(() => { toast.style.display = 'none'; }, 3000);
}

// Format waktu relatif
function timeAgo(isoStr) {
  if (!isoStr) return '-';
  const diff = (Date.now() - new Date(isoStr).getTime()) / 1000;
  if (diff < 60) return `${Math.round(diff)}d lalu`;
  if (diff < 3600) return `${Math.round(diff / 60)}m lalu`;
  if (diff < 86400) return `${Math.round(diff / 3600)}j lalu`;
  return `${Math.round(diff / 86400)}h lalu`;
}

// Load data dari chrome.storage
function loadData() {
  chrome.storage.local.get(['detectedJobs', 'addedJobIds'], (result) => {
    allDetectedJobs = result.detectedJobs || [];
    addedJobIds = new Set(result.addedJobIds || []);
    renderUI();
  });
}

// Render daftar lowongan
function renderUI() {
  const pendingJobs = allDetectedJobs.filter(j => !addedJobIds.has(j.id));
  const doneJobs = allDetectedJobs.filter(j => addedJobIds.has(j.id));

  totalCount.textContent = pendingJobs.length;
  tabDetectedCount.textContent = pendingJobs.length;
  tabAddedCount.textContent = doneJobs.length;

  // Update badge
  chrome.runtime.sendMessage({ type: 'UPDATE_BADGE', count: pendingJobs.length });

  const jobsToShow = currentTab === 'detected' ? pendingJobs : doneJobs;

  if (jobsToShow.length === 0) {
    jobList.innerHTML = renderEmptyState();
    document.getElementById('bulkActions').style.display = currentTab === 'detected' && pendingJobs.length === 0 ? 'none' : 'flex';
    return;
  }

  document.getElementById('bulkActions').style.display = 'flex';

  // Update last scan time
  if (allDetectedJobs.length > 0) {
    const latest = allDetectedJobs[0];
    lastScan.textContent = 'Terakhir: ' + timeAgo(latest.detectedAt);
  }

  jobList.innerHTML = jobsToShow.map(job => {
    const isAdded = addedJobIds.has(job.id);
    const sourceClass = (job.source || '').toLowerCase().includes('jobstreet') ? 'source-jobstreet' : 'source-linkedin';

    return `
      <div class="job-item ${isAdded ? 'added' : ''}" data-id="${job.id}">
        <span class="job-source-icon">${job.sourceIcon || '💼'}</span>
        <div class="job-info">
          <div class="job-title" title="${job.title}">${job.title}</div>
          <div class="job-company">${job.company} · ${(job.location || '').split(/[,\n]/)[0]}</div>
          <div class="job-meta">
            <span class="job-tag ${sourceClass}">${job.source || 'Portal'}</span>
            ${job.salary && job.salary !== 'Sesuai pengalaman' ? `<span class="job-tag">💰 ${job.salary}</span>` : ''}
            <span class="job-tag">${timeAgo(job.detectedAt)}</span>
          </div>
          ${job.hrEmail ? `<div class="job-email">📧 ${job.hrEmail}</div>` : '<div class="job-email" style="color:#64748b">📧 Email belum terdeteksi</div>'}
        </div>
        <button class="btn-add-job ${isAdded ? 'added' : ''}" 
                data-id="${job.id}" 
                ${isAdded ? 'disabled' : ''}>
          ${isAdded ? '✅ Ditambahkan' : '➕ Tambah'}
        </button>
      </div>
    `;
  }).join('');

  // Event listener untuk tombol add individual
  jobList.querySelectorAll('.btn-add-job:not(.added)').forEach(btn => {
    btn.addEventListener('click', () => {
      const jobId = btn.dataset.id;
      const job = allDetectedJobs.find(j => j.id === jobId);
      if (job) addJobToBot([job]);
    });
  });

  // Click job item → buka URL
  jobList.querySelectorAll('.job-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.classList.contains('btn-add-job')) return;
      const jobId = item.dataset.id;
      const job = allDetectedJobs.find(j => j.id === jobId);
      if (job && job.sourceUrl) chrome.tabs.create({ url: job.sourceUrl });
    });
  });
}

function renderEmptyState() {
  if (currentTab === 'added') {
    return `<div class="empty-state">
      <div class="empty-icon">📭</div>
      <h3>Belum ada yang ditambahkan</h3>
      <p>Tambahkan lowongan dari tab "Terdeteksi" ke sistem bot.</p>
    </div>`;
  }

  return `<div class="empty-state">
    <div class="empty-icon">🔍</div>
    <h3>Belum ada lowongan terdeteksi</h3>
    <p>Buka halaman berikut untuk mulai deteksi otomatis:</p>
    <div class="portals-list">
      <a class="portal-link" id="openLinkedIn">
        💼 <span>linkedin.com/jobs/search/?keywords=supply+chain+bekasi</span>
      </a>
      <a class="portal-link" id="openJobstreet">
        🏢 <span>id.jobstreet.com/id/job-search/supply-chain-jobs-in-bekasi</span>
      </a>
    </div>
  </div>`;
}

// Tambahkan job ke bot system
async function addJobToBot(jobs) {
  if (!jobs || jobs.length === 0) return;

  // Simpan ke chrome.storage sebagai "added"
  const newAddedIds = jobs.map(j => j.id);
  newAddedIds.forEach(id => addedJobIds.add(id));

  chrome.storage.local.set({ addedJobIds: [...addedJobIds] });

  // Kirim ke API bot (endpoint baru di server)
  for (const job of jobs) {
    try {
      const response = await fetch(`${BOT_URL}/api/add-job`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${CRON_SECRET}`
        },
        body: JSON.stringify({
          id: job.id,
          title: job.title,
          company: job.company,
          location: job.location,
          hrEmail: job.hrEmail,
          salary: job.salary,
          source: job.source,
          sourceIcon: job.sourceIcon,
          sourceUrl: job.sourceUrl,
          category: job.category || 'supply_chain',
          matchScore: job.matchScore || 90,
          required: job.required || ['supply chain', 'logistik']
        })
      });

      if (response.ok) {
        console.log(`[Job Bot] ✅ ${job.title} ditambahkan ke bot!`);
      }
    } catch (err) {
      // Jika API gagal, tetap tandai sebagai added di storage
      console.warn(`[Job Bot] Gagal sync ke API: ${err.message}`);
    }
  }

  showToast(`✅ ${jobs.length} lowongan ditambahkan ke bot!`);
  renderUI();
}

// Event listeners
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentTab = btn.dataset.tab;
    renderUI();
  });
});

btnAddAll.addEventListener('click', () => {
  const pending = allDetectedJobs.filter(j => !addedJobIds.has(j.id));
  if (pending.length === 0) return showToast('Semua lowongan sudah ditambahkan!', '#6366f1');
  addJobToBot(pending);
});

btnClear.addEventListener('click', () => {
  if (!confirm('Hapus semua lowongan yang terdeteksi?')) return;
  chrome.storage.local.set({ detectedJobs: [], addedJobIds: [] }, () => {
    allDetectedJobs = [];
    addedJobIds = new Set();
    chrome.runtime.sendMessage({ type: 'CLEAR_BADGE' });
    renderUI();
  });
});

btnOpenBot.addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: BOT_URL });
});

// Dynamic portal links (setelah render)
jobList.addEventListener('click', (e) => {
  const li = e.target.closest('#openLinkedIn');
  const js = e.target.closest('#openJobstreet');
  if (li) chrome.tabs.create({ url: 'https://www.linkedin.com/jobs/search/?keywords=supply+chain+logistik+bekasi&location=Bekasi' });
  if (js) chrome.tabs.create({ url: 'https://id.jobstreet.com/id/job-search/supply-chain-jobs-in-bekasi-jawa-barat/' });
});

// Load awal
loadData();
