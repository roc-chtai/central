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

  // ===== 基本設定 =====
  const THEME_COLOR = 'var(--main-red, #ea7066)';
  let   INST = 0;
  const uid  = (p='qa') => `${p}-${++INST}-${Math.random().toString(36).slice(2,8)}`;
  const t    = (s)=> (s==null ? '' : String(s));
  const $all = (root, sel)=> Array.from((root instanceof Element?root:document).querySelectorAll(sel));
  const h    = (tag, cls, html)=>{ const el=document.createElement(tag); if(cls) el.className=cls; if(html!=null) el.innerHTML=html; return el; };
  const insertAfter = (n, ref)=> ref.parentNode.insertBefore(n, ref.nextSibling);

  // ===== 小工具：內容操作 =====
  function findContentRoot(entry){
    const el = entry && entry.nodeType ? entry : (entry && entry.node);
    return (el || entry).querySelector('.qa-content');
  }
  function ensureRemarkAtBottom(root){
    const r = root.querySelector('.qa-block-remark');
    if (r) root.appendChild(r);
  }
  function findLastNonTableNonRemark(root){
    const blocks = Array.from(root.children);
    for (let i=blocks.length-1; i>=0; i--){
      const b = blocks[i];
      if (!b.classList.contains('qa-block-table') &&
          !b.classList.contains('qa-block-tableflex') &&
          !b.classList.contains('qa-block-remark')) return b;
    }
    return null;
  }

  // ===== 通用插入：副標／清單／備註 =====
  function insertSubheading(entry, text, admin){
    const root = findContentRoot(entry); if(!root) return null;
    const wrap = h('div','qa-block qa-block-sub mb-2');
    const el = h('div','fw-bold text-danger mb-0 qa-sub');
    el.contentEditable = admin;
    el.textContent = t(text || '請輸入副標');
    wrap.appendChild(el);

    const anchor = findLastNonTableNonRemark(root);
    if (anchor) insertAfter(wrap, anchor);
    else root.insertBefore(wrap, root.firstChild);

    el.focus();
    ensureRemarkAtBottom(root);
    return wrap;
  }
  function insertListItem(entry, text, admin){
    const root = findContentRoot(entry); if(!root) return null;
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
    li.contentEditable = admin;
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
  function insertRemark(entry, text, admin){
    const root = findContentRoot(entry); if(!root) return null;
    let w = root.querySelector('.qa-block-remark');
    if (!w) {
      w = h('div','qa-block qa-block-remark small text-muted mt-2');
      w.innerHTML = `※ <span class="qa-remark-text" ${admin?'contenteditable="true"':''}></span>`;
      root.appendChild(w);
    }
    const span = w.querySelector('.qa-remark-text');
    span.textContent = t(text || '請輸入備註');
    w.style.display = '';
    ensureRemarkAtBottom(root);
    span.focus();
    return w;
  }

  // ===== 舊版手風琴：雙欄表格（原邏輯保留）=====
  function insertTable2(entry, admin, cfg={}){
    const { headLeft='欄1', headRight='欄2', leftWidth=50, rightWidth=50 } = cfg;
    const root = findContentRoot(entry); if(!root) return null;
    const wrap = h('div','qa-block qa-block-table mb-2');
    const panel = h('div','table-responsive qa-table-wrap mb-2');
    const tblId = uid('tbl');

    panel.innerHTML = `
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
      <table id="${tblId}" class="table table-bordered align-middle small mb-0">
        <colgroup>
          <col style="width:${leftWidth}%">
          <col style="width:${rightWidth}%">
        </colgroup>
        <thead class="table-danger">
          <tr>
            <th contenteditable="${admin}">${t(headLeft)}</th>
            <th contenteditable="${admin}">${t(headRight)}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td contenteditable="${admin}"></td>
            <td contenteditable="${admin}"></td>
          </tr>
        </tbody>
      </table>
    `;
    wrap.appendChild(panel);

    // 放在備註上面；若無備註就 append
    const remark = root.querySelector('.qa-block-remark');
    if (remark) root.insertBefore(wrap, remark); else root.appendChild(wrap);
    ensureRemarkAtBottom(root);
    return wrap;
  }

  // ===== 新：卡片用「動態表格」 =====
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
      </div>
      <div class="ms-auto">
        <button type="button" class="btn btn-outline-dark btn-sm qa-tflex-del">刪除表格</button>
      </div>
    `);

    const table = document.createElement('table');
    table.className = 'table table-bordered align-middle small mb-0';
    const cg = document.createElement('colgroup');
    const thead = document.createElement('thead'); thead.className = 'table-danger';
    const tbody = document.createElement('tbody');
    const trHead = document.createElement('tr');

    // 建欄
    colCount = Math.max(1, Number(colCount)||2);
    for (let i=0;i<colCount;i++){
      const col = document.createElement('col'); cg.appendChild(col);
      const th = document.createElement('th'); th.contentEditable = admin; th.textContent = `欄${i+1}`;
      trHead.appendChild(th);
    }
    thead.appendChild(trHead);

    // 第一列
    const tr = document.createElement('tr');
    for (let i=0;i<colCount;i++){
      const td = document.createElement('td');
      td.contentEditable = admin;
      td.setAttribute('data-label', `欄${i+1}`);
      tr.appendChild(td);
    }
    tbody.appendChild(tr);

    // 組裝
    table.appendChild(cg); table.appendChild(thead); table.appendChild(tbody);
    wrap.appendChild(header); wrap.appendChild(table);
    root.appendChild(wrap);

    // 平均欄寬
    rebalanceColgroup(cg);
    return wrap;

    function rebalanceColgroup(colgroup){
      const n = colgroup.children.length || 1;
      const w = Math.floor(100/n);
      Array.from(colgroup.children).forEach((c, idx)=> c.style.width = (idx===n-1 ? (100-(w*(n-1))) : w) + '%');
    }
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

  // ===== 主掛載 =====
  function mount(target, opts={}){
    const host = (typeof target==='string') ? document.querySelector(target) : target;
    if (!host) return null;
    if (host._tap_qualify) return host._tap_qualify;

    const mode    = FreeTop.resolveMode(host, opts, global);   // 'ADMIN' | 'USER'
    const faClass = FreeTop.getFaClass(host, opts, global);    // 預設 'fas'

    const state = { id: uid('qa'), mode, categories: [], orderSeq: 0 };

    host.innerHTML = '';
    host.classList.add('tap-qualify');
    host.setAttribute('data-mode', state.mode);

    // ===== Admin：整體「新增類別區塊」 =====
    let cfg = null;
    if (state.mode === 'ADMIN') {
      cfg = h('div','card mb-3 qa-admin');
      const cid = state.id;

      const ip = FreeTop.iconPicker({
        faClass,
        value: '',
        icons: FreeTop.getIconSet(), // 常用清單（含 '' = 無）
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
      const card = h('div','mb-3');
      const iconHtml = icon ? `<i class="${faClass} ${icon} me-2" style="color:${THEME_COLOR};"></i>` : '';

      card.innerHTML = `
        <div class="d-flex align-items-center mb-2" style="gap:.5rem;">
          <div class="fw-bold fs-5" style="letter-spacing:1px;">${iconHtml}${t(title)}</div>
          <div class="ms-auto qa-admin d-flex gap-2">
            <button type="button" class="btn btn-outline-secondary btn-sm qa-sort-toggle" data-mode="insert">排序：插入順序</button>
            <button type="button" class="btn btn-outline-dark btn-sm qa-cat-del">刪除類別</button>
          </div>
        </div>

        <!-- 新增內容區塊 -->
        <div class="d-flex align-items-end gap-2 mb-2 qa-admin">
          <div class="flex-grow-1" style="max-width:360px;">
            <label class="form-label small mb-1">新增內容標題</label>
            <input type="text" class="form-control form-control-sm qa-entry-title" placeholder="例：高等考試三級 / 年齡限制">
          </div>
          <button type="button" class="btn btn-danger btn-sm qa-add-acc">插入手風琴</button>
          <button type="button" class="btn btn-danger btn-sm qa-add-card">插入卡片</button>
        </div>

        <!-- 內容列表（手風琴 / 卡片） -->
        <div class="qa-entries"></div>
      `;
      catsWrap.appendChild(card);

      const cat = { id: catId, node: card, title, icon, orderMode:'insert' };
      state.categories.push(cat);

      // 刪除類別
      card.querySelector('.qa-cat-del').addEventListener('click', ()=>{
        const idx = state.categories.findIndex(c=>c.node===card);
        if (idx>-1) state.categories.splice(idx,1);
        card.remove();
      });

      if (state.mode==='USER') lockAsUser(card);
      return cat;
    }

    // ===== 新增手風琴 =====
    function addAccordion(catNode, title){
      const entries = catNode.querySelector('.qa-entries');
      const entry = h('div','qa-entry qa-entry-acc mb-3');
      entry.dataset.order = (++state.orderSeq).toString();

      const hid = uid('heading');
      const cid = uid('collapse');

      entry.innerHTML = `
        <div class="accordion-item" style="border:none;">
          <h2 class="accordion-header" id="${hid}">
            <button class="accordion-button bg-danger text-white fw-bold rounded collapsed px-3 py-2"
              type="button" data-bs-toggle="collapse" data-bs-target="#${cid}"
              aria-expanded="false" aria-controls="${cid}">
              ${t(title||'未命名手風琴')}
            </button>
          </h2>
          <div id="${cid}" class="accordion-collapse collapse" aria-labelledby="${hid}">
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
        </div>
      `;
      entries.appendChild(entry);
      if (state.mode==='USER') lockAsUser(entry);
      return entry;
    }

    // ===== 新增卡片 =====
    function addCard(catNode, headingText, headerText){
      const entries = catNode.querySelector('.qa-entries');
      const entry = h('div','qa-entry qa-entry-card mb-3');
      entry.dataset.order = (++state.orderSeq).toString();

      entry.innerHTML = `
        <div class="mb-3 fw-bold fs-5 qa-card-title" style="letter-spacing:1px;" ${state.mode==='ADMIN'?'contenteditable="true"':''}>
          ${t(headingText||'請輸入文字標題')}
        </div>
        <div class="card">
          <div class="card-header bg-white border-bottom border-danger fw-bold">
            <span class="qa-card-head" ${state.mode==='ADMIN'?'contenteditable="true"':''}>${t(headerText||'請輸入卡片標題')}</span>
          </div>
          <div class="card-body">
            <div class="d-flex flex-wrap align-items-center gap-2 mb-2 qa-admin">
              <div class="d-flex flex-wrap align-items-center gap-2">
                <button type="button" class="btn btn-outline-danger btn-sm qa-insert-sub">插入標題</button>
                <button type="button" class="btn btn-outline-danger btn-sm qa-insert-li">插入項目</button>
                <button type="button" class="btn btn-outline-danger btn-sm qa-insert-table">插入表格</button>
                <button type="button" class="btn btn-outline-secondary btn-sm qa-insert-remark">新增備註</button>
              </div>
              <div class="ms-auto">
                <button type="button" class="btn btn-outline-dark btn-sm qa-card-del">刪除卡片</button>
              </div>
            </div>
            <div class="qa-content"></div>
          </div>
        </div>
      `;
      entries.appendChild(entry);
      if (state.mode==='USER') lockAsUser(entry);
      return entry;
    }

    // ===== 排序切換 =====
    function applyCategoryOrder(catNode){
      const modeBtn = catNode.querySelector('.qa-sort-toggle');
      const mode = modeBtn.dataset.mode || 'insert';
      const box = catNode.querySelector('.qa-entries');
      const items = Array.from(box.children);
      if (mode === 'type'){
        const acc = items.filter(n=> n.classList.contains('qa-entry-acc'));
        const card= items.filter(n=> n.classList.contains('qa-entry-card'));
        const merged = acc.concat(card); // 各自保持原始 data-order
        merged.sort((a,b)=> Number(a.dataset.order) - Number(b.dataset.order)); // 先確保穩定
        box.innerHTML = ''; merged.forEach(n=> box.appendChild(n));
      }else{
        items.sort((a,b)=> Number(a.dataset.order) - Number(b.dataset.order));
        box.innerHTML = ''; items.forEach(n=> box.appendChild(n));
      }
    }

    // ===== 事件委派 =====
    host.addEventListener('click', (e)=>{
      // 類別內新增內容（手風琴／卡片）
      if (e.target.classList.contains('qa-add-acc') || e.target.classList.contains('qa-add-card')){
        const cat = e.target.closest('.mb-3'); // 類別卡片容器
        const titleInput = cat.querySelector('.qa-entry-title');
        const val = (titleInput.value||'').trim();
        if (e.target.classList.contains('qa-add-acc')) {
          addAccordion(cat, val || '未命名手風琴');
        } else {
          // 卡片：上方文字標題 & 卡片 header 都先用同一個字，之後可單獨改
          addCard(cat, val || '請輸入文字標題', val || '請輸入卡片標題');
        }
        titleInput.value = '';
        return;
      }

      // 切換排序
      if (e.target.classList.contains('qa-sort-toggle')){
        const btn = e.target;
        const cat = btn.closest('.mb-3');
        const next = (btn.dataset.mode === 'insert') ? 'type' : 'insert';
        btn.dataset.mode = next;
        btn.textContent = (next === 'insert') ? '排序：插入順序' : '排序：手風琴在上';
        applyCategoryOrder(cat);
        return;
      }

      // 刪除手風琴 / 卡片
      if (e.target.classList.contains('qa-acc-del') || e.target.classList.contains('qa-card-del')){
        const entry = e.target.closest('.qa-entry');
        if (entry) entry.remove();
        return;
      }

      // 內容工具列：插入標題 / 項目 / 表格 / 備註
      if (e.target.classList.contains('qa-insert-sub') ||
          e.target.classList.contains('qa-insert-li')  ||
          e.target.classList.contains('qa-insert-table') ||
          e.target.classList.contains('qa-insert-remark')){
        const entry = e.target.closest('.qa-entry');
        const isCard = entry.classList.contains('qa-entry-card');
        if (e.target.classList.contains('qa-insert-sub'))  { insertSubheading(entry, '請輸入副標', state.mode==='ADMIN'); return; }
        if (e.target.classList.contains('qa-insert-li'))   { insertListItem(entry, '請輸入項目', state.mode==='ADMIN'); return; }
        if (e.target.classList.contains('qa-insert-table')){ 
          if (isCard) insertTableFlex(entry, state.mode==='ADMIN', 2);
          else        insertTable2(entry,   state.mode==='ADMIN', {});
          return;
        }
        if (e.target.classList.contains('qa-insert-remark')){ insertRemark(entry, '請輸入備註', state.mode==='ADMIN'); return; }
      }

      // 雙欄表格（舊）
      if (e.target.classList.contains('qa-tbl-addrow')){
        const w = e.target.closest('.qa-table-wrap');
        const tbody = w.querySelector('tbody');
        const tr = document.createElement('tr');
        for (let i=0;i<2;i++){ const td=document.createElement('td'); td.contentEditable = (state.mode==='ADMIN'); tr.appendChild(td); }
        tbody.appendChild(tr);
        return;
      }
      if (e.target.classList.contains('qa-tbl-delrow')){
        const w = e.target.closest('.qa-table-wrap');
        const rows = w.querySelectorAll('tbody tr');
        if (rows.length) rows[rows.length-1].remove();
        return;
      }
      if (e.target.classList.contains('qa-tbl-del')){
        const wrap = e.target.closest('.qa-block-table'); if (wrap) wrap.remove();
        return;
      }

      // 動態表格
      if (e.target.classList.contains('qa-tflex-addrow') ||
          e.target.classList.contains('qa-tflex-delrow') ||
          e.target.classList.contains('qa-tflex-addcol') ||
          e.target.classList.contains('qa-tflex-delcol') ||
          e.target.classList.contains('qa-tflex-del')){
        const wrap = e.target.closest('.qa-block-tableflex'); if (!wrap) return;
        const table = wrap.querySelector('table'); if (!table) return;
        const thead = table.querySelector('thead'); const tbody = table.querySelector('tbody'); const cg = table.querySelector('colgroup');

        if (e.target.classList.contains('qa-tflex-addrow')){
          const n = thead.querySelectorAll('th').length || 1;
          const tr = document.createElement('tr');
          for (let i=0;i<n;i++){ const td=document.createElement('td'); td.contentEditable = (state.mode==='ADMIN'); td.setAttribute('data-label', thead.querySelectorAll('th')[i]?.textContent.trim() || `欄${i+1}`); tr.appendChild(td); }
          tbody.appendChild(tr);
        }
        if (e.target.classList.contains('qa-tflex-delrow')){
          const rows = tbody.querySelectorAll('tr'); if (rows.length) rows[rows.length-1].remove();
        }
        if (e.target.classList.contains('qa-tflex-addcol')){
          const idx = thead.querySelectorAll('th').length;
          const col = document.createElement('col'); cg.appendChild(col);
          const th = document.createElement('th'); th.contentEditable = (state.mode==='ADMIN'); th.textContent = `欄${idx+1}`; thead.querySelector('tr').appendChild(th);
          tbody.querySelectorAll('tr').forEach(tr=>{
            const td = document.createElement('td'); td.contentEditable = (state.mode==='ADMIN'); td.setAttribute('data-label', `欄${idx+1}`); tr.appendChild(td);
          });
          rebalanceFlexTable(table); syncTDLabels(table);
        }
        if (e.target.classList.contains('qa-tflex-delcol')){
          const ths = thead.querySelectorAll('th');
          if (ths.length>1){
            ths[ths.length-1].remove();
            const cols = cg.querySelectorAll('col'); if (cols.length) cols[cols.length-1].remove();
            tbody.querySelectorAll('tr').forEach(tr=>{ const tds=tr.querySelectorAll('td'); if (tds.length) tds[tds.length-1].remove(); });
            rebalanceFlexTable(table); syncTDLabels(table);
          }
        }
        if (e.target.classList.contains('qa-tflex-del')){
          wrap.remove();
        }
        return;
      }
    });

    // input/blur 行為
    host.addEventListener('input', (e)=>{
      // 備註空字自動隱藏（並固定在底部）
      if (e.target.classList.contains('qa-remark-text')) {
        const r = e.target.closest('.qa-block-remark');
        const txt = (e.target.textContent||'').trim();
        r.style.display = txt ? '' : 'none';
        const root = e.target.closest('.qa-content');
        if (root) ensureRemarkAtBottom(root);
      }
      // 舊：雙欄表格即時調整欄寬
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
      // 動態表格：表頭變動同步 data-label
      if (e.target.closest('.qa-block-tableflex') && e.target.tagName === 'TH'){
        const table = e.target.closest('table'); if (table) syncTDLabels(table);
      }
    });

    // Enter 刪空行（副標 / li）
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

    // 失焦清空空白節點
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
      (scope||host).querySelectorAll('.qa-sub, li, th, td, .qa-remark-text, .qa-card-title, .qa-card-head').forEach(el=>{
        if (el.closest('.tap-qualify')) el.setAttribute('contenteditable','true');
      });
      host.setAttribute('data-mode','ADMIN');
    }
    if (state.mode==='USER') lockAsUser();

    // ===== JSON =====
    function getJSON(){
      const categories = state.categories.map(c=>{
        const box = c.node.querySelector('.qa-entries');
        const entries = [];
        Array.from(box.children).forEach(entry=>{
          if (entry.classList.contains('qa-entry-acc')) {
            const title = entry.querySelector('.accordion-button')?.textContent.trim() || '';
            const content = entry.querySelector('.qa-content');
            const blocks = serializeBlocks(content);
            entries.push({ kind:'accordion', title, blocks });
          } else if (entry.classList.contains('qa-entry-card')) {
            const heading = entry.querySelector('.qa-card-title')?.textContent.trim() || '';
            const title   = entry.querySelector('.qa-card-head')?.textContent.trim() || '';
            const content = entry.querySelector('.qa-content');
            const blocks = serializeBlocks(content);
            entries.push({ kind:'card', heading, title, blocks });
          }
        });
        return { title:c.title, icon:c.icon, orderMode: c.orderMode || 'insert', entries };
      });
      return { schemaVersion: 3, updatedAt: Date.now(), categories };

      function serializeBlocks(root){
        const blocks = [];
        Array.from(root.children).forEach(child=>{
          if (child.classList.contains('qa-block-sub')) {
            blocks.push({ type:'subheading', text: (child.querySelector('.qa-sub')?.textContent||'').trim() });
          } else if (child.classList.contains('qa-block-list')) {
            const ul = child.querySelector('ul');
            const arr = ul ? Array.from(ul.querySelectorAll('li')).map(li => (li.textContent||'').trim()) : [];
            blocks.push({ type:'list', items: arr });
          } else if (child.classList.contains('qa-block-table')) {
            // 舊雙欄（在手風琴）
            const table = child.querySelector('table');
            const thead = table.querySelectorAll('thead th');
            const rows = [];
            table.querySelectorAll('tbody tr').forEach(tr=>{
              const tds = tr.querySelectorAll('td');
              rows.push([ (tds[0]?.textContent||'').trim(), (tds[1]?.textContent||'').trim() ]);
            });
            blocks.push({ type:'table2', heads:[ (thead[0]?.textContent||'').trim(), (thead[1]?.textContent||'').trim() ], rows });
          } else if (child.classList.contains('qa-block-tableflex')) {
            // 新動態表格（在卡片）
            const table = child.querySelector('table');
            const heads = Array.from(table.querySelectorAll('thead th')).map(th=> (th.textContent||'').trim());
            const rows = [];
            table.querySelectorAll('tbody tr').forEach(tr=>{
              const arr = Array.from(tr.querySelectorAll('td')).map(td=> (td.textContent||'').trim());
              rows.push(arr);
            });
            blocks.push({ type:'table', heads, rows });
          } else if (child.classList.contains('qa-block-remark')) {
            const txt = (child.querySelector('.qa-remark-text')?.textContent||'').trim();
            blocks.push({ type:'remark', text: txt });
          }
        });
        return blocks;
      }
    }

    function setJSON(data={}){
      catsWrap.innerHTML = ''; state.categories = []; state.orderSeq = 0;

      (data.categories||[]).forEach(cat=>{
        const ref = addCategory(cat.title||'未命名類別', { icon: cat.icon||'' });
        const box = ref.node.querySelector('.qa-entries');

        (cat.entries||[]).forEach(ent=>{
          if (ent.kind==='accordion'){
            const acc = addAccordion(ref.node, ent.title||'未命名手風琴');
            restoreBlocks(acc.querySelector('.qa-content'), ent.blocks||[]);
          } else if (ent.kind==='card'){
            const card = addCard(ref.node, ent.heading||'請輸入文字標題', ent.title||'請輸入卡片標題');
            restoreBlocks(card.querySelector('.qa-content'), ent.blocks||[]);
          }
        });

        // 排序模式狀態（恢復按鈕顯示即可）
        const btn = ref.node.querySelector('.qa-sort-toggle');
        const mode = (cat.orderMode==='type')?'type':'insert';
        btn.dataset.mode = mode;
        btn.textContent = (mode==='insert') ? '排序：插入順序' : '排序：手風琴在上';
        applyCategoryOrder(ref.node);
      });

      if (state.mode==='USER') lockAsUser();

      function restoreBlocks(root, blocks){
        blocks.forEach(b=>{
          if (b.type==='subheading') insertSubheading(root.closest('.qa-entry')||root, b.text||'', state.mode==='ADMIN');
          else if (b.type==='list' && Array.isArray(b.items)) b.items.forEach(x=> insertListItem(root.closest('.qa-entry')||root, x||'', state.mode==='ADMIN'));
          else if (b.type==='table2') {
            insertTable2(root.closest('.qa-entry')||root, state.mode==='ADMIN', { headLeft:b.heads?.[0]||'欄1', headRight:b.heads?.[1]||'欄2' });
            const tbl = root.querySelector('.qa-block-table:last-child table');
            const tbody = tbl?.querySelector('tbody');
            if (tbody) {
              // 先清掉第一列（插入時建的）
              tbody.innerHTML = '';
              (b.rows||[]).forEach(r=>{
                const tr = document.createElement('tr');
                const td1 = document.createElement('td'); td1.contentEditable = (state.mode==='ADMIN'); td1.textContent = t(r?.[0]||'');
                const td2 = document.createElement('td'); td2.contentEditable = (state.mode==='ADMIN'); td2.textContent = t(r?.[1]||'');
                tr.appendChild(td1); tr.appendChild(td2); tbody.appendChild(tr);
              });
            }
          } else if (b.type==='table') {
            insertTableFlex(root.closest('.qa-entry')||root, state.mode==='ADMIN', Math.max(1, (b.heads||[]).length || 2));
            const tbl = root.querySelector('.qa-block-tableflex:last-child table');
            if (tbl){
              const ths = tbl.querySelectorAll('thead th');
              (b.heads||[]).forEach((name,i)=>{ if (ths[i]) ths[i].textContent = t(name||`欄${i+1}`); });
              const tbody = tbl.querySelector('tbody'); tbody.innerHTML = '';
              (b.rows||[]).forEach(arr=>{
                const tr = document.createElement('tr');
                const n = ths.length;
                for (let i=0;i<n;i++){
                  const td = document.createElement('td');
                  td.contentEditable = (state.mode==='ADMIN');
                  td.textContent = t(arr?.[i]||'');
                  tr.appendChild(td);
                }
                tbody.appendChild(tr);
              });
              rebalanceFlexTable(tbl); syncTDLabels(tbl);
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
    host._tap_qualify = api;
    return api;
  }

  // ===== 自動掛載＋前台自動吃資料 =====
  function autoload(){
    document.querySelectorAll('[data-tap-plugin="qualify"]').forEach(node=>{
      if (node._tap_qualify) return;
      const api = mount(node, {});
      FreeTop.applyInitialJSON(node, api);
    });
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', autoload);
  else autoload();

  global.TAPQualifyKit = { mount };

})(window);
