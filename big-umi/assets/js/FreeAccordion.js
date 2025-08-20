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

  // ===== 基本工具 =====
  const THEME_COLOR = 'var(--main-red, #ea7066)';
  let INST = 0, ORDER = 0;
  const uid = (p='qa') => `${p}-${++INST}-${Math.random().toString(36).slice(2,8)}`;
  const t = (s)=> (s==null ? '' : String(s));
  const $all = (root, sel)=> Array.from((root instanceof Element?root:document).querySelectorAll(sel));
  const h = (tag, cls, html)=>{ const el=document.createElement(tag); if(cls) el.className=cls; if(html!=null) el.innerHTML=html; return el; };
  const insertAfter = (n, ref)=> ref.parentNode.insertBefore(n, ref.nextSibling);

  // ===== 排版容器：確保存在（修正 appendChild null 問題）=====
  function ensureAccWrap(catCard){
    let wrap = catCard.querySelector('.qa-category-accwrap');
    if (!wrap){
      wrap = h('div','accordion mb-4 qa-category-accwrap');
      const holder = catCard.querySelector('.qa-category-holder') || catCard;
      holder.appendChild(wrap);
    }
    if (!wrap.id) wrap.id = uid('accwrap');
    return wrap;
  }
  function ensureCardWrap(catCard){
    let wrap = catCard.querySelector('.qa-category-cardwrap');
    if (!wrap){
      wrap = h('div','qa-category-cardwrap');
      const holder = catCard.querySelector('.qa-category-holder') || catCard;
      holder.appendChild(wrap);
    }
    return wrap;
  }

  // ===== 內容工具列（灰底，上有按鈕）=====
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

  // ===== 模式 & FA 判定（交給 FreeTop）=====
  const FreeTopFallback = {
    resolveMode: ()=> 'USER',
    getFaClass: ()=> 'fas',
    applyInitialJSON: ()=>{}
  };
  const FT = global.FreeTop || FreeTopFallback;

  // ===== 主掛載 =====
  function mount(target, opts={}){
    const host = (typeof target==='string') ? document.querySelector(target) : target;
    if (!host) return null;
    if (host._free_accordion) return host._free_accordion;

    const mode = FT.resolveMode(host, opts, global);      // 'ADMIN' | 'USER'
    const faClass = FT.getFaClass(host, opts, global);    // 預設 'fas'

    const state = { id: uid('qa'), mode, categories: [] };

    host.innerHTML = '';
    host.classList.add('tap-qualify');
    host.setAttribute('data-mode', state.mode);

    // ===== Admin：新增「類別」與「內容」控制 =====
    if (state.mode === 'ADMIN') {
      const cfg = h('div','card mb-3 qa-admin');
      const cid = state.id;
      cfg.innerHTML = `
        <div class="card-header bg-white border-bottom border-danger fw-bold">新增類別區塊</div>
        <div class="card-body">
          <div class="d-flex flex-wrap align-items-end gap-2 mb-3">
            <div class="flex-grow-1" style="max-width:420px;">
              <label class="form-label small mb-1">類別標題</label>
              <input type="text" class="form-control form-control-sm" id="${cid}-cat-title" placeholder="例：報考資格 & 類科條件">
            </div>
            <button type="button" class="btn btn-danger btn-sm" id="${cid}-cat-add">新增類別</button>
          </div>

          <div class="d-flex align-items-center gap-2 small text-muted">
            <i class="${faClass} fa-info-circle"></i>
            進入每個「類別卡片」內即可插入：「手風琴」或「卡片」內容區塊，並可切換排序模式。
          </div>
        </div>`;
      host.appendChild(cfg);

      cfg.querySelector(`#${cid}-cat-add`).addEventListener('click', ()=>{
        const title = (cfg.querySelector(`#${cid}-cat-title`).value||'').trim() || '未命名類別';
        addCategory(title);
        cfg.querySelector(`#${cid}-cat-title`).value = '';
      });
    }

    // ===== 類別容器 =====
    const catsWrap = h('div','qa-categories');
    host.appendChild(catsWrap);

    // ===== 建立「類別」卡片 =====
    function addCategory(title){
      const card = h('div','card mb-3 qa-category');
      card.setAttribute('data-sort','insert'); // insert | grouped

      // 內容輸入列（插入手風琴 / 卡片）
      const workId = uid('work');
      card.innerHTML = `
        <div class="card-header bg-white border-bottom border-danger fw-bold d-flex align-items-center" style="gap:.5rem;">
          <div class="fs-5">${t(title)}</div>
          <div class="ms-auto qa-admin d-flex flex-wrap align-items-end" style="gap:.5rem;">
            <div class="input-group input-group-sm" style="width: 300px;">
              <input type="text" id="${workId}-title" class="form-control" placeholder="輸入內容標題（手風琴/卡片）">
            </div>
            <button type="button" class="btn btn-danger btn-sm qa-btn-insert-acc" data-work="${workId}">插入手風琴</button>
            <button type="button" class="btn btn-danger btn-sm qa-btn-insert-card" data-work="${workId}">插入卡片</button>
            <div class="vr mx-1"></div>
            <button type="button" class="btn btn-outline-secondary btn-sm qa-btn-toggle-sort">排序：插入順序</button>
            <button type="button" class="btn btn-outline-dark btn-sm qa-cat-del">刪除類別</button>
          </div>
        </div>
        <div class="card-body p-2">
          <div class="qa-category-holder"></div>
        </div>
      `;
      catsWrap.appendChild(card);

      // 先建立兩個 wrap（手風琴容器 / 卡片容器）
      ensureAccWrap(card);
      ensureCardWrap(card);

      // 記錄
      state.categories.push({ node: card, title });

      return card;
    }

    // ===== Block：手風琴 =====
    function createAccordionBlock(catCard, accTitle){
      const accWrap = ensureAccWrap(catCard);
      const hid   = uid('heading');
      const cid   = uid('collapse');

      const item = h('div','accordion-item mb-2 qa-block-holder');
      item.dataset.blockType = 'accordion';
      item.dataset.blockIndex = (++ORDER) + '';

      item.innerHTML = `
        <h2 class="accordion-header" id="${hid}">
          <button class="accordion-button bg-danger text-white fw-bold rounded collapsed px-3 py-2"
            type="button" data-bs-toggle="collapse" data-bs-target="#${cid}"
            aria-expanded="false" aria-controls="${cid}">
            ${t(accTitle || '未命名手風琴')}
          </button>
        </h2>
        <div id="${cid}" class="accordion-collapse collapse"
          aria-labelledby="${hid}" data-bs-parent="#${accWrap.id}">
          <div class="accordion-body bg-light pt-2 pb-3 px-2">
            ${buildToolsBar()}
            <div class="qa-content"></div>
          </div>
        </div>
      `;
      accWrap.appendChild(item);
      return item;
    }

    // ===== Block：卡片（灰底、上方主題線）=====
    function createCardBlock(catCard, cardTitle){
      const listWrap = ensureCardWrap(catCard);

      const card = h('div','card mb-3 shadow-sm qa-block-holder');
      card.dataset.blockType = 'card';
      card.dataset.blockIndex = (++ORDER) + '';

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

    // ===== 內容節點 =====
    function findContentRoot(blockLike){
      const el = (blockLike && blockLike.querySelector) ? blockLike : blockLike.node;
      return el.querySelector('.qa-content');
    }
    function ensureRemarkAtBottom(root){
      const r = root.querySelector('.qa-block-remark');
      if (r) root.appendChild(r);
    }
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

    // ===== 內容：副標 =====
    function insertSubheading(blockRef, text){
      const root = findContentRoot(blockRef); if(!root) return null;
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

    // ===== 內容：清單 =====
    function insertListItem(blockRef, text){
      const root = findContentRoot(blockRef); if(!root) return null;
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

    // ===== 內容：表格（可動態調整）=====
    function insertTable(blockRef, initCols=2){
      const root = findContentRoot(blockRef); if(!root) return null;
      const wrap = h('div','qa-block qa-block-table mb-2');
      const tableWrap = h('div','table-responsive qa-table-wrap mb-2');

      const tableId = uid('tbl');
      const cols = Math.max(1, Number(initCols)||2);

      tableWrap.innerHTML = `
        <div class="d-flex align-items-center gap-2 mb-2 qa-admin">
          <div class="d-flex align-items-center gap-2">
            <button type="button" class="btn btn-outline-danger btn-sm qa-tbl-addrow">+ 列</button>
            <button type="button" class="btn btn-outline-secondary btn-sm qa-tbl-delrow">- 列</button>
            <div class="vr"></div>
            <button type="button" class="btn btn-outline-danger btn-sm qa-tbl-addcol">+ 欄</button>
            <button type="button" class="btn btn-outline-secondary btn-sm qa-tbl-delcol">- 欄</button>
            <button type="button" class="btn btn-outline-secondary btn-sm qa-tbl-fit">平均欄寬</button>
          </div>
          <div class="ms-auto">
            <button type="button" class="btn btn-outline-dark btn-sm qa-tbl-del">刪除表格</button>
          </div>
        </div>
        <table id="${tableId}" class="table table-bordered align-middle small mb-0" data-cols="${cols}">
          <colgroup></colgroup>
          <thead class="table-danger"><tr></tr></thead>
          <tbody></tbody>
        </table>
      `;
      wrap.appendChild(tableWrap);

      // 建表頭/列
      const table = tableWrap.querySelector('table');
      buildHeader(table, cols);
      addRow(table, cols); // 初始一列
      evenColgroup(table);

      // 放置位置：在備註上方
      const remark = root.querySelector('.qa-block-remark');
      if (remark) root.insertBefore(wrap, remark); else root.appendChild(wrap);

      ensureRemarkAtBottom(root);
      return wrap;

      function buildHeader(tbl, n){
        const tr = tbl.querySelector('thead tr'); tr.innerHTML='';
        for (let i=0;i<n;i++){
          const th = document.createElement('th');
          th.contentEditable = (state.mode==='ADMIN');
          th.textContent = i===0 ? '欄1' : `欄${i+1}`;
          tr.appendChild(th);
        }
      }
      function addRow(tbl, n){
        const tbody = tbl.querySelector('tbody');
        const tr = document.createElement('tr');
        for (let i=0;i<n;i++){
          const td = document.createElement('td');
          td.contentEditable = (state.mode==='ADMIN');
          td.setAttribute('data-label', (tbl.querySelectorAll('thead th')[i]?.textContent||''));
          tr.appendChild(td);
        }
        tbody.appendChild(tr);
      }
      function evenColgroup(tbl){
        const cg = tbl.querySelector('colgroup'); cg.innerHTML='';
        const n = Number(tbl.getAttribute('data-cols'))||2;
        const w = Math.floor(100/n);
        for (let i=0;i<n;i++){
          const col = document.createElement('col');
          col.style.width = (i===n-1) ? (100 - w*(n-1)) + '%' : w + '%';
          cg.appendChild(col);
        }
      }
    }

    // ===== 內容：備註 =====
    function insertRemark(blockRef, text){
      const root = findContentRoot(blockRef); if(!root) return null;
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

    // ===== 排序切換（依插入順序 / 分類排列）=====
    function applySort(catCard){
      const holder  = catCard.querySelector('.qa-category-holder');
      const accWrap = ensureAccWrap(catCard);
      const cardWrap= ensureCardWrap(catCard);
      const mode = catCard.getAttribute('data-sort') || 'insert';

      let mixed = catCard.querySelector('.qa-mixed');

      if (mode === 'grouped') {
        // 把混排容器裡的 block 還原回各自的 wrap
        if (mixed) {
          Array.from(mixed.children).forEach(node=>{
            (node.dataset.blockType==='accordion' ? accWrap : cardWrap).appendChild(node);
          });
          mixed.remove();
          mixed = null;
        }
        accWrap.style.display='';
        cardWrap.style.display='';
        holder.innerHTML='';
        holder.appendChild(accWrap);
        holder.appendChild(cardWrap);
        return;
      }

      // 插入順序：用單一 mixed 容器依 order 混排顯示
      accWrap.style.display='none';
      cardWrap.style.display='none';
      if (!mixed) mixed = h('div','qa-mixed');

      const nodes = [...accWrap.children, ...cardWrap.children]
        .sort((a,b)=>(+a.dataset.blockIndex||0)-(+b.dataset.blockIndex||0));

      mixed.innerHTML='';
      nodes.forEach(n=> mixed.appendChild(n));

      holder.innerHTML='';
      holder.appendChild(mixed);
    }

    // ===== 事件（整體委派）=====
    host.addEventListener('click', (e)=>{
      // 取得「類別卡」容器
      const catCard = e.target.closest('.qa-category');

      // a) 插入手風琴 / 卡片
      if (e.target.classList.contains('qa-btn-insert-acc')) {
        if (!catCard) return;
        const wid = e.target.getAttribute('data-work');
        const title = (catCard.querySelector(`#${CSS.escape(wid)}-title`)?.value||'').trim() || '未命名手風琴';
        createAccordionBlock(catCard, title);
        applySort(catCard);
        return;
      }
      if (e.target.classList.contains('qa-btn-insert-card')) {
        if (!catCard) return;
        const wid = e.target.getAttribute('data-work');
        const title = (catCard.querySelector(`#${CSS.escape(wid)}-title`)?.value||'').trim() || '未命名卡片';
        createCardBlock(catCard, title);
        applySort(catCard);
        return;
      }

      // b) 排序切換
      if (e.target.classList.contains('qa-btn-toggle-sort')) {
        if (!catCard) return;
        const cur = catCard.getAttribute('data-sort') || 'insert';
        const next = (cur==='insert') ? 'grouped' : 'insert';
        catCard.setAttribute('data-sort', next);
        e.target.textContent = (next==='insert') ? '排序：插入順序' : '排序：分類排列';
        applySort(catCard);
        return;
      }

      // c) 刪除類別
      if (e.target.classList.contains('qa-cat-del')) {
        const card = e.target.closest('.qa-category');
        if (card) {
          const idx = state.categories.findIndex(c => c.node===card);
          if (idx>-1) state.categories.splice(idx,1);
          card.remove();
        }
        return;
      }

      // d) 內容工具列：插入四種內容 / 刪除此區塊
      if (e.target.classList.contains('qa-insert-sub') ||
          e.target.classList.contains('qa-insert-li')  ||
          e.target.classList.contains('qa-insert-table') ||
          e.target.classList.contains('qa-insert-remark') ||
          e.target.classList.contains('qa-block-del')
      ){
        const block = e.target.closest('.qa-block-holder'); if(!block) return;

        if (e.target.classList.contains('qa-insert-sub')) { insertSubheading(block,'請輸入副標'); return; }
        if (e.target.classList.contains('qa-insert-li')) { insertListItem(block,'請輸入項目'); return; }
        if (e.target.classList.contains('qa-insert-table')) { insertTable(block, 2); return; }
        if (e.target.classList.contains('qa-insert-remark')) { insertRemark(block,'請輸入備註'); return; }
        if (e.target.classList.contains('qa-block-del')) { block.remove(); return; }
      }

      // e) 表格操作（+列/-列、+欄/-欄、平均欄寬、刪除表格）
      if (e.target.classList.contains('qa-tbl-addrow') ||
          e.target.classList.contains('qa-tbl-delrow') ||
          e.target.classList.contains('qa-tbl-addcol') ||
          e.target.classList.contains('qa-tbl-delcol') ||
          e.target.classList.contains('qa-tbl-fit')    ||
          e.target.classList.contains('qa-tbl-del')
      ){
        const w = e.target.closest('.qa-table-wrap'); if(!w) return;
        const tbl = w.querySelector('table'); if(!tbl) return;
        const nCols = ()=> Number(tbl.getAttribute('data-cols'))||2;

        if (e.target.classList.contains('qa-tbl-addrow')) {
          const tr = document.createElement('tr');
          for (let i=0;i<nCols();i++){
            const td = document.createElement('td'); td.contentEditable = (state.mode==='ADMIN');
            td.setAttribute('data-label', (tbl.querySelectorAll('thead th')[i]?.textContent||''));
            tr.appendChild(td);
          }
          tbl.querySelector('tbody').appendChild(tr);
          return;
        }
        if (e.target.classList.contains('qa-tbl-delrow')) {
          const rows = tbl.querySelectorAll('tbody tr');
          if (rows.length) rows[rows.length-1].remove();
          return;
        }
        if (e.target.classList.contains('qa-tbl-addcol')) {
          const cols = nCols()+1; tbl.setAttribute('data-cols', String(cols));
          // header
          const th = document.createElement('th'); th.contentEditable = (state.mode==='ADMIN'); th.textContent = `欄${cols}`;
          tbl.querySelector('thead tr').appendChild(th);
          // rows
          tbl.querySelectorAll('tbody tr').forEach(tr=>{
            const td=document.createElement('td'); td.contentEditable=(state.mode==='ADMIN');
            td.setAttribute('data-label', th.textContent||'');
            tr.appendChild(td);
          });
          // re-fit
          evenCols(tbl);
          return;
        }
        if (e.target.classList.contains('qa-tbl-delcol')) {
          const cols = nCols(); if (cols<=1) return;
          tbl.setAttribute('data-cols', String(cols-1));
          const lastIdx = cols-1;
          const th = tbl.querySelector(`thead th:nth-child(${cols})`); if(th) th.remove();
          tbl.querySelectorAll('tbody tr').forEach(tr=>{
            const td = tr.querySelector(`td:nth-child(${cols})`); if(td) td.remove();
          });
          evenCols(tbl);
          return;
        }
        if (e.target.classList.contains('qa-tbl-fit')) {
          evenCols(tbl); return;
        }
        if (e.target.classList.contains('qa-tbl-del')) {
          const block = w.closest('.qa-block-table'); if(block) block.remove();
          return;
        }

        function evenCols(tbl){
          const cg = tbl.querySelector('colgroup'); cg.innerHTML='';
          const N = nCols();
          const wPer = Math.floor(100/N);
          for (let i=0;i<N;i++){
            const col=document.createElement('col');
            col.style.width = (i===N-1 ? (100 - wPer*(N-1)) : wPer) + '%';
            cg.appendChild(col);
          }
        }
      }
    });

    // ===== 輸入/刪除時的小修飾 =====
    host.addEventListener('input', (e)=>{
      if (e.target.classList.contains('qa-remark-text')) {
        const r = e.target.closest('.qa-block-remark');
        const txt = (e.target.textContent||'').trim();
        r.style.display = txt ? '' : 'none';
        const root = e.target.closest('.qa-content');
        if (root) ensureRemarkAtBottom(root);
      }
      // 更新 table data-label（若有改表頭）
      if (e.target.tagName==='TH' && e.target.closest('.qa-table-wrap')) {
        const w = e.target.closest('.qa-table-wrap');
        const tbl = w.querySelector('table');
        const heads = tbl.querySelectorAll('thead th');
        tbl.querySelectorAll('tbody tr').forEach(tr=>{
          Array.from(tr.children).forEach((td, idx)=>{
            td.setAttribute('data-label', (heads[idx]?.textContent||''));
          });
        });
      }
    });

    host.addEventListener('keydown', (e)=>{
      if (e.key !== 'Enter') return;
      if (state.mode !== 'ADMIN') return;

      if (e.target.classList && e.target.classList.contains('qa-sub')) {
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

    // ===== 鎖/解鎖 =====
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

    // ===== 自動掛載（data-json-* 也可自動吃）=====
    function autoload(){
      // 這支自己 mount 完成；若你要從 data-json-* 載 JSON，可用：
      // FT.applyInitialJSON(host, api); // 目前暫無 get/setJSON 需求
    }

    const api = {
      setMode(next){
        const v = String(next||'USER').toUpperCase()==='ADMIN' ? 'ADMIN' : 'USER';
        state.mode = v;
        if (v==='USER') lockAsUser(); else unlockAsAdmin();
      }
    };

    host._free_accordion = api;
    autoload();
    return api;
  }

  // ===== 自動掃描（保持與舊標記相容：data-tap-plugin="qualify"）=====
  function autoMountAll(){
    document.querySelectorAll('[data-tap-plugin="qualify"]').forEach(node=>{
      if (!node._free_accordion) mount(node, {});
    });
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', autoMountAll);
  else autoMountAll();

  // export
  global.FreeAccordionKit = { mount };

})(window);
