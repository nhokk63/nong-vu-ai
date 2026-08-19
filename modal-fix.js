// Nông Vụ AI v21 modal bridge.
// The app module calls `modal(...)`; this global helper keeps all modal-based
// actions (add plant, consult, update plant, add inventory) alive even when
// the main bundle is cached from an older release.
(function(){
  if (typeof window.modal === 'function') return;

  window.modal = function modal(html){
    const old = document.querySelector('.modal');
    if (old) old.remove();

    const el = document.createElement('div');
    el.className = 'modal';
    el.innerHTML = `
      <div class="sheet" style="position:relative;max-height:88vh;overflow:auto;width:min(720px,100%);background:#fff;border-radius:24px 24px 0 0;padding:22px 18px 28px;box-shadow:0 -18px 46px rgba(0,0,0,.20)">
        <div style="width:46px;height:5px;border-radius:99px;background:#d8d8dc;margin:0 auto 14px"></div>
        <button type="button" data-modal-close aria-label="Đóng" style="position:absolute;right:14px;top:12px;width:38px;height:38px;border:0;border-radius:50%;background:#f1f1f3;font-size:22px;line-height:1">×</button>
        ${html}
      </div>`;

    const close = () => el.remove();
    el.addEventListener('click', (ev) => {
      if (ev.target === el || ev.target.closest('[data-modal-close]')) close();
    });
    document.body.appendChild(el);
    return el;
  };
})();
