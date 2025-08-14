/*!
 * FreeAccordion.js — TAP Qualify Plugin
 * v1.2.0
 * - Subheading inserts above tables/remarks (never below tables)
 * - Delete-accordion / Delete-table aligned right
 * - Remark is always pinned to the bottom
 * - Delete category button
 */

(function (global) {
  'use strict';

  const DEFAULT_FA  = global.TAP_SUBJECTS_FA_CLASS || 'fa-solid';
  const THEME_COLOR = 'var(--main-red)';
  const ICON_SET = [
    '', 'fa-id-card-alt', 'fa-users', 'fa-gavel', 'fa-briefcase', 'fa-stethoscope',
    'fa-flask', 'fa-cog', 'fa-chart-line', 'fa-university', 'fa-user-graduate', 'fa-scale-balanced'
  ];

  let INST = 0;
  const uid = (p='qa') => `${p}-${++INST}-${Math.random().toString(36).slice(2,8)}`;
  const $all = (root, sel)=> Array.from((root instanceof Element?root:document).querySelectorAll(sel));
  const t  = (s)=> (s==null ? '' : String(s));
  const h  = (tag, cls, html)=>{ const el=document.createElement(tag); if(cls) el.className=cls; if(html!=null) el.innerHTML=html; return el; };
  const insertAfter = (newNode, refNode)=> refNode.parentNode.insertBefore(newNode, refNode.nextSibling);

  // ===== Mode resolve (same策略跟 FreeTable 一樣)
  function resolveMode(host, opts, global){
    const explicit = (opts && opts.mode) || (host && host.dataset && host.dataset.mode);
    if (explicit) {
      const v = String(explicit).toUpperCase();
      if (v==='ADMIN' || v==='USER') return v;
    }
    if (typeof global.TAP_DETECT_MODE === 'function') {
      const v = String(global.TAP_DETECT_MODE() || '').toUpperCase();
      if (v==='ADMIN' || v==='USER') return v;
    }
    if (global.XOOPS_IS_ADMIN === true) return 'ADMIN';
    if (typeof global.MODE === 'string') {
      const v = global.MODE.toUpperCase();
      if (v==='ADMIN' || v==='USER') return v;
    }
    if (typeof global.TAP_SUBJECTS_DEFAULT_MODE === 'string') {
      const v = global.TAP_SUBJECTS_DEFAULT_MODE.toUpperCase();
      if (v==='ADMIN' || v==='USER') return v;
    }
    return 'USER';
  }

  // ===== Icon Picker (minimal)
  if (!document.getElementById('qa-iconpicker-style')) {
    const st = document.createElement('style');
    st.id = 'qa-iconpicker-style';
    st.textContent = `
      .qa-ip-wrap{position:relative; display:inline-block;}
      .qa-ip-btn{display:inline-flex; align-items:center; gap:.4rem;}
      .qa-ip-menu{
        position:absolute; z-index:1050; top:100%; left:0;
        background:#fff; border:1px solid #e9ecef; border-radius:10px;
        box-shadow:0 6px 18px rgba(0,0,0,.08); padding:10px; margin-top:6px;
        width:300px; max-height:260px; overflow:auto;
      }
      .qa-ip-grid{display:grid; grid-template-columns:repeat(6,1fr); gap:8px;}
      .qa-ip-item{
        display:flex; justify-content:center; align-items:center;
        width:44px; height:40px; border:1px solid #eee; border-radius:8px;
        cursor:pointer; transition:.15s;
      }
      .qa-ip-item:hover{transform:translateY(-1px); border-color:#ddd;}
      .qa-ip-item.active{border-color:var(--main-red); box-shadow:0 0 0 2px rgba(234,112,102,.15);}
      .qa-ip-none{font-size:12px; color:#6c757d;}
    `;
    document.head.appendChild(st);
  }
  function iconPicker({ faClass=DEFAULT_FA, value='' } = {}){
    const wrap = h('div','qa-ip-wrap');
    const btn  = h('button','btn btn-outline-secondary btn-sm qa-ip-btn');
    btn.type = 'button';
    btn.innerHTML = value
      ? `<i class="${faClass} ${value}" style="color:${THEME_COLOR};"></i><span>更換圖示</span>`
      : `<span class="qa-ip-none">選擇圖示（可不選）</span>`;
    const menu = h('div','qa-ip-menu d-none');
    const grid = h('div','qa-ip-grid');
    ICON_SET.forEach(ic=>{
      const cell = h('div','qa-ip-item'+(ic===value?' active':''), ic ? `<i class="${faClass} ${ic}" style="color:${THEME_COLOR};"></i>` : `<span class="qa-ip-none">無</span>`);
      cell.dataset.icon = ic;
      grid.appendChild(cell);
    });
    menu.appendChild(grid);
    wrap.appendChild(btn); wrap.appendChild(menu);

    const open  = ()=>{ menu.classList.remove('d-none'); document.addEventListener('click', onDoc); };
    const close = ()=>{ menu.classList.add('d-none');   document.removeEventListener('click', onDoc); };
    const onDoc = e => { if (!wrap.contains(e.target)) close(); };

    let current = value || '';
    btn.addEventListener('click', e=>{ e.stopPropagation(); menu.classList.contains('d-none') ? open() : close(); });
    grid.addEventListener('click', e=>{
      const cell = e.target.closest('.qa-ip-item'); if(!cell) return;
      current = cell.dataset.icon || '';
      grid.querySelectorAll('.qa-ip-item').forEach(i=>i.classList.toggle('active', i===cell));
      btn.innerHTML = current
        ? `<i class="${faClass} ${current}" style="color:${THEME_COLOR};"></i><span>更換圖示</span>`
        : `<span class="qa-ip-none">選擇圖示（可不選）</span>`;
      close();
      wrap.dispatchEvent(new CustomEvent('icon:change',{ detail:{ icon: current }}));
    });

    return { root:wrap, get:()=>current, set:(v='')=>{
      current=v||'';
      grid.querySelectorAll('.qa-ip-item').forEach(i=>i.classList.toggle('active', i.dataset.icon===current));
      btn.innerHTML = current
        ? `<i class="${faClass} ${current}" style="color:${THEME_COLOR};"></i><span>更換圖示</span>`
        : `<span class="qa-ip-none">選擇圖示（可不選）</span>`;
    }};
  }

  // ===== Core mount
  function mount(target, opts={}){
    const host = (typeof target==='string') ? document.querySelector(target) : target;
    if (!host) return null;
    if (host._tap_qualify) return host._tap_qualify;

    const mode    = resolveMode(host, opts, global);
    const faClass = host.dataset.fa || opts.faClass || DEFAULT_FA;

    const state = { id: uid('qa'), mode, categories: [] };

    host.innerHTML = '';
    host.classList.add('tap-qualify');
    host.setAttribute('data-mode', state.mode);

    // Admin: add category panel
    let cfg = null;
    if (state.mode === 'ADMIN') {
      cfg = h('div','card mb-3 qa-admin');
      const cid = state.id;
      const ip = iconPicker({ faClass, value:'' });
      cfg.innerHTML = `
        <div class="card-header bg-white border-bottom border-danger fw-bold">新增類別區塊</div>
        <div class="card-body">
          <div class="d-flex flex-wrap align-items-end gap-2">
            <div class="flex-grow-1" style="max-width:360px;">
              <label class="form-label small mb-1">類別標題</label>
              <input type="text" class="form-control form-control-sm" id="${cid}-cat-title" placeholder="例：報考資格 & 類科條件">
            </div>
            <div>
              <label class="form-label small mb-1">圖示</label>
              <div id="${cid}-cat-icon"></div>
            </div>
            <button type="button" class="btn btn-danger btn-sm" id="${cid}-cat-add">插入</button>
          </div>
        </div>`;
      host.appendChild(cfg);
      cfg.querySelector(`#${cid}-cat-icon`).appendChild(ip.root);
      cfg.querySelector(`#${cid}-cat-add`).addEventListener('click', ()=>{
        const title = (cfg.querySelector(`#${cid}-cat-title`).value||'').trim() || '未命名類別';
        const icon  = ip.get() || '';
        addCategory(title, { icon });
        cfg.querySelector(`#${cid}-cat-title`).value = '';
      });
    }

    const catsWrap = h('div','qa-categories');
    host.appendChild(catsWrap);

    function addCategory(title, { icon='' } = {}){
      const catId = uid('cat');
      const accId = uid('acc');

      const card = h('div','mb-3');
      const iconHtml = icon ? `<i class="${faClass} ${icon} me-2" style="color:${THEME_COLOR};"></i>` : '';
      card.innerHTML = `
        <div class="d-flex align-items-center mb-2" style="gap:.5rem;">
          <div class="fw-bold fs-5" style="letter-spacing:1px;">${iconHtml}${t(title)}</div>
          <div class="ms-auto qa-admin">
            <button type="button" class="btn btn-outline-dark btn-sm qa-cat-del">刪除類別</button>
          </div>
        </div>

        <div class="d-flex align-items-end gap-2 mb-2 qa-admin">
          <div class="flex-grow-1" style="max-width:360px;">
            <label class="form-label small mb-1">新增手風琴標題</label>
            <input type="text" class="form-control form-control-sm qa-acc-title" placeholder="例：高等考試三級">
          </div>
          <button type="button" class="btn btn-danger btn-sm qa-acc-add">增加手風琴</button>
        </div>

        <div class="accordion mb-4" id="${accId}"></div>
      `;
      catsWrap.appendChild(card);
      state.categories.push({ id: catId, node: card, title, icon, accId });

      // 增加手風琴
      const addBtn = card.querySelector('.qa-acc-add');
      if (addBtn) addBtn.addEventListener('click', ()=>{
        const titleInput = card.querySelector('.qa-acc-title');
        const ttl = (titleInput.value||'').trim() || '未命名手風琴';
        addAccordion(card, accId, ttl);
        titleInput.value = '';
      });

      // 刪除類別
      const delCatBtn = card.querySelector('.qa-cat-del');
      if (delCatBtn) delCatBtn.addEventListener('click', ()=>{
        const idx = state.categories.findIndex(c => c.node === card);
        if (idx > -1) state.categories.splice(idx,1);
        card.remove();
      });

      if (state.mode==='USER') lockAsUser(card);
      return { id: catId, node: card, accId };
    }

    function addAccordion(catNode, accId, title){
      const acc = catNode.querySelector('#'+CSS.escape(accId));
      const hid = uid('heading');
      const cid = uid('collapse');

      const item = h('div','accordion-item mb-2');
      item.style.border = 'none';
      item.innerHTML = `
        <h2 class="accordion-header" id="${hid}">
          <button class="accordion-button bg-danger text-white fw-bold rounded collapsed px-3 py-2"
            type="button" data-bs-toggle="collapse" data-bs-target="#${cid}"
            aria-expanded="false" aria-controls="${cid}">
            ${t(title)}
          </button>
        </h2>
        <div id="${cid}" class="accordion-collapse collapse"
          aria-labelledby="${hid}" data-bs-parent="#${accId}">
          <div class="accordion-body bg-light pt-2 pb-3 px-2">
            <div class="d-flex flex-wrap align-items-center gap-2 mb-2 qa-admin">
              <div class="d-flex flex-wrap align-items-center gap-2">
                <button type="button" class="btn btn-outline-danger btn-sm qa-insert-sub">插入標題</button>
                <button type="button" class="btn btn-outline-danger btn-sm qa-insert-li">插入項目</button>
                <button type="button" class="btn btn-outline-danger btn-sm qa-insert-table">插入表格(雙欄)</button>
                <button type="button" class="btn btn-outline-secondary btn-sm qa-insert-remark">新增備註</button>
              </div>
              <div class="ms-auto">
                <button type="button" class="btn btn-outline-dark btn-sm qa-acc-del">刪除手風琴</button>
              </div>
            </div>
            <div class="qa-content"></div>
          </div>
        </div>
      `;
      acc.appendChild(item);
      if (state.mode==='USER') lockAsUser(item);
      return { id: cid, node: item };
    }

    // ===== content helpers
    function findContentRoot(accObj){
      const el = (accObj && accObj.node) ? accObj.node : accObj;
      return el.querySelector('.qa-content');
    }
    function ensureRemarkAtBottom(root){
      const r = root.querySelector('.qa-block-remark');
      if (r) root.appendChild(r);
    }
    // 找出「可以放標題」的最後一個錨點（非表格、非備註）
    function findLastNonTableNonRemark(root){
      const blocks = Array.from(root.children);
      for (let i=blocks.length-1; i>=0; i--){
        const b = blocks[i];
        if (!b.classList.contains('qa-block-table') && !b.classList.contains('qa-block-remark')) {
          return b;
        }
      }
      return null;
    }

    function insertSubheading(accObj, text){
      const root = findContentRoot(accObj); if(!root) return null;
      const wrap = h('div','qa-block qa-block-sub mb-2');
      const el = h('div','fw-bold text-danger mb-0 qa-sub');
      el.contentEditable = (state.mode==='ADMIN');
      el.textContent = t(text || '請輸入副標');
      wrap.appendChild(el);

      const anchor = findLastNonTableNonRemark(root);
      if (anchor) insertAfter(wrap, anchor);
      else root.insertBefore(wrap, root.firstChild);

      el.focus();
      ensureRemarkAtBottom(root);
      return wrap;
    }

    // Insert list item under LAST subheading (if exists), else at end (上方標題後面的清單，避免跑到備註下面)
    function insertListItem(accObj, text){
      const root = findContentRoot(accObj); if(!root) return null;
      const subs = $all(root, '.qa-block-sub');
      let targetListWrap = null;

      if (subs.length){
        const lastSub = subs[subs.length-1];
        const nextSibling = lastSub.nextElementSibling;
        if (nextSibling && nextSibling.classList.contains('qa-block-list')) {
          targetListWrap = nextSibling;
        } else {
          targetListWrap = createListWrap();
          insertAfter(targetListWrap, lastSub);
        }
      } else {
        // 若沒有副標，仍放在內容末端，但在備註上方
        const lists = $all(root, '.qa-block-list');
        targetListWrap = lists.length ? lists[lists.length-1] : createListWrap();
        if (!lists.length) {
          const remark = root.querySelector('.qa-block-remark');
          if (remark) root.insertBefore(targetListWrap, remark);
          else root.appendChild(targetListWrap);
        }
      }

      const ul = targetListWrap.querySelector('ul');
      const li = document.createElement('li');
      li.contentEditable = (state.mode==='ADMIN');
      li.textContent = t(text || '請輸入項目');
      ul.appendChild(li);
      li.focus();
      ensureRemarkAtBottom(root);
      return li;

      function createListWrap(){
        const w = h('div','qa-block qa-block-list mb-2');
        const ul = document.createElement('ul'); ul.className = 'mb-2';
        w.appendChild(ul);
        return w;
      }
    }

    function insertTable(accObj, { headLeft='欄1', headRight='欄2', leftWidth=50, rightWidth=50 } = {}){
      const root = findContentRoot(accObj); if(!root) return null;
      const wrap = h('div','qa-block qa-block-table mb-2');
      const tableWrap = h('div','table-responsive qa-table-wrap mb-2');

      const tableId = uid('tbl');
      tableWrap.innerHTML = `
        <div class="d-flex align-items-center gap-2 mb-2 qa-admin">
          <div class="d-flex align-items-center gap-2">
            <span class="small text-muted">欄寬：</span>
            <div class="input-group input-group-sm" style="width:90px;">
              <input type="number" class="form-control qa-w-left" min="10" max="90" step="1" value="${leftWidth}">
              <span class="input-group-text">%</span>
            </div>
            <div class="input-group input-group-sm" style="width:90px;">
              <input type="number" class="form-control qa-w-right" min="10" max="90" step="1" value="${rightWidth}">
              <span class="input-group-text">%</span>
            </div>
            <button type="button" class="btn btn-outline-danger btn-sm qa-tbl-addrow">+ 列</button>
            <button type="button" class="btn btn-outline-secondary btn-sm qa-tbl-delrow">- 列</button>
          </div>
          <div class="ms-auto">
            <button type="button" class="btn btn-outline-dark btn-sm qa-tbl-del">刪除表格</button>
          </div>
        </div>
        <table id="${tableId}" class="table table-bordered align-middle small mb-0">
          <colgroup>
            <col style="width:${leftWidth}%">
            <col style="width:${rightWidth}%">
          </colgroup>
          <thead class="table-danger">
            <tr>
              <th contenteditable="${state.mode==='ADMIN'}">${t(headLeft)}</th>
              <th contenteditable="${state.mode==='ADMIN'}">${t(headRight)}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td contenteditable="${state.mode==='ADMIN'}"></td>
              <td contenteditable="${state.mode==='ADMIN'}"></td>
            </tr>
          </tbody>
        </table>
      `;
      wrap.appendChild(tableWrap);

      // 表格插入位置：如果有備註，放在備註前；否則直接 append
      const remark = root.querySelector('.qa-block-remark');
      if (remark) root.insertBefore(wrap, remark); else root.appendChild(wrap);

      ensureRemarkAtBottom(root);
      return wrap;
    }

    function tableAddRow(tblWrap, row=[ '', '' ]){
      const tbody = tblWrap.querySelector('tbody'); if(!tbody) return;
      const tr = document.createElement('tr');
      row.forEach(v=>{
        const td = document.createElement('td');
        td.contentEditable = (state.mode==='ADMIN');
        td.textContent = t(v || '');
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    }

    function insertRemark(accObj, text){
      const root = findContentRoot(accObj); if(!root) return null;
      let w = root.querySelector('.qa-block-remark');
      if (!w) {
        w = h('div','qa-block qa-block-remark small text-muted mt-2');
        w.innerHTML = `※ <span class="qa-remark-text" ${state.mode==='ADMIN'?'contenteditable="true"':''}></span>`;
        root.appendChild(w);
      }
      const span = w.querySelector('.qa-remark-text');
      span.textContent = t(text || '請輸入備註');
      w.style.display = '';
      ensureRemarkAtBottom(root);
      span.focus();
      return w;
    }

    // ===== Event delegation
    host.addEventListener('input', (e)=>{
      // dynamic remark hide when empty
      if (e.target.classList.contains('qa-remark-text')) {
        const r = e.target.closest('.qa-block-remark');
        const txt = (e.target.textContent||'').trim();
        r.style.display = txt ? '' : 'none';
        // 保持在底部
        const root = e.target.closest('.qa-content');
        if (root) ensureRemarkAtBottom(root);
      }
      // table widths live update
      if (e.target.classList.contains('qa-w-left') || e.target.classList.contains('qa-w-right')) {
        const wrap = e.target.closest('.qa-table-wrap');
        const left = Math.max(10, Math.min(90, Number(wrap.querySelector('.qa-w-left').value||50)));
        const right= Math.max(10, Math.min(90, Number(wrap.querySelector('.qa-w-right').value||50)));
        const cg = wrap.querySelector('colgroup');
        if (cg && cg.children[0] && cg.children[1]) {
          cg.children[0].style.width = left + '%';
          cg.children[1].style.width = right + '%';
        }
      }
    });

    // Delete on Enter if empty (subheading / list item)
    host.addEventListener('keydown', (e)=>{
      if (e.key !== 'Enter') return;
      if (state.mode !== 'ADMIN') return;

      // subheading
      if (e.target.classList.contains('qa-sub')) {
        const txt = (e.target.textContent||'').trim();
        if (!txt) {
          e.preventDefault();
          const wrap = e.target.closest('.qa-block-sub');
          if (wrap) wrap.remove();
        }
      }
      // list item
      if (e.target.tagName === 'LI') {
        const txt = (e.target.textContent||'').trim();
        if (!txt) {
          e.preventDefault();
          const ul = e.target.closest('ul');
          e.target.remove();
          if (ul && !ul.querySelector('li')) {
            const lw = ul.closest('.qa-block-list');
            if (lw) lw.remove();
          }
        }
      }
    });

    // Also delete on blur if empty
    host.addEventListener('blur', (e)=>{
      if (state.mode !== 'ADMIN') return;
      // subheading
      if (e.target.classList && e.target.classList.contains('qa-sub')) {
        const wrap = e.target.closest('.qa-block-sub');
        if (wrap && !e.target.textContent.trim()) wrap.remove();
      }
      // list item
      if (e.target.tagName === 'LI') {
        const ul = e.target.closest('ul');
        if (!e.target.textContent.trim()) {
          e.target.remove();
          if (ul && !ul.querySelector('li')) {
            const lw = ul.closest('.qa-block-list');
            if (lw) lw.remove();
          }
        }
      }
    }, true);

    host.addEventListener('click', (e)=>{
      if (e.target.classList.contains('qa-insert-sub')) {
        const acc = e.target.closest('.accordion-item');
        insertSubheading(acc, '請輸入副標'); return;
      }
      if (e.target.classList.contains('qa-insert-li')) {
        const acc = e.target.closest('.accordion-item');
        insertListItem(acc, '請輸入項目'); return;
      }
      if (e.target.classList.contains('qa-insert-table')) {
        const acc = e.target.closest('.accordion-item');
        insertTable(acc, {}); return;
      }
      if (e.target.classList.contains('qa-insert-remark')) {
        const acc = e.target.closest('.accordion-item');
        insertRemark(acc, '請輸入備註'); return;
      }
      if (e.target.classList.contains('qa-acc-del')) {
        const item = e.target.closest('.accordion-item');
        if (item) item.remove();
        return;
      }

      // table tools
      if (e.target.classList.contains('qa-tbl-addrow')) {
        const w = e.target.closest('.qa-table-wrap'); tableAddRow(w, ['', '']); return;
      }
      if (e.target.classList.contains('qa-tbl-delrow')) {
        const w = e.target.closest('.qa-table-wrap');
        const rows = w.querySelectorAll('tbody tr');
        if (rows.length) rows[rows.length-1].remove();
        return;
      }
      if (e.target.classList.contains('qa-tbl-del')) {
        const wrap = e.target.closest('.qa-block-table');
        if (wrap) {
          const root = wrap.closest('.qa-content');
          wrap.remove();
          if (root) ensureRemarkAtBottom(root);
        }
        return;
      }
    });

    // Lock/Unlock
    function lockAsUser(scope){
      (scope||host).querySelectorAll('.qa-admin').forEach(n=> n.style.display='none');
      (scope||host).querySelectorAll('[contenteditable="true"]').forEach(td=> td.setAttribute('contenteditable','false'));
      host.setAttribute('data-mode','USER');
    }
    function unlockAsAdmin(scope){
      (scope||host).querySelectorAll('.qa-admin').forEach(n=> n.style.display='');
      (scope||host).querySelectorAll('.qa-sub, li, th, td, .qa-remark-text').forEach(el=>{
        if (el.closest('.tap-qualify')) el.setAttribute('contenteditable','true');
      });
      host.setAttribute('data-mode','ADMIN');
    }
    if (state.mode==='USER') lockAsUser();

    // JSON serialize/restore — preserve order
    function getJSON(){
      const categories = state.categories.map(c=>{
        const card = c.node;
        const acc  = card.querySelector('#'+CSS.escape(c.accId));
        const items = [];
        acc.querySelectorAll('.accordion-item').forEach(item=>{
          const title = item.querySelector('.accordion-button')?.textContent.trim() || '';
          const content = item.querySelector('.qa-content');
          const blocks = [];
          Array.from(content.children).forEach(child=>{
            if (child.classList.contains('qa-block-sub')) {
              blocks.push({ type:'subheading', text: (child.querySelector('.qa-sub')?.textContent||'').trim() });
            } else if (child.classList.contains('qa-block-list')) {
              const ul = child.querySelector('ul');
              const arr = ul ? Array.from(ul.querySelectorAll('li')).map(li => (li.textContent||'').trim()) : [];
              blocks.push({ type:'list', items: arr });
            } else if (child.classList.contains('qa-block-table')) {
              const table = child.querySelector('table');
              const colgroup = table.querySelectorAll('colgroup col');
              const left  = parseInt((colgroup[0]?.style.width||'50').replace('%',''))||50;
              const right = parseInt((colgroup[1]?.style.width||'50').replace('%',''))||50;
              const thead = table.querySelectorAll('thead th');
              const headLeft  = (thead[0]?.textContent||'').trim();
              const headRight = (thead[1]?.textContent||'').trim();
              const rows = [];
              table.querySelectorAll('tbody tr').forEach(tr=>{
                const tds = tr.querySelectorAll('td');
                rows.push([ (tds[0]?.textContent||'').trim(), (tds[1]?.textContent||'').trim() ]);
              });
              blocks.push({ type:'table', leftWidth:left, rightWidth:right, headLeft, headRight, rows });
            } else if (child.classList.contains('qa-block-remark')) {
              const txt = (child.querySelector('.qa-remark-text')?.textContent||'').trim();
              blocks.push({ type:'remark', text: txt });
            }
          });
          items.push({ title, blocks });
        });
        return { title:c.title, icon:c.icon, items };
      });
      return { schemaVersion: 2, updatedAt: Date.now(), categories };
    }

    function setJSON(data={}){
      catsWrap.innerHTML = ''; state.categories = [];
      (data.categories||[]).forEach(cat=>{
        const ref = addCategory(cat.title||'未命名類別', { icon: cat.icon||'' });
        (cat.items||[]).forEach(it=>{
          const acc = addAccordion(ref.node, ref.accId, it.title||'未命名手風琴');
          (it.blocks||[]).forEach(b=>{
            if (b.type==='subheading') insertSubheading(acc, b.text||'');
            else if (b.type==='list' && Array.isArray(b.items)) b.items.forEach(x=> insertListItem(acc, x||''));
            else if (b.type==='table') {
              const w = insertTable(acc, {
                headLeft: b.headLeft||'欄1',
                headRight: b.headRight||'欄2',
                leftWidth: b.leftWidth||50,
                rightWidth: b.rightWidth||50
              });
              (b.rows||[]).forEach(r=> tableAddRow(w, r));
            } else if (b.type==='remark') {
              insertRemark(acc, b.text||'');
            }
          });
          // 每個手風琴 restore 完，把備註固定到底
          const root = findContentRoot(acc);
          if (root) ensureRemarkAtBottom(root);
        });
      });
      if (state.mode==='USER') lockAsUser();
    }

    function setMode(next){
      const v = String(next||'USER').toUpperCase()==='ADMIN' ? 'ADMIN' : 'USER';
      state.mode = v;
      if (v==='USER') lockAsUser();
      else unlockAsAdmin();
    }

    function addCategoryPublic(title, opts){ return addCategory(title, opts||{}); }
    function addAccordionPublic(catRef, title){
      const ref = (catRef && catRef.node) ? catRef : state.categories.find(c => c.id===catRef || c.node===catRef);
      if (!ref) return null;
      return addAccordion(ref.node, ref.accId, title);
    }

    const api = {
      addCategory: addCategoryPublic,
      addAccordion: addAccordionPublic,
      insertSubheading,
      insertListItem,
      insertTable,
      tableAddRow,
      insertRemark,
      getJSON,
      setJSON,
      setMode
    };
    host._tap_qualify = api;
    return api;
  }

  function autoload(){
    document.querySelectorAll('[data-tap-plugin="qualify"]').forEach(node=>{
      if (node._tap_qualify) return;
      mount(node, {});
    });
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', autoload);
  else autoload();

  global.TAPQualifyKit = { mount };

})(window);
