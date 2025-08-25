/*!
 * 依賴：window.FreeTop（請先載入 /assets/js/FreeTop.js），Bootstrap
 *
 * 召喚：
 *   <div data-tap-plugin="note" data-variant="warning"></div>  // 自動掛載
 *   // 或手動：
 *   const api = TAPNoteKit.mount('#notePlugin', { variant:'warning' });
 *
 * 模式：由 FreeTop.resolveMode 判定（ADMIN / USER）
 *
 * JSON：
 *   api.getJSON() => { schemaVersion, variant, itemsHTML:[ "<strong>...</strong>", "..." ] }
 *   api.setJSON(data)  // 保留 <strong> 與 <a> 標籤
 */

(function (global) {
  'use strict';

  const t = (s)=> (s==null ? '' : String(s));
  const h = (tag, cls, html)=>{ const el=document.createElement(tag); if(cls) el.className=cls; if(html!=null) el.innerHTML=html; return el; };
  const within = (node, root)=> !!(node && root && (node===root || root.contains(node)));

  function mount(target, opts={}){
    const host = (typeof target==='string') ? document.querySelector(target) : target;
    if (!host) return null;
    if (host._tap_note) return host._tap_note; // 防重複

    const mode    = FreeTop.resolveMode(host, opts, global);                   // 'ADMIN' | 'USER'
    const variant = String(host?.dataset?.variant || opts.variant || 'warning');

    host.innerHTML = '';
    host.classList.add('tap-note');
    host.setAttribute('data-mode', mode);

    // 工具列（僅 ADMIN 顯示）
    const tools = h('div','d-flex flex-wrap align-items-center gap-2 mb-2 note-admin', `
      <div class="btn-group btn-group-sm">
        <button type="button" class="btn btn-outline-secondary note-bold">粗體</button>
        <button type="button" class="btn btn-outline-secondary note-link">連結</button>
        <button type="button" class="btn btn-outline-secondary note-unlink">移除連結</button>
      </div>
      <span class="text-muted">|</span>
      <div class="btn-group btn-group-sm">
        <button type="button" class="btn btn-outline-danger note-add">新增項目</button>
        <button type="button" class="btn btn-outline-secondary note-del">刪除項目</button>
      </div>
    `);

    // 內容區（alert）
    const alertBox = h('div', `alert alert-${variant} mb-4 note-alert`);
    const ul = document.createElement('ul'); ul.className = 'mb-0 ps-3';
    alertBox.appendChild(ul);

    // 初始：不要自動產生項目；預設隱藏黃框（等使用者「新增項目」或 setJSON 注入才顯示）
    alertBox.style.display = 'none';

    if (mode !== 'ADMIN') tools.style.display = 'none';
    host.appendChild(tools);
    host.appendChild(alertBox);

    // 小工具
    function normalizeLinks(scope){
      scope.querySelectorAll('a').forEach(a=>{
        a.target = '_blank';
        const rel = (a.getAttribute('rel')||'').split(/\s+/);
        if (!rel.includes('noopener'))   rel.push('noopener');
        if (!rel.includes('noreferrer')) rel.push('noreferrer');
        a.setAttribute('rel', rel.join(' ').trim());
      });
    }
    function placeCaretEnd(el){
      const r=document.createRange(); r.selectNodeContents(el); r.collapse(false);
      const s=window.getSelection(); s.removeAllRanges(); s.addRange(r);
      el.focus();
    }
    function selectionInUL(){
      const sel = window.getSelection();
      return sel && sel.rangeCount>0 && within(sel.anchorNode, ul);
    }
    function updateVisibility(){
      const hasItems = ul.querySelectorAll('li').length > 0;
      alertBox.style.display = hasItems ? '' : 'none';
    }
    function ensureEditable(){
      if (host.getAttribute('data-mode')==='ADMIN') {
        ul.setAttribute('contenteditable','true');
      } else {
        ul.removeAttribute('contenteditable');
      }
    }

    // 事件（ADMIN）
    host.addEventListener('click', (e)=>{
      if (host.getAttribute('data-mode')!=='ADMIN') return;

      if (e.target.classList.contains('note-bold')){
        if (selectionInUL()) document.execCommand('bold');
        return;
      }
      if (e.target.classList.contains('note-link')){
        if (!selectionInUL()) return;
        let url = prompt('輸入網址（e.g. https://example.com）：', 'https://');
        if (!url) return;
        if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
        document.execCommand('createLink', false, url);
        normalizeLinks(ul);
        return;
      }
      if (e.target.classList.contains('note-unlink')){
        if (selectionInUL()) document.execCommand('unlink');
        return;
      }
      if (e.target.classList.contains('note-add')){
        // 首次新增：顯示 alert 並建立第一個 li
        const li = document.createElement('li');
        li.innerHTML = '新項目';
        ul.appendChild(li);
        ensureEditable();
        normalizeLinks(ul);
        updateVisibility();
        placeCaretEnd(li);
        return;
      }
      if (e.target.classList.contains('note-del')){
        const lis = ul.querySelectorAll('li');
        if (lis.length) lis[lis.length-1].remove();
        updateVisibility();
        return;
      }
    });

    host.addEventListener('input', (e)=>{
      if (within(e.target, ul)) normalizeLinks(ul);
    });

    // 模式切換
    function lockAsUser(scope){
      (scope||host).querySelectorAll('.note-admin').forEach(n=> n.style.display='none');
      ul.removeAttribute('contenteditable');
      host.setAttribute('data-mode','USER');
    }
    function unlockAsAdmin(scope){
      (scope||host).querySelectorAll('.note-admin').forEach(n=> n.style.display='');
      ul.setAttribute('contenteditable','true');
      host.setAttribute('data-mode','ADMIN');
    }
    if (mode==='USER') lockAsUser();

    // 公開 API
    function getJSON(){
      const items = Array.from(ul.querySelectorAll('li'))
        .map(li => li.innerHTML.trim())
        .filter(html => html !== '');
      return { schemaVersion: 1, variant, itemsHTML: items };
    }
    function setJSON(data={}){
      const vv = String(data.variant || variant || 'warning');
      alertBox.className = `alert alert-${vv} mb-4 note-alert`;

      ul.innerHTML='';
      (data.itemsHTML||[]).forEach(html=>{
        const li = document.createElement('li');
        li.innerHTML = t(html);
        ul.appendChild(li);
      });

      normalizeLinks(ul);
      ensureEditable();
      updateVisibility(); // ※ 這行確保「無項目」時整塊黃框消失
    }
    function setMode(next){
      const v = String(next||'USER').toUpperCase()==='ADMIN' ? 'ADMIN' : 'USER';
      if (v==='ADMIN') unlockAsAdmin(); else lockAsUser();
      ensureEditable();
      updateVisibility();
    }

    const api = { getJSON, setJSON, setMode };
    host._tap_note = api;

    return api;
  }

  // 自動掛載
  function autoload(){
    document.querySelectorAll('[data-tap-plugin="note"]').forEach(node=>{
      if (node._tap_note) return;
      const api = mount(node, { variant: node.dataset.variant || 'warning' });
      // 若你有用 FreeTop 的 JSON 注入機制，這行會自動吃：
      if (window.FreeTop && typeof FreeTop.applyInitialJSON === 'function') {
        FreeTop.applyInitialJSON(node, api);
      }
    });
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', autoload);
  else autoload();

  // export
  global.TAPNoteKit = { mount };

})(window);
