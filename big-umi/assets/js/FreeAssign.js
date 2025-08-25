/*!
 * FreeAssign.js — 「分發工作」專用插件
 * 召喚：
 *   <div id="WorkPlugin" data-tap-plugin="assign" data-anchor-list="#sidebarAccordion .category-list"></div>
 *
 * 依賴：
 *   - window.FreeTop（請先載入 /assets/js/FreeTop.js）
 *   - 已引入 Accordion.css（共用 .qa-pane/.qa-content/.qa-block-*）
 *   - 已引入 FreeTable.css（共用 .qa-table RWD）
 *
 * 說明：
 *   - 只有「類別」與「卡片」，不含手風琴
 *   - 類別會同步到側欄（依 data-anchor-list 指到的 UL），用 <a href="#錨點">類別名稱</a>
 *   - 表格完全沿用 FreeAccordion 的動態欄列/欄寬功能與 .qa-table RWD 樣式
 */

(function (global) {
  'use strict';

  // ===== 小工具 =====
  let INST = 0;
  const uid = (p='as') => `${p}-${++INST}-${Math.random().toString(36).slice(2,8)}`;
  const t   = (s)=> (s==null ? '' : String(s));
  const h   = (tag, cls, html)=>{ const el=document.createElement(tag); if(cls) el.className=cls; if(html!=null) el.innerHTML=html; return el; };
  const insertAfter = (n, ref)=> ref.parentNode.insertBefore(n, ref.nextSibling);

  // ===== 共用灰底面板（工具列 + 內容容器） =====
  function buildPane(isAdmin){
    const pane  = h('div','qa-pane bg-light pt-2 pb-3 px-2');
    const tools = h('div','d-flex flex-wrap align-items-center gap-2 mb-2 qa-admin', `
      <div class="d-flex flex-wrap align-items-center gap-2">
        <button type="button" class="btn btn-outline-danger btn-sm qa-insert-sub">插入標題</button>
        <button type="button" class="btn btn-outline-danger btn-sm qa-insert-li">插入項目</button>
        <button type="button" class="btn btn-outline-danger btn-sm qa-insert-table">插入表格</button>
        <button type="button" class="btn btn-outline-secondary btn-sm qa-insert-remark">新增備註</button>
      </div>
      <div class="ms-auto">
        <button type="button" class="btn btn-outline-dark btn-sm qa-entry-del">刪除此區塊</button>
      </div>
    `);
    const body  = h('div','qa-content');
    pane.appendChild(tools); pane.appendChild(body);
    if (!isAdmin) tools.style.display='none';
    return pane;
  }

  // ===== 內容插入小工具 =====
  const findContentRoot = (entry)=>{
    const el = entry && entry.nodeType ? entry : (entry && entry.node);
    return (el || entry).querySelector('.qa-content');
  };
  const ensureRemarkAtBottom = (root)=>{
    const r = root.querySelector('.qa-block-remark');
    if (r) root.appendChild(r);
  };
  const findLastNonTableNonRemark = (root)=>{
    const blocks = Array.from(root.children);
    for (let i=blocks.length-1; i>=0; i--){
      const b = blocks[i];
      if (!b.classList.contains('qa-block-tableflex') && !b.classList.contains('qa-block-remark')) return b;
    }
    return null;
  };

  function insertSubheading(entry, text, admin){
    const root = findContentRoot(entry); if(!root) return null;
    const wrap = h('div','qa-block qa-block-sub mb-2');
    const el   = h('div','fw-bold text-danger mb-0 qa-sub');
    el.contentEditable = admin;
    el.textContent = t(text || '請輸入副標');
    wrap.appendChild(el);
    const anchor = findLastNonTableNonRemark(root);
    if (anchor) insertAfter(wrap, anchor); else root.insertBefore(wrap, root.firstChild);
    el.focus(); ensureRemarkAtBottom(root); return wrap;
  }
  function insertListItem(entry, text, admin){
    const root = findContentRoot(entry); if(!root) return null;
    const subs = Array.from(root.querySelectorAll('.qa-block-sub'));
    let targetListWrap = null;

    if (subs.length){
      const lastSub = subs[subs.length-1];
      const nextSibling = lastSub.nextElementSibling;
      if (nextSibling && nextSibling.classList.contains('qa-block-list')) {
        targetListWrap = nextSibling;
      } else {
        targetListWrap = createListWrap(); insertAfter(targetListWrap, lastSub);
      }
    } else {
      const lists = Array.from(root.querySelectorAll('.qa-block-list'));
      targetListWrap = lists.length ? lists[lists.length-1] : createListWrap();
      if (!lists.length) {
        const remark = root.querySelector('.qa-block-remark');
        if (remark) root.insertBefore(targetListWrap, remark); else root.appendChild(targetListWrap);
      }
    }

    const ul = targetListWrap.querySelector('ul');
    const li = document.createElement('li');
    li.contentEditable = admin; li.textContent = t(text || '請輸入項目');
    ul.appendChild(li); li.focus(); ensureRemarkAtBottom(root); return li;

    function createListWrap(){ const w=h('div','qa-block qa-block-list mb-2'); const ul=document.createElement('ul'); ul.className='mb-2'; w.appendChild(ul); return w; }
  }
  function insertRemark(entry, text, admin){
    const root = findContentRoot(entry); if(!root) return null;
    let w = root.querySelector('.qa-block-remark');
    if (!w) { w = h('div','qa-block qa-block-remark small text-muted mt-2'); w.innerHTML = `※ <span class="qa-remark-text" ${admin?'contenteditable="true"':''}></span>`; root.appendChild(w); }
    const span = w.querySelector('.qa-remark-text'); span.textContent = t(text || '請輸入備註');
    w.style.display=''; ensureRemarkAtBottom(root); span.focus(); return w;
  }

  // ===== 動態表格（沿用 FreeTable.css 的 .qa-table） =====
  function insertTableFlex(entry, admin, colCount=2){
    const root = findContentRoot(entry); if(!root) return null;
    const wrap = h('div','qa-block qa-block-tableflex mb-2');

    const header = h('div','d-flex align-items-center gap-2 mb-2 qa-admin', `
      <div class="d-flex align-items-center gap-2">
        <button type="button" class="btn btn-outline-danger btn-sm qa-tflex-addrow">+ 列</button>
        <button type="button" class="btn btn-outline-secondary btn-sm qa-tflex-delrow">- 列</button>
        <span class="mx-1 text-muted">|</span>
        <button type="button" class="btn btn-outline-danger btn-sm qa-tflex-addcol">+ 欄</button>
        <button type="button" class="btn btn-outline-secondary btn-sm qa-tflex-delcol">- 欄</button>
        <span class="mx-1 text-muted">|</span>
        <button type="button" class="btn btn-outline-secondary btn-sm qa-tflex-widths">欄寬</button>
        <button type="button" class="btn btn-outline-secondary btn-sm qa-tflex-even">平均</button>
      </div>
      <div class="ms-auto">
        <button type="button" class="btn btn-outline-dark btn-sm qa-tflex-del">刪除表格</button>
      </div>
    `);

    const widthsPanel = h('div','qa-tflex-widths-panel d-none mb-2');

    const table = document.createElement('table');
    table.className = 'table table-bordered align-middle small mb-0 qa-table'; // 讓 FreeTable.css 接手 RWD
    const cg    = document.createElement('colgroup');
    const thead = document.createElement('thead'); thead.className = 'table-danger';
    const tbody = document.createElement('tbody');
    const trHead= document.createElement('tr');

    colCount = Math.max(1, Number(colCount)||2);
    for (let i=0;i<colCount;i++){
      const col = document.createElement('col'); cg.appendChild(col);
      const th  = document.createElement('th'); th.contentEditable = admin; th.textContent = `欄${i+1}`;
      trHead.appendChild(th);
    }
    thead.appendChild(trHead);

    const tr = document.createElement('tr');
    for (let i=0;i<colCount;i++){
      const td = document.createElement('td');
      td.contentEditable = admin; td.setAttribute('data-label', `欄${i+1}`); tr.appendChild(td);
    }
    tbody.appendChild(tr);

    table.appendChild(cg); table.appendChild(thead); table.appendChild(tbody);
    wrap.appendChild(header); wrap.appendChild(widthsPanel); wrap.appendChild(table);

    rebalanceFlexTable(table); buildWidthsPanel(widthsPanel, table, admin);

    const remark = root.querySelector('.qa-block-remark');
    if (remark) root.insertBefore(wrap, remark); else root.appendChild(wrap);
    ensureRemarkAtBottom(root);
    return wrap;
  }
  function rebalanceFlexTable(table){
    const cg = table.querySelector('colgroup'); if (!cg) return;
    const n = cg.children.length || 1;
    const w = Math.floor(100/n);
    Array.from(cg.children).forEach((c, idx)=> c.style.width = (idx===n-1 ? (100-(w*(n-1))) : w) + '%');
  }
  function syncTDLabels(table){
    const heads = Array.from(table.querySelectorAll('thead th')).map(th=> th.textContent.trim());
    table.querySelectorAll('tbody tr').forEach(tr=>{
      Array.from(tr.children).forEach((td,i)=> td.setAttribute('data-label', heads[i] || `欄${i+1}`));
    });
  }
  function colWidths(table){
    const cg = table.querySelector('colgroup');
    const widths = Array.from(cg.children).map(col=>{
      const v = (col.style.width||'').replace('%','').trim();
      return v ? Math.max(1, Math.min(100, Number(v))) : null;
    });
    const n = widths.length; const avg = Math.floor(100/n);
    return widths.map((v,i)=> v==null ? (i===n-1 ? (100-(avg*(n-1))) : avg) : v);
  }
  function setColWidths(table, arr){
    const cg = table.querySelector('colgroup'); if (!cg) return;
    const n = cg.children.length;
    const nums = new Array(n).fill(0).map((_,i)=> Math.max(1, Math.min(100, Number(arr?.[i]||0))));
    Array.from(cg.children).forEach((c,i)=> c.style.width = (nums[i]||0)+'%');
  }
  function buildWidthsPanel(holder, table, admin){
    holder.innerHTML = '';
    const w = colWidths(table);
    const row = h('div','d-flex flex-wrap align-items-center gap-2');
    w.forEach((val,i)=>{
      const box = h('div','input-group input-group-sm', `
        <span class="input-group-text">${i+1}</span>
        <input type="number" class="form-control qa-tflex-w" data-idx="${i}" min="5" max="100" step="1" value="${val}">
        <span class="input-group-text">%</span>
      `);
      row.appendChild(box);
    });
    holder.appendChild(row);
    if (!admin) holder.style.display='none';
  }

  // ===== 主掛載 =====
  function mount(target, opts={}){
    const host = (typeof target==='string') ? document.querySelector(target) : target;
    if (!host) return null;
    if (host._tap_assign) return host._tap_assign;

    // 讓現有的 Accordion.css 能吃到樣式（沿用 .tap-qualify 選擇器）
    host.classList.add('tap-qualify'); // 共用既有 CSS
    host.classList.add('tap-assign');  // 自己的標記

    const mode     = FreeTop.resolveMode(host, opts, global);  // 'ADMIN' | 'USER'
    const faClass  = FreeTop.getFaClass(host, opts, global);
    const anchorUL = (host.getAttribute('data-anchor-list')||opts.anchorList||'').trim();
    const anchorBox= anchorUL ? document.querySelector(anchorUL) : null;

    const state = { id: uid('assign'), mode, categories: [], orderSeq: 0, anchorBox };

    host.innerHTML = '';
    host.setAttribute('data-mode', state.mode);

    // ===== 新增類別（上方）=====
    let cfg = null;
    if (state.mode === 'ADMIN') {
      cfg = h('div','card mb-3 qa-admin');
      const cid = state.id;

      cfg.innerHTML = `
        <div class="card-header bg-white border-bottom border-danger fw-bold">新增類別區塊</div>
        <div class="card-body">
          <div class="d-flex flex-wrap align-items-end gap-2">
            <div class="flex-grow-1" style="max-width:360px;">
              <label class="form-label small mb-1">類別標題</label>
              <input type="text" class="form-control form-control-sm" id="${cid}-cat-title" placeholder="例：行政 / 分發單位">
            </div>
            <button type="button" class="btn btn-danger btn-sm" id="${cid}-cat-add">插入</button>
          </div>
          ${!anchorBox? `<div class="text-muted small mt-2">（未設定 data-anchor-list，將不會同步到側欄）</div>`:''}
        </div>`;
      host.appendChild(cfg);

      cfg.querySelector(`#${cid}-cat-add`).addEventListener('click', ()=>{
        const title = (cfg.querySelector(`#${cid}-cat-title`).value||'').trim() || '未命名類別';
        addCategory(title);
        cfg.querySelector(`#${cid}-cat-title`).value = '';
      });
    }

    const catsWrap = h('div','as-categories'); host.appendChild(catsWrap);

    // ===== 類別卡片 =====
    function addCategory(title){
      const catId = uid('cat');
      const card  = h('div','mb-3 as-category');
      const anchorId = uid('work'); // 避免與別處衝突，固定唯一

      card.innerHTML = `
        <div id="${anchorId}" class="d-flex align-items-center mb-2" style="gap:.5rem;">
          <div class="fw-bold fs-5 qa-cat-title" ${state.mode==='ADMIN'?'contenteditable="true"':''} style="letter-spacing:1px;">${t(title)}</div>
          <div class="ms-auto qa-admin d-flex gap-2">
            <button type="button" class="btn btn-outline-dark btn-sm qa-cat-del">刪除類別</button>
          </div>
        </div>

        <!-- 新增內容區塊（只保留卡片） -->
        <div class="d-flex align-items-end gap-2 mb-2 qa-admin">
          <div class="flex-grow-1" style="max-width:360px;">
            <label class="form-label small mb-1">新增內容標題</label>
            <input type="text" class="form-control form-control-sm qa-entry-title" placeholder="例：分發單位 / 工作內容">
          </div>
          <button type="button" class="btn btn-danger btn-sm qa-add-card">插入卡片</button>
        </div>

        <!-- 卡片列表 -->
        <div class="qa-entries"></div>
      `;
      catsWrap.appendChild(card);

      const cat = { id: catId, node: card, title, anchorId, entries: [] };
      state.categories.push(cat);

      // 側欄同步
      addToSidebar(cat);

      // 刪除類別
      card.querySelector('.qa-cat-del').addEventListener('click', ()=>{
        removeFromSidebar(cat);
        const idx = state.categories.findIndex(c=>c.node===card);
        if (idx>-1) state.categories.splice(idx,1);
        card.remove();
      });

      if (state.mode==='USER') lockAsUser(card);
      return cat;
    }

    // ===== 新增卡片 =====
    function addCard(catNode, title){
      const entries = catNode.querySelector('.qa-entries');
      const entry   = h('div','qa-entry qa-entry-card mb-3');
      entry.dataset.order = (++state.orderSeq).toString();

      entry.innerHTML = `
        <div class="card">
          <div class="card-header bg-white border-bottom border-danger fw-bold">
            <span class="qa-card-head" ${state.mode==='ADMIN'?'contenteditable="true"':''}>${t(title || '請輸入卡片標題')}</span>
          </div>
          <div class="card-body">
            ${buildPane(state.mode==='ADMIN').outerHTML}
          </div>
        </div>
      `;
      entries.appendChild(entry);
      if (state.mode==='USER') lockAsUser(entry);
      return entry;
    }

    // ===== 側欄錨點同步 =====
    function addToSidebar(cat){
      if (!state.anchorBox) return;
      const li  = document.createElement('li');
      li.className = 'list-group-item';
      li.dataset.assign = state.id; // 標記本插件實例
      li.dataset.cat    = cat.id;
      li.innerHTML = `<a href="#${cat.anchorId}">${t(cat.title)}</a>`;
      state.anchorBox.appendChild(li);
      cat._sideItem = li;

      // 類別標題改變時，同步文字
      const titleEl = cat.node.querySelector('.qa-cat-title');
      titleEl?.addEventListener('input', ()=>{
        const txt = (titleEl.textContent||'').trim() || '未命名類別';
        cat.title = txt;
        if (cat._sideItem) {
          const a = cat._sideItem.querySelector('a'); if (a) a.textContent = txt;
        }
      });
    }
    function removeFromSidebar(cat){
      if (cat?._sideItem) { cat._sideItem.remove(); cat._sideItem = null; }
    }
    function clearMySidebarItems(){
      if (!state.anchorBox) return;
      Array.from(state.anchorBox.querySelectorAll('li[data-assign="'+state.id+'"]')).forEach(li=> li.remove());
    }

    // ===== 事件委派 =====
    host.addEventListener('click', (e)=>{
      // 類別新增卡片
      if (e.target.classList.contains('qa-add-card')){
        const cat = e.target.closest('.as-category');
        const titleInput = cat.querySelector('.qa-entry-title');
        const val = (titleInput.value||'').trim();
        addCard(cat, val || '請輸入卡片標題');
        titleInput.value = '';
        return;
      }

      // 刪除卡片（灰面板右側刪除鈕）
      if (e.target.classList.contains('qa-entry-del')){
        const entry = e.target.closest('.qa-entry'); if (entry) entry.remove(); return;
      }

      // 插入：標題/項目/表格/備註
      if (e.target.classList.contains('qa-insert-sub') ||
          e.target.classList.contains('qa-insert-li')  ||
          e.target.classList.contains('qa-insert-table') ||
          e.target.classList.contains('qa-insert-remark')){
        const entry = e.target.closest('.qa-entry');
        if (e.target.classList.contains('qa-insert-sub'))   { insertSubheading(entry, '請輸入副標', state.mode==='ADMIN'); return; }
        if (e.target.classList.contains('qa-insert-li'))    { insertListItem(entry, '請輸入項目', state.mode==='ADMIN'); return; }
        if (e.target.classList.contains('qa-insert-table')) { insertTableFlex(entry, state.mode==='ADMIN', 2); return; }
        if (e.target.classList.contains('qa-insert-remark')){ insertRemark(entry, '請輸入備註', state.mode==='ADMIN'); return; }
      }

      // 動態表格：操作
      if (e.target.classList.contains('qa-tflex-addrow') ||
          e.target.classList.contains('qa-tflex-delrow') ||
          e.target.classList.contains('qa-tflex-addcol') ||
          e.target.classList.contains('qa-tflex-delcol') ||
          e.target.classList.contains('qa-tflex-del')    ||
          e.target.classList.contains('qa-tflex-widths') ||
          e.target.classList.contains('qa-tflex-even')){
        const wrap  = e.target.closest('.qa-block-tableflex'); if (!wrap) return;
        const table = wrap.querySelector('table'); if (!table) return;
        const thead = table.querySelector('thead');
        const tbody = table.querySelector('tbody');
        const cg    = table.querySelector('colgroup');
        const panel = wrap.querySelector('.qa-tflex-widths-panel');

        if (e.target.classList.contains('qa-tflex-addrow')){
          const heads = Array.from(thead.querySelectorAll('th')).map(th=> th.textContent.trim());
          const tr = document.createElement('tr');
          for (let i=0;i<heads.length;i++){ const td=document.createElement('td'); td.contentEditable = (state.mode==='ADMIN'); td.setAttribute('data-label', heads[i]||`欄${i+1}`); tr.appendChild(td); }
          tbody.appendChild(tr);
        }
        if (e.target.classList.contains('qa-tflex-delrow')){
          const rows = tbody.querySelectorAll('tr'); if (rows.length) rows[rows.length-1].remove();
        }
        if (e.target.classList.contains('qa-tflex-addcol')){
          const idx = thead.querySelectorAll('th').length;
          const col = document.createElement('col'); cg.appendChild(col);
          const th  = document.createElement('th'); th.contentEditable = (state.mode==='ADMIN'); th.textContent = `欄${idx+1}`; thead.querySelector('tr').appendChild(th);
          tbody.querySelectorAll('tr').forEach(tr=>{ const td=document.createElement('td'); td.contentEditable = (state.mode==='ADMIN'); td.setAttribute('data-label', `欄${idx+1}`); tr.appendChild(td); });
          rebalanceFlexTable(table); syncTDLabels(table); buildWidthsPanel(panel, table, state.mode==='ADMIN');
        }
        if (e.target.classList.contains('qa-tflex-delcol')){
          const ths = thead.querySelectorAll('th');
          if (ths.length>1){
            ths[ths.length-1].remove();
            const cols = cg.querySelectorAll('col'); if (cols.length) cols[cols.length-1].remove();
            tbody.querySelectorAll('tr').forEach(tr=>{ const tds=tr.querySelectorAll('td'); if (tds.length) tds[tds.length-1].remove(); });
            rebalanceFlexTable(table); syncTDLabels(table); buildWidthsPanel(panel, table, state.mode==='ADMIN');
          }
        }
        if (e.target.classList.contains('qa-tflex-del')) { wrap.remove(); }
        if (e.target.classList.contains('qa-tflex-widths')) { panel.classList.toggle('d-none'); }
        if (e.target.classList.contains('qa-tflex-even')) { rebalanceFlexTable(table); buildWidthsPanel(panel, table, state.mode==='ADMIN'); }
        return;
      }
    });

    // 欄寬面板即時同步
    host.addEventListener('input', (e)=>{
      if (e.target.classList.contains('qa-remark-text')) {
        const r = e.target.closest('.qa-block-remark');
        const txt = (e.target.textContent||'').trim();
        r.style.display = txt ? '' : 'none';
        const root = e.target.closest('.qa-content'); if (root) ensureRemarkAtBottom(root);
      }
      if (e.target.tagName === 'TH' && e.target.closest('.qa-block-tableflex')){
        const table = e.target.closest('table'); if (table) syncTDLabels(table);
      }
      if (e.target.classList.contains('qa-tflex-w')){
        const panel = e.target.closest('.qa-tflex-widths-panel');
        const wrap  = panel.closest('.qa-block-tableflex');
        const table = wrap.querySelector('table');
        const inputs= Array.from(panel.querySelectorAll('.qa-tflex-w')).map(inp=> Number(inp.value)||0);
        setColWidths(table, inputs);
      }
    });

    // Enter 清空空白（副標 / li）
    host.addEventListener('keydown', (e)=>{
      if (e.key !== 'Enter' || state.mode!=='ADMIN') return;
      if (e.target.classList.contains('qa-sub')) {
        const txt = (e.target.textContent||'').trim();
        if (!txt) { e.preventDefault(); const wrap = e.target.closest('.qa-block-sub'); if (wrap) wrap.remove(); }
      }
      if (e.target.tagName === 'LI') {
        const txt = (e.target.textContent||'').trim();
        if (!txt) {
          e.preventDefault();
          const ul = e.target.closest('ul');
          e.target.remove();
          if (ul && !ul.querySelector('li')) { const lw = ul.closest('.qa-block-list'); if (lw) lw.remove(); }
        }
      }
    });

    // 失焦清空空白節點
    host.addEventListener('blur', (e)=>{
      if (state.mode !== 'ADMIN') return;
      if (e.target.classList && e.target.classList.contains('qa-sub')) {
        const wrap = e.target.closest('.qa-block-sub'); if (wrap && !e.target.textContent.trim()) wrap.remove();
      }
      if (e.target.tagName === 'LI') {
        const ul = e.target.closest('ul');
        if (!e.target.textContent.trim()) {
          e.target.remove();
          if (ul && !ul.querySelector('li')) { const lw = ul.closest('.qa-block-list'); if (lw) lw.remove(); }
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
      (scope||host).querySelectorAll('.qa-sub, li, th, td, .qa-remark-text, .qa-card-head, .qa-cat-title')
        .forEach(el=>{ if (el.closest('.tap-assign')) el.setAttribute('contenteditable','true'); });
      host.setAttribute('data-mode','ADMIN');
    }
    if (state.mode==='USER') lockAsUser();

    // ===== JSON =====
    function getJSON(){
      const categories = state.categories.map(c=>{
        const box = c.node.querySelector('.qa-entries');
        const entries = [];
        Array.from(box.children).forEach(entry=>{
          // 只有 card
          if (entry.classList.contains('qa-entry-card')) {
            const title   = entry.querySelector('.qa-card-head')?.textContent.trim() || '';
            const content = entry.querySelector('.qa-content');
            const blocks  = serializeBlocks(content);
            entries.push({ kind:'card', title, blocks });
          }
        });
        return { title: c.title, anchorId: c.anchorId, entries };
      });
      return { schemaVersion: 1, updatedAt: Date.now(), categories };

      function serializeBlocks(root){
        const blocks = [];
        Array.from(root.children).forEach(child=>{
          if (child.classList.contains('qa-block-sub'))   {
            blocks.push({ type:'subheading', text: (child.querySelector('.qa-sub')?.textContent||'').trim() });
          } else if (child.classList.contains('qa-block-list')) {
            const ul = child.querySelector('ul');
            const arr = ul ? Array.from(ul.querySelectorAll('li')).map(li => (li.textContent||'').trim()) : [];
            blocks.push({ type:'list', items: arr });
          } else if (child.classList.contains('qa-block-tableflex')) {
            const table = child.querySelector('table');
            const heads = Array.from(table.querySelectorAll('thead th')).map(th=> (th.textContent||'').trim());
            const widths= colWidths(table);
            const rows  = [];
            table.querySelectorAll('tbody tr').forEach(tr=>{
              const arr = Array.from(tr.querySelectorAll('td')).map(td=> (td.textContent||'').trim());
              rows.push(arr);
            });
            blocks.push({ type:'table', heads, widths, rows });
          } else if (child.classList.contains('qa-block-remark')) {
            const txt = (child.querySelector('.qa-remark-text')?.textContent||'').trim();
            blocks.push({ type:'remark', text: txt });
          }
        });
        return blocks;
      }
    }

    function setJSON(data={}){
      // 清空畫面 + 側欄僅刪除本插件曾加的項目
      catsWrap.innerHTML = ''; state.categories = []; state.orderSeq = 0;
      clearMySidebarItems();

      (data.categories||[]).forEach(cat=>{
        const ref = addCategory(cat.title||'未命名類別');
        // 覆蓋 anchorId（若資料內有）
        if (cat.anchorId) {
          ref.anchorId = cat.anchorId;
          const head = ref.node.querySelector('.as-category > [id]');
          if (head) head.id = ref.anchorId;
          // 更新側欄 a 的 href
          if (ref._sideItem) {
            const a = ref._sideItem.querySelector('a'); if (a) a.setAttribute('href', '#'+ref.anchorId);
          }
        }
        const box = ref.node.querySelector('.qa-entries');
        (cat.entries||[]).forEach(ent=>{
          if (ent.kind==='card'){
            const card = addCard(ref.node, ent.title||'請輸入卡片標題');
            restoreBlocks(card.querySelector('.qa-content'), ent.blocks||[]);
          }
        });
      });

      if (state.mode==='USER') lockAsUser();

      function restoreBlocks(root, blocks){
        blocks.forEach(b=>{
          if (b.type==='subheading') insertSubheading(root.closest('.qa-entry')||root, b.text||'', state.mode==='ADMIN');
          else if (b.type==='list' && Array.isArray(b.items)) b.items.forEach(x=> insertListItem(root.closest('.qa-entry')||root, x||'', state.mode==='ADMIN'));
          else if (b.type==='table') {
            insertTableFlex(root.closest('.qa-entry')||root, state.mode==='ADMIN', Math.max(1, (b.heads||[]).length || 2));
            const tbl = root.querySelector('.qa-block-tableflex:last-child table');
            if (tbl){
              const ths = tbl.querySelectorAll('thead th');
              (b.heads||[]).forEach((name,i)=>{ if (ths[i]) ths[i].textContent = t(name||`欄${i+1}`); });
              setColWidths(tbl, b.widths||[]);
              const tbody = tbl.querySelector('tbody'); tbody.innerHTML = '';
              (b.rows||[]).forEach(arr=>{
                const tr = document.createElement('tr');
                const n = ths.length;
                for (let i=0;i<n;i++){
                  const td = document.createElement('td');
                  td.contentEditable = (state.mode==='ADMIN');
                  td.textContent = t(arr?.[i]||'');
                  td.setAttribute('data-label', ths[i]?.textContent.trim() || `欄${i+1}`);
                  tr.appendChild(td);
                }
                tbody.appendChild(tr);
              });
              syncTDLabels(tbl);
              const panel = tbl.closest('.qa-block-tableflex').querySelector('.qa-tflex-widths-panel');
              buildWidthsPanel(panel, tbl, state.mode==='ADMIN');
            }
          } else if (b.type==='remark') {
            insertRemark(root.closest('.qa-entry')||root, b.text||'', state.mode==='ADMIN');
          }
        });
        ensureRemarkAtBottom(root);
      }
    }

    function setMode(next){
      const v = String(next||'USER').toUpperCase()==='ADMIN' ? 'ADMIN' : 'USER';
      state.mode = v;
      if (v==='USER') lockAsUser();
      else unlockAsAdmin();
    }

    const api = { setMode, getJSON, setJSON };
    host._tap_assign = api;
    return api;
  }

  // ===== 自動掛載 =====
  function autoload(){
    document.querySelectorAll('[data-tap-plugin="assign"]').forEach(node=>{
      if (node._tap_assign) return;
      const api = mount(node, {});
      FreeTop.applyInitialJSON?.(node, api);
    });
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', autoload);
  else autoload();

  // 對外
  global.TAPAssignKit = { mount };

})(window);
