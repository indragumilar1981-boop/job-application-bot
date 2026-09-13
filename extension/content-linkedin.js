/**
 * Content Script: LinkedIn Job Detector
 * Berjalan otomatis di setiap halaman LinkedIn yang berisi lowongan
 */

(function () {
  'use strict';

  const BOT_API = 'https://job-application-bot-p5aq.vercel.app';

  // Hindari inject dua kali
  if (window.__jobBotLinkedInInjected) return;
  window.__jobBotLinkedInInjected = true;

  // Fungsi delay helper
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  // Ekstrak email dari teks (regex)
  function extractEmails(text) {
    const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
    const found = text.match(emailRegex) || [];
    // Filter email yang bukan contoh/placeholder
    return found.filter(e => !e.includes('example') && !e.includes('noreply'));
  }

  // Ekstrak data dari halaman detail lowongan LinkedIn
  function extractJobFromLinkedIn() {
    const jobs = [];

    // --- Halaman Job Detail (linkedin.com/jobs/view/...) ---
    const titleEl = document.querySelector('.job-details-jobs-unified-top-card__job-title, .jobs-unified-top-card__job-title, h1.t-24');
    const companyEl = document.querySelector('.job-details-jobs-unified-top-card__company-name a, .jobs-unified-top-card__company-name, .topcard__org-name-link');
    const locationEl = document.querySelector('.job-details-jobs-unified-top-card__primary-description, .jobs-unified-top-card__bullet, .topcard__flavor--bullet');
    const descEl = document.querySelector('.jobs-description__content, .description__text, #job-details');

    if (titleEl && companyEl) {
      const title = titleEl.innerText.trim();
      const company = companyEl.innerText.trim();
      const location = locationEl ? locationEl.innerText.trim() : 'Jakarta / Bekasi';
      const fullText = descEl ? descEl.innerText : '';
      const emails = extractEmails(fullText);

      // Cari salary dari deskripsi
      const salaryMatch = fullText.match(/[Rr][Pp][.\s]?\d[\d.,]+\s*[-–]\s*[Rr][Pp][.\s]?\d[\d.,]+/);
      const salary = salaryMatch ? salaryMatch[0].trim() : 'Sesuai pengalaman';

      if (title.length > 3 && company.length > 2) {
        jobs.push({
          id: 'ext_li_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
          title,
          company,
          location: location.split('·')[0].trim() || 'Jakarta',
          hrEmail: emails[0] || '',
          salary,
          source: 'LinkedIn',
          sourceIcon: '💼',
          sourceUrl: window.location.href,
          postedTime: 'Terdeteksi dari LinkedIn',
          matchScore: 92,
          category: detectCategory(title),
          required: ['supply chain', 'logistik', 'warehouse'],
          detectedAt: new Date().toISOString(),
          emails
        });
      }
    }

    // --- Halaman Job Search Results (linkedin.com/jobs/search/...) ---
    const jobCards = document.querySelectorAll('.job-card-container, .jobs-search-results__list-item, .scaffold-layout__list-item');
    jobCards.forEach((card, index) => {
      if (index > 9) return; // Max 10 per scan

      const cardTitle = card.querySelector('.job-card-list__title, .job-card-container__link, .base-card__full-link');
      const cardCompany = card.querySelector('.job-card-container__company-name, .artdeco-entity-lockup__subtitle, .job-card-container__primary-description');
      const cardLocation = card.querySelector('.job-card-container__metadata-item, .artdeco-entity-lockup__caption');

      if (cardTitle && cardCompany) {
        const title = cardTitle.innerText.trim();
        const company = cardCompany.innerText.trim();
        const location = cardLocation ? cardLocation.innerText.trim() : 'Indonesia';
        const url = cardTitle.href || card.querySelector('a')?.href || window.location.href;

        if (title.length > 3 && company.length > 2 && isRelevantJob(title)) {
          jobs.push({
            id: 'ext_li_' + Date.now() + '_' + index,
            title,
            company,
            location,
            hrEmail: '',
            salary: 'Sesuai pengalaman',
            source: 'LinkedIn',
            sourceIcon: '💼',
            sourceUrl: url,
            postedTime: 'Terdeteksi dari LinkedIn Search',
            matchScore: 88,
            category: detectCategory(title),
            required: ['supply chain', 'logistik', 'warehouse'],
            detectedAt: new Date().toISOString(),
            emails: []
          });
        }
      }
    });

    // --- LinkedIn Feed Posts (Hiring/Rekruter) ---
    const feedPosts = document.querySelectorAll('.feed-shared-update-v2, .occludable-update');
    feedPosts.forEach((post, index) => {
      if (index > 5) return;
      const content = post.querySelector('.feed-shared-text, .update-components-text');
      if (!content) return;

      const text = content.innerText;
      const isHiring = /hiring|lowongan|lamar|rekrut|open position|kami mencari|we are looking/i.test(text);
      if (!isHiring) return;

      const emails = extractEmails(text);
      const authorEl = post.querySelector('.update-components-actor__name, .feed-shared-actor__name');
      const roleEl = post.querySelector('.update-components-actor__description, .feed-shared-actor__description');
      const company = roleEl ? roleEl.innerText.split(' at ').pop().trim() : 'Rekruter LinkedIn';

      // Cari judul posisi dari teks post
      const posMatch = text.match(/posisi[:\s]+([^\n,]{5,50})|position[:\s]+([^\n,]{5,50})|jabatan[:\s]+([^\n,]{5,50})/i);
      const title = posMatch ? (posMatch[1] || posMatch[2] || posMatch[3]).trim() : 'Posisi Supply Chain / Logistik';

      if (emails.length > 0 || isHiring) {
        jobs.push({
          id: 'ext_li_feed_' + Date.now() + '_' + index,
          title,
          company,
          location: 'Indonesia',
          hrEmail: emails[0] || '',
          salary: 'Sesuai pengalaman',
          source: 'LinkedIn Feed',
          sourceIcon: '📢',
          sourceUrl: window.location.href,
          postedTime: 'Dari Feed LinkedIn',
          matchScore: 85,
          category: detectCategory(title),
          required: ['supply chain', 'logistik'],
          detectedAt: new Date().toISOString(),
          emails
        });
      }
    });

    return jobs;
  }

  // Deteksi kategori berdasarkan judul
  function detectCategory(title) {
    const t = title.toLowerCase();
    if (/fleet|transport|sopir|driver|armada/.test(t)) return 'transport';
    if (/warehouse|gudang|inventory|stock/.test(t)) return 'warehouse';
    if (/procurement|purchasing|sourcing|vendor/.test(t)) return 'procurement';
    return 'supply_chain';
  }

  // Cek apakah lowongan relevan dengan Supply Chain/Logistics
  function isRelevantJob(title) {
    const keywords = /supply chain|logistik|logistics|warehouse|gudang|inventory|procurement|purchasing|fleet|transport|distribusi|distribution|scm|wms|erp/i;
    return keywords.test(title);
  }

  // Simpan ke chrome.storage
  async function saveDetectedJobs(jobs) {
    if (jobs.length === 0) return;

    return new Promise((resolve) => {
      chrome.storage.local.get(['detectedJobs'], (result) => {
        const existing = result.detectedJobs || [];

        // De-duplikasi berdasarkan title + company
        const existingKeys = new Set(existing.map(j => `${j.title}__${j.company}`));
        const newJobs = jobs.filter(j => !existingKeys.has(`${j.title}__${j.company}`));

        if (newJobs.length > 0) {
          const updated = [...newJobs, ...existing].slice(0, 50); // Max 50
          chrome.storage.local.set({ detectedJobs: updated }, () => {
            // Update badge
            chrome.runtime.sendMessage({
              type: 'UPDATE_BADGE',
              count: updated.length
            });
            resolve(newJobs.length);
          });
        } else {
          resolve(0);
        }
      });
    });
  }

  // Fungsi utama - scan dan simpan
  async function scanPage() {
    await sleep(2000); // Tunggu halaman fully loaded

    const jobs = extractJobFromLinkedIn();
    if (jobs.length === 0) return;

    const newCount = await saveDetectedJobs(jobs);

    if (newCount > 0) {
      console.log(`[Job Bot] ✅ ${newCount} lowongan baru terdeteksi dari LinkedIn!`);

      // Tampilkan notif kecil di halaman
      showPageNotification(newCount);
    }
  }

  // Tampilkan notif kecil di sudut halaman
  function showPageNotification(count) {
    // Hapus notif lama jika ada
    const old = document.getElementById('job-bot-notif');
    if (old) old.remove();

    const notif = document.createElement('div');
    notif.id = 'job-bot-notif';
    notif.innerHTML = `
      <div style="
        position: fixed; bottom: 24px; right: 24px; z-index: 99999;
        background: linear-gradient(135deg, #6366f1, #7c3aed);
        color: white; border-radius: 14px; padding: 12px 18px;
        font-family: -apple-system, sans-serif; font-size: 14px;
        box-shadow: 0 8px 32px rgba(99,102,241,0.4);
        display: flex; align-items: center; gap: 10px;
        animation: slideIn 0.3s ease; cursor: pointer;
        border: 1px solid rgba(255,255,255,0.2);
      ">
        <span style="font-size:20px">🤖</span>
        <div>
          <strong>Job Bot</strong><br>
          <small>${count} lowongan baru terdeteksi!</small>
        </div>
        <button style="
          margin-left: 8px; background: rgba(255,255,255,0.2);
          border: none; color: white; border-radius: 8px;
          padding: 4px 10px; cursor: pointer; font-size: 12px;
        ">Lihat</button>
      </div>
      <style>
        @keyframes slideIn {
          from { transform: translateX(100px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      </style>
    `;

    notif.querySelector('button').onclick = () => chrome.runtime.sendMessage({ type: 'OPEN_POPUP' });
    notif.onclick = () => setTimeout(() => notif.remove(), 300);

    document.body.appendChild(notif);

    // Auto hide setelah 8 detik
    setTimeout(() => { if (notif.parentNode) notif.remove(); }, 8000);
  }

  // Jalankan scan
  scanPage();

  // Re-scan saat halaman berubah (SPA navigation)
  let lastUrl = location.href;
  new MutationObserver(() => {
    const currentUrl = location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      setTimeout(scanPage, 2000);
    }
  }).observe(document, { subtree: true, childList: true });

})();
