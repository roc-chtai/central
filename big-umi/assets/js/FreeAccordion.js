/*!
 * 召喚：
 *   <div id="qualifyPlugin" data-tap-plugin="qualify"></div>
 *
 * 依賴：
 *   - window.FreeTop（請先載入 /assets/js/FreeTop.js）
 *   - Font Awesome 5（預設 'fas'）
 *
 * 支援：
 *   - data-mode / opts.mode / FreeTop.resolveMode()（含 XOOPS 判定）
 *   - data-fa 指定 FA 前綴（預設 'fas'；也可 'far'、'fab'）
 *   - data-json-var / data-json-script / data-json-local（由 FreeTop.applyInitialJSON 自動注入）
 */

(function (global) {
  'use strict';

  if (!global.FreeTop) {
    console.error('[FreeAccordion] FreeTop.js is required before this plugin.');
    return;
  }

  // ========== 小工具 ==========
  const THEME_COLOR = 'var(--main-red)';
  let INST=0;
  const uid = (p='qa') => `${p}-${++INST}-${Math.random().toString(36).slice(2,8)}`;
  const t   = (s)=> (s==null ? '' : String(s));
  const h   = (tag, cls, html)=>{ const el=document.createElement(tag); if(cls) el.className=cls; if(html!=null) el.innerHTML=html; return el; };
  const $all= (root, sel)=> Array.from((root instanceof Element?root:document).querySelectorAll(sel));
  const insertAfter = (newNode, refNode)=> refNode.parentNode.insertBefore(newNode, refNode.nextSibling);

  // 讓「備註」永遠在內容區塊底部
  function ensureRemarkAtBottom(root){
    const r = root.querySelector('.qa-block-remark');
    if (r) root.appendChild(r);
  }
  // 找「最後一個可放副標的錨點」（非表格、非備註）
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

  // ========== 內容插入（副標 / 清單 / 表格 / 備註）==========
  function insertSubheading(host, text){
    const root = host.querySelector('.qa-content'); if(!root) return null;
    const wrap = h('div','qa-block qa-block-sub mb-2');
    const el = h('div','fw-bold text-danger mb-0 qa-sub', '');
    el.contentEditable = host.closest('[data-mode="ADMIN"]') ? 'true' : 'false';
    el.textContent = t(text || '請輸入副標');
    wrap.appendChild(el);

    const anchor = findLastNonTableNonRemark(root);
    if (anchor) insertAfter(wrap, anchor);
    else root.insertBefore(wrap, root.firstChild);

    el.focus();
    ensureRemarkAtBottom(root);
    return wrap;
  }

  function insertListItem(host, text){
    const root = host.querySelector('.qa-content'); if(!root) return null;
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
    li.contentEditable = host.closest('[data-mode="ADMIN"]') ? 'true' : 'false';
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

  // 可動態調整欄列的表格
  function insertDynamicTable(host, { headers=['欄1','欄2'], rows=[['','']] } = {}){
    const root = host.querySelector('.qa-content'); if(!root) return null;

    const wrap = h('div','qa-block qa-block-table mb-2');
    const tableWrap = h('div','qa-table-wrap mb-2');

    const tblId = uid('tbl');

    // 工具列：增刪列欄
    const adminTools = `
      <div class="d-flex align-items-center gap-2 mb-2 qa-admin">
        <div class="d-flex align-items-center gap-2 flex-wrap">
          <button type="button" class="btn btn-outline-danger btn-sm qa-tbl-addrow">+ 列</button>
          <button type="button" class="btn btn-outline-secondary btn-sm qa-tbl-delrow">- 列</button>
          <span class="vr" style="opacity:.25;"></span>
          <button type="button" class="btn btn-outline-danger btn-sm qa-tbl-addcol">+ 欄</button>
          <button type="button" class="btn btn-outline-secondary btn-sm qa-tbl-delcol">- 欄</button>
          <button type="button" class="btn btn-outline-dark btn-sm qa-tbl-del">刪除表格</button>
        </div>
      </div>
    `;

    tableWrap.innerHTML = `
      ${adminTools}
      <div class="table-responsive">
        <table id="${tblId}" class="table table-bordered align-middle small mb-0 ts-dyn-table">
          <colgroup></colgroup>
          <thead class="table-danger"><tr></tr></thead>
          <tbody></tbody>
        </table>
      </div>
    `;
    wrap.appendChild(tableWrap);

    root.appendChild(wrap);

    const table = tableWrap.querySelector('table');
    rebuildTable(table, headers, rows, host.getAttribute('data-mode')==='ADMIN');

    ensureRemarkAtBottom(root);
    return wrap;
  }

  function rebuildTable(table, headers, rows, isAdmin){
    const thead = table.querySelector('thead tr');
    const tbody = table.querySelector('tbody');
    const cg    = table.querySelector('colgroup');

    thead.innerHTML=''; tbody.innerHTML=''; cg.innerHTML='';

    // 均分欄寬
    const n = Math.max(1, headers.length||0);
    for (let i=0;i<n;i++){
      const col = document.createElement('col');
      col.style.width = (Math.round(100/n)) + '%';
      cg.appendChild(col);
    }

    headers.forEach(hd=>{
      const th = document.createElement('th');
      th.contentEditable = isAdmin ? 'true' : 'false';
      th.textContent = t(hd || '');
      thead.appendChild(th);
    });

    // 至少一列
    const bodyRows = (Array.isArray(rows) && rows.length) ? rows : [ new Array(n).fill('') ];
    bodyRows.forEach(r=>{
      const tr = document.createElement('tr');
      for (let i=0;i<n;i++){
        const td = document.createElement('td');
        td.contentEditable = isAdmin ? 'true' : 'false';
        td.setAttribute('data-label', t(headers[i] || ''));
        td.textContent = t(r?.[i] || '');
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    });
  }

  function insertRemark(host, text){
    const root = host.querySelector('.qa-content'); if(!root) return null;
    let w = root.querySelector('.qa-block-remark');
    const isAdmin = host.getAttribute('data-mode')==='ADMIN';

    if (!w) {
      w = h('div','qa-block qa-block-remark small text-muted mt-2');
      w.innerHTML = `※ <span class="qa-remark-text" ${isAdmin?'contenteditable="true"':''}></span>`;
      root.appendChild(w);
    }
    const span = w.querySelector('.qa-remark-text');
    span.textContent = t(text || '請輸入備註');
    w.style.display = '';
    ensureRemarkAtBottom(root);
    span.focus();
    return w;
  }

  // ========== 類別內「內容區塊」：手風琴 / 卡片 ==========
  function buildToolsBar(){
    return `
      <div class="d-flex flex-wrap align-items-center gap-2 mb-2 qa-admin">
        <div class="d-flex flex-wrap align-items-center gap-2">
          <button type="button" class="btn btn-outline-danger btn-sm qa-insert-sub">插入標題</button>
          <button type="button" class="btn btn-outline-danger btn-sm qa-insert-li">插入項目</button>
          <button type="button" class="btn btn-outline-danger btn-sm qa-insert-table">插入表格</button>
          <button type="button" class="btn btn-outline-secondary btn-sm qa-insert-remark">新增備註</button>
        </div>
        <div class="ms-auto">
          <button type="button" class="btn btn-outline-dark btn-sm qa-block-del">刪除此區塊</button>
        </div>
      </div>
    `;
  }

  // 手風琴（沿用原版樣式）
  function createAccordionBlock(catCard, accTitle){
    const accWrap = catCard.querySelector('.qa-category-accwrap');
    const accId = uid('acc');
    const hid   = uid('heading');
    const cid   = uid('collapse');

    const item = h('div','accordion-item mb-2 qa-block-holder');
    item.dataset.blockType = 'accordion';
    item.innerHTML = `
      <h2 class="accordion-header" id="${hid}">
        <button class="accordion-button bg-danger text-white fw-bold rounded collapsed px-3 py-2"
          type="button" data-bs-toggle="collapse" data-bs-target="#${cid}"
          aria-expanded="false" aria-controls="${cid}">
          ${t(accTitle || '未命名手風琴')}
        </button>
      </h2>
      <div id="${cid}" class="accordion-collapse collapse"
        aria-labelledby="${hid}" data-bs-parent="#${accId}">
        <div class="accordion-body bg-light pt-2 pb-3 px-2">
          ${buildToolsBar()}
          <div class="qa-content"></div>
        </div>
      </div>
    `;

    accWrap.appendChild(item);
    return item;
  }

  // 卡片（年齡限制版型：header 紅線 + 灰底 body）
  function createCardBlock(catCard, cardTitle){
    const listWrap = catCard.querySelector('.qa-category-cardwrap');

    const card = h('div','card mb-3 shadow-sm qa-block-holder');
    card.dataset.blockType = 'card';
    card.innerHTML = `
      <div class="card-header bg-white border-bottom border-danger fw-bold">
        ${t(cardTitle || '未命名卡片')}
      </div>
      <div class="card-body p-0">
        <div class="bg-light pt-2 pb-3 px-2">
          ${buildToolsBar()}
          <div class="qa-content"></div>
        </div>
      </div>
    `;

    listWrap.appendChild(card);
    return card;
  }

  // 依排序模式重排（insert | grouped）
  function applySort(catCard){
    const mode = catCard.getAttribute('data-sort') || 'insert'; // insert | grouped
    const holder = catCard.querySelector('.qa-category-holder');

    // 先清空 holder
    holder.innerHTML = '';

    const accWrap  = catCard.querySelector('.qa-category-accwrap');
    const cardWrap = catCard.querySelector('.qa-category-cardwrap');

    if (mode === 'grouped') {
      // 手風琴在上、卡片在下
      if (accWrap) holder.appendChild(accWrap);
      if (cardWrap) holder.appendChild(cardWrap);
    } else {
      // 插入順序：照 blockIndex 排
      const accBlocks  = Array.from(accWrap.children);
      const cardBlocks = Array.from(cardWrap.children);
      const all = accBlocks.concat(cardBlocks).sort((a,b)=>{
        const ka = Number(a.dataset.blockIndex||0);
        const kb = Number(b.dataset.blockIndex||0);
        return ka - kb;
      });

      const insertOrderedWrap = h('div','qa-insert-ordered');
      all.forEach(node=>{
        if (node.dataset.blockType==='accordion') {
          // 為保持原樣，放到新的 accordion 容器中
          accWrap.appendChild(node);
        } else {
          cardWrap.appendChild(node);
        }
      });
      // 重新附回（accWrap 先、cardWrap 後，但內容是依 index 混排）
      // 做法：把兩個 wrap 里的 children 依 index 交錯插入到 holder
      const mix = accBlocks.concat(cardBlocks).sort((a,b)=>{
        const ka = Number(a.dataset.blockIndex||0);
        const kb = Number(b.dataset.blockIndex||0);
        return ka - kb;
      });
      holder.innerHTML='';
      mix.forEach(node=>{
        if (node.dataset.blockType==='accordion') {
          // 包一層保持樣式
          const shell = catCard.querySelector('.qa-category-accshell') || h('div','qa-category-accshell');
          if (!shell.parentNode) holder.appendChild(shell);
          shell.appendChild(node);
        } else {
          const shell2 = catCard.querySelector('.qa-category-cardshell') || h('div','qa-category-cardshell');
          if (!shell2.parentNode) holder.appendChild(shell2);
          shell2.appendChild(node);
        }
      });
      return; // 已處理
    }

    // grouped 模式時，直接把兩個 wrap 依序掛在 holder
    holder.appendChild(accWrap);
    holder.appendChild(cardWrap);
  }

  // ========== 主掛載 ==========
  function mount(target, opts={}){
    const host = (typeof target==='string') ? document.querySelector(target) : target;
    if (!host) return null;
    if (host._tap_qualify) return host._tap_qualify;

    // Mode / FA 前綴（FA5）
    const mode    = FreeTop.resolveMode(host, opts, global);
    const faClass = FreeTop.getFaClass(host, opts, global); // 預設 'fas'

    const state = { id: uid('qa'), mode, categories: [] };

    host.innerHTML = '';
    host.classList.add('tap-qualify');
    host.setAttribute('data-mode', state.mode);

    // ===== Admin：新增「類別」 =====
    let cfg = null, ip = null;
    if (state.mode === 'ADMIN') {
      cfg = h('div','card mb-3 qa-admin');
      const cid = state.id;

      ip = FreeTop.iconPicker({
        faClass,
        value: '',
        icons: FreeTop.getIconSet(),
        prefix: 'qa',
        themeVar: '--main-red',
        fallback: '#ea7066'
      });

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

    // ===== 類別卡片 =====
    function addCategory(title, { icon='' } = {}){
      const catId = uid('cat');
      const card  = h('div','mb-3 qa-category');
      card.dataset.sort = 'insert'; // insert | grouped
      card.innerHTML = `
        <div class="d-flex align-items-center mb-2" style="gap:.5rem;">
          <div class="fw-bold fs-5" style="letter-spacing:1px;">
            ${icon ? `<i class="${faClass} ${icon} me-2" style="color:${THEME_COLOR};"></i>` : ''}${t(title)}
          </div>
          <div class="ms-auto qa-admin d-flex align-items-center gap-2">
            <button type="button" class="btn btn-outline-secondary btn-sm qa-toggle-sort">切換排序（目前：插入順序）</button>
            <button type="button" class="btn btn-outline-dark btn-sm qa-cat-del">刪除類別</button>
          </div>
        </div>

        <div class="d-flex align-items-end gap-2 mb-2 qa-admin">
          <div class="flex-grow-1" style="max-width:360px;">
            <label class="form-label small mb-1">新增內容區塊標題</label>
            <input type="text" class="form-control form-control-sm qa-block-title" placeholder="例：高等考試三級 / 年齡限制">
          </div>
          <button type="button" class="btn btn-danger btn-sm qa-add-acc">插入手風琴</button>
          <button type="button" class="btn btn-danger btn-sm qa-add-card">插入卡片</button>
        </div>

        <div class="qa-category-holder">
          <!-- 內部有兩個容器，提供 grouped 模式直接上下排列 -->
          <div class="accordion mb-4 qa-category-accwrap"></div>
          <div class="qa-category-cardwrap"></div>
        </div>
      `;
      catsWrap.appendChild(card);

      const catMeta = { id: catId, node: card, title, icon, order:0, blockCount:0 };
      state.categories.push(catMeta);

      // 事件：刪除類別
      const delBtn = card.querySelector('.qa-cat-del');
      if (delBtn) delBtn.addEventListener('click', ()=>{
        const idx = state.categories.findIndex(c => c.node === card);
        if (idx>-1) state.categories.splice(idx,1);
        card.remove();
      });

      // 事件：切換排序
      const sortBtn = card.querySelector('.qa-toggle-sort');
      sortBtn?.addEventListener('click', ()=>{
        const cur = card.getAttribute('data-sort') || 'insert';
        const next = cur==='insert' ? 'grouped' : 'insert';
        card.setAttribute('data-sort', next);
        sortBtn.textContent = `切換排序（目前：${next==='insert'?'插入順序':'手風琴在上'}）`;
        applySort(card);
      });

      // 事件：新增內容區塊
      card.querySelector('.qa-add-acc')?.addEventListener('click', ()=>{
        const titleInput = card.querySelector('.qa-block-title');
        const ttl = (titleInput.value||'').trim() || '未命名手風琴';
        const node = createAccordionBlock(card, ttl);
        node.dataset.blockIndex = (++catMeta.blockCount);
        applySort(card);
        titleInput.value='';
      });
      card.querySelector('.qa-add-card')?.addEventListener('click', ()=>{
        const titleInput = card.querySelector('.qa-block-title');
        const ttl = (titleInput.value||'').trim() || '未命名卡片';
        const node = createCardBlock(card, ttl);
        node.dataset.blockIndex = (++catMeta.blockCount);
        applySort(card);
        titleInput.value='';
      });

      if (state.mode==='USER') lockAsUser(card);
      return catMeta;
    }

    // ===== 內容區塊內事件（委派）=====
    host.addEventListener('click', (e)=>{
      const holder = e.target.closest('.qa-block-holder'); // 手風琴 or 卡片

      // 插入標題
      if (e.target.classList.contains('qa-insert-sub')) {
        if (holder) insertSubheading(holder);
        return;
      }
      // 插入清單項目
      if (e.target.classList.contains('qa-insert-li')) {
        if (holder) insertListItem(holder);
        return;
      }
      // 插入表格（可動態調欄列）
      if (e.target.classList.contains('qa-insert-table')) {
        if (holder) insertDynamicTable(holder, {});
        return;
      }
      // 新增備註
      if (e.target.classList.contains('qa-insert-remark')) {
        if (holder) insertRemark(holder);
        return;
      }
      // 刪除此區塊
      if (e.target.classList.contains('qa-block-del')) {
        const catCard = e.target.closest('.qa-category');
        if (holder && catCard){
          holder.remove();
          applySort(catCard);
        }
        return;
      }

      // 動態表格：增刪列欄 / 刪表
      if (e.target.classList.contains('qa-tbl-addrow')) {
        const wrap = e.target.closest('.qa-table-wrap');
        const table = wrap?.querySelector('table'); if (!table) return;
        const headers = Array.from(table.querySelectorAll('thead th')).map(th=>th.textContent.trim());
        const tbody = table.querySelector('tbody');
        const tr = document.createElement('tr');
        headers.forEach(hd=>{
          const td = document.createElement('td');
          td.contentEditable = (host.getAttribute('data-mode')==='ADMIN') ? 'true' : 'false';
          td.setAttribute('data-label', hd);
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
        return;
      }
      if (e.target.classList.contains('qa-tbl-delrow')) {
        const wrap = e.target.closest('.qa-table-wrap');
        const tbody = wrap?.querySelector('tbody'); if(!tbody) return;
        const rows = tbody.querySelectorAll('tr');
        if (rows.length) rows[rows.length-1].remove();
        return;
      }
      if (e.target.classList.contains('qa-tbl-addcol')) {
        const wrap = e.target.closest('.qa-table-wrap');
        const table = wrap?.querySelector('table'); if (!table) return;
        const headers = Array.from(table.querySelectorAll('thead th')).map(th=>th.textContent.trim());
        headers.push(`欄${headers.length+1}`);
        const rows = Array.from(table.querySelectorAll('tbody tr')).map(tr => Array.from(tr.children).map(td=>td.textContent));
        // 加空白值
        rows.forEach(r => r.push(''));
        rebuildTable(table, headers, rows, host.getAttribute('data-mode')==='ADMIN');
        return;
      }
      if (e.target.classList.contains('qa-tbl-delcol')) {
        const wrap = e.target.closest('.qa-table-wrap');
        const table = wrap?.querySelector('table'); if (!table) return;
        let headers = Array.from(table.querySelectorAll('thead th')).map(th=>th.textContent.trim());
        if (headers.length<=1) return;
        headers = headers.slice(0, headers.length-1);
        const rows = Array.from(table.querySelectorAll('tbody tr')).map(tr => Array.from(tr.children).map(td=>td.textContent));
        rows.forEach(r => r.splice(r.length-1,1));
        rebuildTable(table, headers, rows, host.getAttribute('data-mode')==='ADMIN');
        return;
      }
      if (e.target.classList.contains('qa-tbl-del')) {
        const w = e.target.closest('.qa-block-table');
        if (w) {
          const contentRoot = w.closest('.qa-content');
          w.remove();
          if (contentRoot) ensureRemarkAtBottom(contentRoot);
        }
        return;
      }
    });

    // 內容可編輯的清除空白節點（Enter/Blur）
    host.addEventListener('keydown', (e)=>{
      if (e.key !== 'Enter') return;
      if (state.mode !== 'ADMIN') return;
      if (e.target.classList.contains('qa-sub')) {
        const txt = (e.target.textContent||'').trim();
        if (!txt) {
          e.preventDefault();
          const wrap = e.target.closest('.qa-block-sub');
          if (wrap) wrap.remove();
        }
      }
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
    host.addEventListener('blur', (e)=>{
      if (state.mode !== 'ADMIN') return;
      if (e.target.classList && e.target.classList.contains('qa-sub')) {
        const wrap = e.target.closest('.qa-block-sub');
        if (wrap && !e.target.textContent.trim()) wrap.remove();
      }
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

    // ===== 模式切換 =====
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

    // ===== JSON =====
    function serializeBlock(holder){
      // 取標題（手風琴按鈕 或 卡片 header）
      let title = '';
      if (holder.dataset.blockType==='accordion') {
        title = holder.querySelector('.accordion-button')?.textContent.trim() || '';
      } else {
        title = holder.querySelector('.card-header')?.textContent.trim() || '';
      }
      const root = holder.querySelector('.qa-content');
      const blocks = [];
      Array.from(root.children).forEach(child=>{
        if (child.classList.contains('qa-block-sub')) {
          blocks.push({ type:'subheading', text: (child.querySelector('.qa-sub')?.textContent||'').trim() });
        } else if (child.classList.contains('qa-block-list')) {
          const ul = child.querySelector('ul');
          const arr = ul ? Array.from(ul.querySelectorAll('li')).map(li => (li.textContent||'').trim()) : [];
          blocks.push({ type:'list', items: arr });
        } else if (child.classList.contains('qa-block-table')) {
          const table = child.querySelector('table');
          const headers = Array.from(table.querySelectorAll('thead th')).map(th=>th.textContent.trim());
          const rows = Array.from(table.querySelectorAll('tbody tr')).map(tr => Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim()));
          blocks.push({ type:'table', headers, rows });
        } else if (child.classList.contains('qa-block-remark')) {
          const txt = (child.querySelector('.qa-remark-text')?.textContent||'').trim();
          blocks.push({ type:'remark', text: txt });
        }
      });
      return { kind: holder.dataset.blockType, title, blocks, order: Number(holder.dataset.blockIndex||0) };
    }

    function getJSON(){
      const categories = state.categories.map(c=>{
        const node = c.node;
        const blocks = [];
        // 兩種容器內的 block
        node.querySelectorAll('.qa-block-holder').forEach(b => blocks.push(serializeBlock(b)));
        return { title:c.title, icon:c.icon, sortMode: node.getAttribute('data-sort') || 'insert', blocks: blocks.sort((a,b)=> a.order-b.order) };
      });
      return { schemaVersion: 1, updatedAt: Date.now(), categories };
    }

    function setJSON(data={}){
      catsWrap.innerHTML=''; state.categories=[];
      (data.categories||[]).forEach(cat=>{
        const ref = addCategory(cat.title||'未命名類別', { icon: cat.icon||'' });
        const card = ref.node;
        // 設定排序模式
        if (cat.sortMode) {
          card.setAttribute('data-sort', cat.sortMode);
          const btn = card.querySelector('.qa-toggle-sort');
          if (btn) btn.textContent = `切換排序（目前：${cat.sortMode==='insert'?'插入順序':'手風琴在上'}）`;
        }
        // 插入 blocks
        let idx = 0;
        (cat.blocks||[]).forEach(b=>{
          let holder = null;
          if (b.kind==='accordion') holder = createAccordionBlock(card, b.title||'');
          else if (b.kind==='card') holder = createCardBlock(card, b.title||'');
          if (!holder) return;

          holder.dataset.blockIndex = (++idx);
          const root = holder.querySelector('.qa-content');

          (b.blocks||[]).forEach(x=>{
            if (x.type==='subheading') insertSubheading(holder, x.text||'');
            else if (x.type==='list' && Array.isArray(x.items)) x.items.forEach(it=> insertListItem(holder, it||''));
            else if (x.type==='table') insertDynamicTable(holder, { headers: x.headers||['欄1','欄2'], rows: x.rows||[['','']] });
            else if (x.type==='remark') insertRemark(holder, x.text||'');
          });

          ensureRemarkAtBottom(root);
        });
        applySort(card);
      });

      if (state.mode==='USER') lockAsUser();
    }

    function setMode(next){
      const v = String(next||'USER').toUpperCase()==='ADMIN' ? 'ADMIN' : 'USER';
      state.mode = v;
      if (v==='USER') lockAsUser();
      else unlockAsAdmin();
    }

    const api = { setMode, getJSON, setJSON, addCategory };
    host._tap_qualify = api;
    return api;
  }

  // ========== 自動掛載 + 前台自動吃資料 ==========
  function autoload(){
    document.querySelectorAll('[data-tap-plugin="qualify"]').forEach(node=>{
      if (node._tap_qualify) return;
      const api = mount(node, {});
      FreeTop.applyInitialJSON(node, api);
    });
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', autoload);
  else autoload();

  // export
  global.TAPQualifyKit = { mount };

})(window);
