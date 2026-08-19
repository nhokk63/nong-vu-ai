(() => {
  'use strict';

  const BOOT_TIMEOUT_MS = 7000;
  const app = () => document.getElementById('app');
  const isBooting = () => !!app()?.querySelector('.boot');
  const originalFetch = window.fetch.bind(window);
  const sw = navigator.serviceWorker;
  const originalRegister = sw?.register?.bind(sw);
  let restored = false;
  let restoreTimer = null;

  const jsonResponse = data => new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });

  const safeLocal = key => {
    try { return JSON.parse(localStorage.getItem(key) || '[]'); }
    catch { return []; }
  };

  const localSnapshot = () => ({
    plants: safeLocal('nv_plants'),
    recs: safeLocal('nv_recs'),
    tasks: safeLocal('nv_tasks'),
    inventory: safeLocal('nv_inventory')
  });

  function showBootError(message) {
    if (!isBooting()) return;
    const host = app();
    host.innerHTML = `
      <div style="min-height:100vh;display:grid;place-items:center;padding:24px;background:#f5f7fb;font-family:system-ui,-apple-system,sans-serif">
        <div style="width:min(520px,100%);background:#fff;border:1px solid #e5e7eb;border-radius:24px;padding:24px;box-shadow:0 16px 50px rgba(0,0,0,.08)">
          <div style="font-size:28px;font-weight:900">Nông Vụ AI</div>
          <div style="margin-top:8px;color:#b42318;font-weight:800">Không thể khởi động</div>
          <div style="margin-top:8px;color:#666;font-size:13px;line-height:1.5;word-break:break-word">${String(message || 'Lỗi không xác định').replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]))}</div>
          <button id="boot-clean" style="margin-top:16px;border:0;border-radius:14px;padding:13px 16px;background:#16815a;color:#fff;font-weight:800">Làm sạch và mở lại</button>
        </div>
      </div>`;
    document.getElementById('boot-clean')?.addEventListener('click', () => {
      location.replace(`./reset.html?return=${encodeURIComponent(location.pathname)}`);
    });
  }

  async function purgeOldWorkers() {
    try {
      const regs = await sw?.getRegistrations?.() || [];
      await Promise.all(regs.map(r => r.unregister().catch(() => false)));
    } catch {}
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k).catch(() => false)));
    } catch {}
  }

  async function restore() {
    if (restored || isBooting()) return;
    restored = true;
    if (restoreTimer) clearInterval(restoreTimer);
    window.fetch = originalFetch;
    if (sw && originalRegister) sw.register = originalRegister;
    if (originalRegister) {
      try { await originalRegister('./sw.js?v=25', { scope: new URL('./', document.baseURI).pathname }); } catch {}
    }
  }

  // During boot, use local data immediately and do not let cloud/SW latency block rendering.
  window.fetch = (input, init = {}) => {
    if (!isBooting()) {
      void restore();
      return originalFetch(input, init);
    }

    const url = typeof input === 'string' ? input : (input?.url || '');

    if (url.includes('/api/data')) return Promise.resolve(jsonResponse(localSnapshot()));
    if (url.includes('/api/automation/status')) return Promise.resolve(jsonResponse({ enabled: false, telegram: false }));
    if (url.includes('/api/')) return Promise.resolve(jsonResponse({}));

    // knowledge.json is optional; app.js already contains a complete fallback.
    if (/\/knowledge\.json(?:\?|$)/.test(url)) return Promise.reject(new Error('Startup knowledge fetch skipped'));

    return originalFetch(input, init);
  };

  if (sw && originalRegister) sw.register = () => Promise.resolve({ unregister: async () => true });

  void purgeOldWorkers();

  window.addEventListener('error', e => {
    if (isBooting()) showBootError(e.error?.message || e.message || 'JavaScript error');
  });
  window.addEventListener('unhandledrejection', e => {
    if (isBooting()) showBootError(e.reason?.message || String(e.reason || 'Promise rejection'));
  });

  restoreTimer = setInterval(() => { void restore(); }, 100);
  setTimeout(() => {
    if (isBooting()) showBootError('Ứng dụng vẫn chưa render sau 7 giây.');
  }, BOOT_TIMEOUT_MS);
})();
