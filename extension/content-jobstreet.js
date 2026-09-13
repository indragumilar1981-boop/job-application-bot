/**
 * Content Script: Jobstreet Job Detector
 * Berjalan otomatis di setiap halaman Jobstreet
 */

(function () {
  'use strict';

  if (window.__jobBotJobstreetInjected) return;
  window.__jobBotJobstreetInjected = true;

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  function extractEmails(text) {
    const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
    const found = text.match(emailRegex) || [];
    return found.filter(e => !e.includes('example') && !e.includes('noreply') && !e.includes('jobstreet'));
  }

  function detectCategory(title) {
    const t = title.toLowerCase();
    if (/fleet|transport|sopir|driver|armada/.test(t)) return 'transport';
    if (/warehouse|gudang|inventory|stock/.test(t)) return 'warehouse';
    if (/procurement|purchasing|sourcing|vendor/.test(t)) return 'procurement';
    return 'supply_chain';
  }

  function isRelevantJob(title) {
    const keywords = /supply chain|logistik|logistics|warehouse|gudang|inventory|procurement|purchasing|fleet|transport|distribusi|distribution|scm|wms|erp|operasional|supervisor|manager/i;
    return keywords.test(title);
  }

  function extractJobsFromJobstreet() {
    const jobs = [];

    // --- Halaman Detail Lowongan Jobstreet ---
    // Selector untuk halaman detail job
    const titleEl = document.querySelector('[data-automation="job-detail-title"], h1.e1wnkr790, .FYwKg');
    const companyEl = document.querySelector('[data-automation="advertiser-name"], .lnsrQ, .y44q7');
    const locationEl = document.querySelector('[data-automation="job-detail-location"], .eJLDcM');
    const descEl = document.querySelector('[data-automation="jobAdDetails"], .job-description, .AUVJM');
    const salaryEl = document.querySelector('[data-automation="job-detail-salary"], .salary-section');

    if (titleEl && companyEl) {
      const title = titleEl.innerText.trim();
      const company = companyEl.innerText.trim();
      const location = locationEl ? locationEl.innerText.trim() : 'Bekasi / Jakarta';
      const fullText = descEl ? descEl.innerText : '';
      const emails = extractEmails(fullText);
      const salary = salaryEl ? salaryEl.innerText.trim() : extractSalaryFromText(fullText);

      if (title.length > 3 && company.length > 2) {
        jobs.push({
          id: 'ext_js_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
          title,
          company,
          location: location.replace(/\n.*/s, '').trim(),
          hrEmail: emails[0] || guessHrEmail(company),
          salary: salary || 'Sesuai pengalaman',
          source: 'Jobstreet Indonesia',
          sourceIcon: '🏢',
          sourceUrl: window.location.href,
          postedTime: 'Terdeteksi dari Jobstreet',
          matchScore: 93,
          category: detectCategory(title),
          required: ['supply chain', 'logistik', 'warehouse'],
          detectedAt: new Date().toISOString(),
          emails
        });
      }
    }

    // --- Halaman Search Results Jobstreet ---
    // Selector untuk daftar lowongan
    const jobCards = document.querySelectorAll('[data-automation="normalJob"], [data-job-id], .job-card, ._1iyq62');
    jobCards.forEach((card, index) => {
      if (index > 15) return;

      const cardTitle = card.querySelector('[data-automation="job-list-item-link-title"], .title, h3, .job-title');
      const cardCompany = card.querySelector('[data-automation="job-card-company-name"], .advertiser, .company-name');
      const cardLocation = card.querySelector('[data-automation="job-card-location"], .location');
      const cardSalary = card.querySelector('[data-automation="job-card-salary"]');
      const cardUrl = card.querySelector('a');

      if (cardTitle && cardCompany) {
        const title = cardTitle.innerText.trim();
        const company = cardCompany.innerText.trim();
        const location = cardLocation ? cardLocation.innerText.trim() : 'Bekasi / Jakarta';
        const salary = cardSalary ? cardSalary.innerText.trim() : 'Sesuai pengalaman';
        const url = cardUrl ? cardUrl.href : window.location.href;

        if (title.length > 3 && company.length > 2 && isRelevantJob(title)) {
          jobs.push({
            id: 'ext_js_' + Date.now() + '_' + index,
            title,
            company,
            location: location.replace(/\n.*/s, '').trim(),
            hrEmail: guessHrEmail(company),
            salary,
            source: 'Jobstreet Indonesia',
            sourceIcon: '🏢',
            sourceUrl: url,
            postedTime: 'Terdeteksi dari Jobstreet Search',
            matchScore: 90,
            category: detectCategory(title),
            required: ['supply chain', 'logistik', 'warehouse'],
            detectedAt: new Date().toISOString(),
            emails: []
          });
        }
      }
    });

    return jobs;
  }

  // Ekstrak salary dari teks deskripsi
  function extractSalaryFromText(text) {
    const match = text.match(/[Rr][Pp][.\s]?\d[\d.,]+[\s]*[-–][\s]*[Rr][Pp][.\s]?\d[\d.,]+/);
    return match ? match[0].trim() : null;
  }

  // Generate educated guess for HR email berdasarkan nama perusahaan
  function guessHrEmail(company) {
    const clean = company
      .toLowerCase()
      .replace(/\bpt\.?\s*/gi, '')
      .replace(/\bpd\.?\s*/gi, '')
      .replace(/tbk\.?/gi, '')
      .replace(/[^a-z0-9\s]/g, '')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .join('');

    if (!clean || clean.length < 3) return '';
    return `recruitment.${clean}@gmail.com`;
  }

  async function saveDetectedJobs(jobs) {
    if (jobs.length === 0) return 0;

    return new Promise((resolve) => {
      chrome.storage.local.get(['detectedJobs'], (result) => {
        const existing = result.detectedJobs || [];
        const existingKeys = new Set(existing.map(j => `${j.title}__${j.company}`));
        const newJobs = jobs.filter(j => !existingKeys.has(`${j.title}__${j.company}`));

        if (newJobs.length > 0) {
          const updated = [...newJobs, ...existing].slice(0, 50);
          chrome.storage.local.set({ detectedJobs: updated }, () => {
            chrome.runtime.sendMessage({ type: 'UPDATE_BADGE', count: updated.length });
            resolve(newJobs.length);
          });
        } else {
          resolve(0);
        }
      });
    });
  }

  function showPageNotification(count) {
    const old = document.getElementById('job-bot-js-notif');
    if (old) old.remove();

    const notif = document.createElement('div');
    notif.id = 'job-bot-js-notif';
    notif.innerHTML = `
      <div style="
        position: fixed; bottom: 24px; right: 24px; z-index: 99999;
        background: linear-gradient(135deg, #f97316, #ea580c);
        color: white; border-radius: 14px; padding: 12px 18px;
        font-family: -apple-system, sans-serif; font-size: 14px;
        box-shadow: 0 8px 32px rgba(249,115,22,0.4);
        display: flex; align-items: center; gap: 10px;
        animation: jsSlideIn 0.3s ease; cursor: pointer;
        border: 1px solid rgba(255,255,255,0.2);
      ">
        <span style="font-size:20px">🏢</span>
        <div>
          <strong>Job Bot</strong> — Jobstreet<br>
          <small>${count} lowongan baru terdeteksi!</small>
        </div>
        <button style="
          margin-left: 8px; background: rgba(255,255,255,0.2);
          border: none; color: white; border-radius: 8px;
          padding: 4px 10px; cursor: pointer; font-size: 12px;
        ">Lihat</button>
      </div>
      <style>
        @keyframes jsSlideIn {
          from { transform: translateX(100px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      </style>
    `;

    notif.querySelector('button').onclick = () => chrome.runtime.sendMessage({ type: 'OPEN_POPUP' });
    notif.onclick = () => setTimeout(() => notif.remove(), 300);
    document.body.appendChild(notif);
    setTimeout(() => { if (notif.parentNode) notif.remove(); }, 8000);
  }

  async function scanPage() {
    await sleep(2500);
    const jobs = extractJobsFromJobstreet();
    if (jobs.length === 0) return;

    const newCount = await saveDetectedJobs(jobs);
    if (newCount > 0) {
      console.log(`[Job Bot] ✅ ${newCount} lowongan baru terdeteksi dari Jobstreet!`);
      showPageNotification(newCount);
    }
  }

  scanPage();

  // Re-scan saat navigasi berubah (SPA)
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      setTimeout(scanPage, 2500);
    }
  }).observe(document, { subtree: true, childList: true });

})();
