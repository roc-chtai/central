/*!
 * TAPQualifyKit — 報考資格手風琴（FreeTop 版 / FA5）
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
 *   - 前台自動吃資料：data-json-var / data-json-script / data-json-local
 */

(function (global) {
  'use strict';

  const THEME_COLOR = 'var(--main-red)';
  const t  = s => (s==null?'':String(s));
  const h  = (tag, cls, html)=>{ const el=document.createElement(tag); if(cls) el.className=cls; if(html!=null) el.innerHTML=html; return el; };
  const $$ = (root, sel)=> Array.from((root instanceof Element?root:document).querySelectorAll(sel));
  let INST = 0;
  const uid = (p='qa') => `${p}-${++INST}-${Math.random().toString(36).slice(2,8)}`;

  // 找內容根
  const findContentRoot = blk => ((blk&&blk.node)?blk.node:blk).querySelector('.qa-content');
  const insertAfter = (newNode, refNode)=> refNode.parentNode.insertBefore(newNode, refNode.nextSibling);

  // ---- 共同內容工具（副標 / 清單 / 表格 / 備註） ----
  function ensureRemarkAtBottom(root){ const r=root.querySelector('.qa-block-remark'); if(r) root.appendChild(r); }
  function findLastNonTableNonRemark(root){
    const blocks = Array.from(root.children);
    for (let i=blocks.length-1; i>=0; i--){ const b=blocks[i];
      if (!b.classList.contains('qa-block-table') && !b.classList.contains('qa-block-remark')) return b;
    } return null;
  }

  function insertSubheading(state, accOrCard, text){
    const root = findContentRoot(accOrCard); if(!root) return null;
    const wrap = h('div','qa-block qa-block-sub mb-2');
    const el   = h('div','fw-bold text-danger mb-0 qa-sub'); el.contentEditable = (state.mode==='ADMIN');
    el.textContent = t(text||'請輸入副標'); wrap.appendChild(el);

    const anchor = findLastNonTableNonRemark(root);
    if (anchor) insertAfter(wrap, anchor); else root.insertBefore(wrap, root.firstChild);
    el.focus(); ensureRemarkAtBottom(root); return wrap;
  }

  function insertListItem(state, accOrCard, text){
    const root = findContentRoot(accOrCard); if(!root) return null;
    const subs = $$(root, '.qa-block-sub'); let targetListWrap = null;

    if (subs.length){
      const lastSub = subs[subs.length-1];
      const next = lastSub.nextElementSibling;
      targetListWrap = (next && next.classList.contains('qa-block-list')) ? next : createListWrap();
      if (!next) insertAfter(targetListWrap, lastSub);
    } else {
      const lists = $$(root, '.qa-block-list');
      targetListWrap = lists.length ? lists[lists.length-1] : createListWrap();
      if (!lists.length){
        const remark = root.querySelector('.qa-block-remark');
        if (remark) root.insertBefore(targetListWrap, remark); else root.appendChild(targetListWrap);
      }
    }
    const ul = targetListWrap.querySelector('ul');
    const li = document.createElement('li'); li.contentEditable = (state.mode==='ADMIN'); li.textContent = t(text||'請輸入項目');
    ul.appendChild(li); li.focus(); ensureRemarkAtBottom(root); return li;

    function createListWrap(){
      const w = h('div','qa-block qa-block-list mb-2');
      const ul = document.createElement('ul'); ul.className='mb-2'; w.appendChild(ul); return w;
    }
  }

  // 新版表格：動態欄（1~6欄），預設2欄
  function insertTable(state, accOrCard, cfg={}){
    const root = findContentRoot(accOrCard); if(!root) return null;
    const cols = Array.isArray(cfg.cols) && cfg.cols.length
      ? cfg.cols.map((c,i)=>({ head: t(c.head||`欄${i+1}`), width: clampW(c.width) }))
      : [ {head:t(cfg.headLeft||'欄1'), width: clampW(cfg.leftWidth||50)},
          {head:t(cfg.headRight||'欄2'), width: clampW(cfg.rightWidth||50)} ];

    const wrap = h('div','qa-block qa-block-table mb-2');
    const box  = h('div','qa-table-wrap mb-2');

    const makeToolbar = () => `
      <div class="d-flex align-items-center gap-2 mb-2 qa-admin">
        <div class="d-flex flex-wrap align-items-center gap-2">
          <span class="small text-muted">欄位：</span>
          <button type="button" class="btn btn-outline-danger btn-sm qa-col-add">+ 欄</button>
          <button type="button" class="btn btn-outline-secondary btn-sm qa-col-del">- 欄</button>
          <span class="small text-muted ms-2">欄寬：</span>
          <span class="qa-width-editors"></span>
          <button type="button" class="btn btn-outline-danger btn-sm ms-2 qa-tbl-addrow">+ 列</button>
          <button type="button" class="btn btn-outline-secondary btn-sm qa-tbl-delrow">- 列</button>
        </div>
        <div class="ms-auto">
          <button type="button" class="btn btn-outline-dark btn-sm qa-tbl-del">刪除表格</button>
        </div>
      </div>`;

    const tableId = uid('tbl');
    box.innerHTML = `${makeToolbar()}
      <table id="${tableId}" class="table table-bordered align-middle small mb-0">
        <colgroup></colgroup>
        <thead class="table-danger"><tr></tr></thead>
        <tbody><tr></tr></tbody>
      </table>`;

    wrap.appendChild(box);
    root.querySelector('.qa-block-remark') ? root.insertBefore(wrap, root.querySelector('.qa-block-remark')) : root.appendChild(wrap);

    const table = box.querySelector('table');
    rebuildTableHeader(table, cols, state.mode);
    rebuildColgroup(table, cols);
    // 預設加一列（第一列已存在），若有 cfg.rows 依 rows
    const tbody = table.querySelector('tbody');
    if (Array.isArray(cfg.rows) && cfg.rows.length){
      tbody.innerHTML='';
      cfg.rows.forEach(r=> appendRow(table, cols, state.mode, r));
    } else {
      appendRow(table, cols, state.mode, []); // 預設再多一列
    }

    // 動態綁定：欄寬編輯器
    renderWidthEditors(box, cols);

    // 事件：欄/列/刪除/寬度
    box.addEventListener('click', e=>{
      if (e.target.classList.contains('qa-tbl-addrow')) { appendRow(table, cols, state.mode, []); }
      if (e.target.classList.contains('qa-tbl-delrow')) { const rows=tbody.querySelectorAll('tr'); if(rows.length) rows[rows.length-1].remove(); }
      if (e.target.classList.contains('qa-tbl-del')) { const p=wrap.closest('.qa-content'); wrap.remove(); if(p) ensureRemarkAtBottom(p); }
      if (e.target.classList.contains('qa-col-add'))  { if (cols.length<6){ cols.push({head:`欄${cols.length+1}`, width: Math.max(10, Math.round(100/(cols.length+1))) }); syncCols(table, cols, state.mode); renderWidthEditors(box, cols); } }
      if (e.target.classList.contains('qa-col-del'))  { if (cols.length>1){ cols.pop(); syncCols(table, cols, state.mode); renderWidthEditors(box, cols); } }
    });
    box.addEventListener('input', e=>{
      if (e.target.classList.contains('qa-w-input')){
        const i = Number(e.target.dataset.idx); cols[i].width = clampW(Number(e.target.value)||0);
        rebuildColgroup(table, cols);
      }
      if (e.target.classList.contains('qa-head-input')){
        const i = Number(e.target.dataset.idx); cols[i].head = e.target.value;
        rebuildTableHeader(table, cols, state.mode, /*keepBody*/true);
      }
    });

    ensureRemarkAtBottom(root);
    return wrap;

    function clampW(x){ return Math.max(5, Math.min(90, x|0)); }
  }

  function rebuildTableHeader(table, cols, mode, keepBody){
    const thead = table.querySelector('thead tr');
    thead.innerHTML = '';
    cols.forEach((c,i)=>{
      const th=document.createElement('th');
      th.innerHTML = `<input type="text" class="form-control form-control-sm qa-head-input qa-admin" data-idx="${i}" value="${t(c.head).replace(/"/g,'&quot;')}" ${mode==='ADMIN'?'':'style="display:none"'}><span class="qa-head-text"${mode==='ADMIN'?' style="display:none"':''}>${t(c.head)}</span>`;
      thead.appendChild(th);
    });
    if (!keepBody){
      const tbody = table.querySelector('tbody'); tbody.innerHTML='<tr></tr>'; // 清空一列
      appendRow(table, cols, mode, []);
    } else {
      // 同步 data-label
      table.querySelectorAll('tbody tr').forEach(tr=>{
        ensureCells(tr, cols.length, mode);
        Array.from(tr.children).forEach((td,i)=> td.setAttribute('data-label', t(cols[i]?.head||'')));
      });
    }
  }

  function rebuildColgroup(table, cols){
    let cg = table.querySelector('colgroup'); if(!cg){ cg=document.createElement('colgroup'); table.insertBefore(cg, table.firstChild); }
    cg.innerHTML=''; cols.forEach(c=>{ const col=document.createElement('col'); col.style.width=(c.width||0)+'%'; cg.appendChild(col); });
  }

  function appendRow(table, cols, mode, arr){
    const tr = document.createElement('tr');
    cols.forEach((c,i)=>{
      const td=document.createElement('td');
      td.setAttribute('data-label', t(c.head)); td.contentEditable=(mode==='ADMIN'); td.spellcheck=false; td.textContent=t(arr?.[i]||'');
      tr.appendChild(td);
    });
    table.querySelector('tbody').appendChild(tr);
  }
  function ensureCells(tr, need, mode){
    while(tr.children.length > need) tr.removeChild(tr.lastElementChild);
    while(tr.children.length < need){
      const td = document.createElement('td'); td.contentEditable=(mode==='ADMIN'); tr.appendChild(td);
    }
  }
  function syncCols(table, cols, mode){
    rebuildTableHeader(table, cols, mode, /*keepBody*/true);
    rebuildColgroup(table, cols);
  }
  function renderWidthEditors(box, cols){
    const holder = box.querySelector('.qa-width-editors'); holder.innerHTML='';
    cols.forEach((c,i)=>{
      const g = document.createElement('div'); g.className='input-group input-group-sm me-1'; g.style.width='90px';
      g.innerHTML = `<input type="number" class="form-control qa-w-input" data-idx="${i}" min="5" max="90" step="1" value="${c.width}"><span class="input-group-text">%</span>`;
      holder.appendChild(g);
    });
  }

  function insertRemark(state, accOrCard, text){
    const root = findContentRoot(accOrCard); if(!root) return null;
    let w = root.querySelector('.qa-block-remark');
    if (!w){ w = h('div','qa-block qa-block-remark small text-muted mt-2'); w.innerHTML = `※ <span class="qa-remark-text" ${state.mode==='ADMIN'?'contenteditable="true"':''}></span>`; root.appendChild(w); }
    const span = w.querySelector('.qa-remark-text'); span.textContent = t(text||'請輸入備註');
    w.style.display=''; ensureRemarkAtBottom(root); span.focus(); return w;
  }

  // ---- 類別 & 內容塊（手風琴 / 卡片）----
  function mount(target, opts={}){
    const host = (typeof target==='string') ? document.querySelector(target) : target;
    if (!host) return null; if (host._tap_qualify) return host._tap_qualify;

    const mode    = FreeTop.resolveMode(host, opts, global);
    const faClass = FreeTop.getFaClass(host, opts, global);
    const state = { id: uid('qa'), mode, categories: [] };

    host.innerHTML=''; host.className = (host.className||'') + ' tap-qualify'; host.setAttribute('data-mode', state.mode);

    // ===== Admin：新增類別 =====
    let cfg=null, addPanel=null;
    if (state.mode==='ADMIN'){
      const ip = FreeTop.iconPicker({ faClass, value:'', icons:FreeTop.getIconSet(), prefix:'qa', themeVar:'--main-red', fallback:'#ea7066' });

      cfg = h('div','card mb-3 qa-admin');
      const cid = state.id;
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
        const title=(cfg.querySelector(`#${cid}-cat-title`).value||'').trim()||'未命名類別';
        const icon = ip.get()||''; addCategory(title,{icon});
        cfg.querySelector(`#${cid}-cat-title`).value='';
      });

      // ===== Admin：新增內容（手風琴/卡片）=====
      addPanel = h('div','card mb-3 qa-admin');
      const aid = uid('qa');
      addPanel.innerHTML = `
        <div class="card-header bg-white border-bottom border-danger fw-bold">新增內容區塊</div>
        <div class="card-body">
          <div class="d-flex flex-wrap align-items-end gap-2">
            <div class="flex-grow-1" style="max-width:360px;">
              <label class="form-label small mb-1">內容標題</label>
              <input type="text" class="form-control form-control-sm" id="${aid}-content-title" placeholder="例：高等考試三級">
            </div>
            <div class="form-check form-switch ms-auto">
              <input class="form-check-input" type="checkbox" id="${aid}-order">
              <label class="form-check-label small" for="${aid}-order">卡片在上（關閉＝手風琴在上）</label>
            </div>
            <button type="button" class="btn btn-danger btn-sm" id="${aid}-add-acc">插入手風琴</button>
            <button type="button" class="btn btn-outline-danger btn-sm" id="${aid}-add-card">插入卡片</button>
          </div>
        </div>`;
      host.appendChild(addPanel);

      // 這兩個按鈕需作用在「最後一個類別」上（方便快速操作）
      addPanel.querySelector(`#${aid}-add-acc`).addEventListener('click', ()=>{
        const last = state.categories[state.categories.length-1]; if(!last) return;
        const ttl  = (addPanel.querySelector(`#${aid}-content-title`).value||'').trim()||'未命名手風琴';
        addAccordion(last.node, last.accId, ttl);
      });
      addPanel.querySelector(`#${aid}-add-card`).addEventListener('click', ()=>{
        const last = state.categories[state.categories.length-1]; if(!last) return;
        const ttl  = (addPanel.querySelector(`#${aid}-content-title`).value||'').trim()||'未命名卡片';
        addCard(last.node, ttl);
      });
      addPanel.querySelector(`#${aid}-order`).addEventListener('change', (e)=>{
        const last = state.categories[state.categories.length-1]; if(!last) return;
        last.cardFirst = !!e.target.checked; applyOrder(last);
      });
    }

    const catsWrap = h('div','qa-categories'); host.appendChild(catsWrap);

    function applyOrder(cat){
      if (!cat || !cat.node) return;
      const holder = cat.node.querySelector('.qa-holders');
      const accW   = holder.querySelector('.qa-acc-wrap');
      const cardW  = holder.querySelector('.qa-card-wrap');
      if (cat.cardFirst) holder.insertBefore(cardW, accW); else holder.insertBefore(accW, cardW);
    }

    function addCategory(title, {icon=''}={}){
      const catId = uid('cat'); const accId = uid('acc');
      const card = h('div','mb-3'); const iconHtml = icon ? `<i class="${FreeTop.getFaClass(host)} ${icon} me-2" style="color:${THEME_COLOR};"></i>` : '';
      card.innerHTML = `
        <div class="d-flex align-items-center mb-2" style="gap:.5rem;">
          <div class="fw-bold fs-5" style="letter-spacing:1px;">${iconHtml}${t(title)}</div>
          <div class="ms-auto qa-admin"><button type="button" class="btn btn-outline-dark btn-sm qa-cat-del">刪除類別</button></div>
        </div>
        <div class="qa-holders">
          <div class="accordion mb-3 qa-acc-wrap" id="${accId}"></div>
          <div class="qa-card-wrap"></div>
        </div>`;
      catsWrap.appendChild(card);
      const ref = { id:catId, node:card, title, icon, accId, cardFirst:false };
      state.categories.push(ref);

      const del = card.querySelector('.qa-cat-del');
      if (del) del.addEventListener('click', ()=>{ const i=state.categories.indexOf(ref); if(i>-1) state.categories.splice(i,1); card.remove(); });

      if (state.mode==='USER') lockAsUser(card);
      return ref;
    }

    function addAccordion(catNode, accId, title){
      const acc = catNode.querySelector('#'+CSS.escape(accId));
      const hid = uid('heading'), cid = uid('collapse');
      const item = h('div','accordion-item mb-2'); item.style.border='none';
      item.innerHTML = `
        <h2 class="accordion-header" id="${hid}">
          <button class="accordion-button bg-danger text-white fw-bold rounded collapsed px-3 py-2"
            type="button" data-bs-toggle="collapse" data-bs-target="#${cid}"
            aria-expanded="false" aria-controls="${cid}">${t(title)}</button>
        </h2>
        <div id="${cid}" class="accordion-collapse collapse" aria-labelledby="${hid}" data-bs-parent="#${accId}">
          <div class="accordion-body bg-light pt-2 pb-3 px-2">
            ${commonToolbar('acc')}
            <div class="qa-content"></div>
          </div>
        </div>`;
      acc.appendChild(item);
      if (state.mode==='USER') lockAsUser(item);
      return { id: cid, node: item, kind:'accordion' };
    }

    function addCard(catNode, title){
      const wrap = catNode.querySelector('.qa-card-wrap');
      const id = uid('card');
      const item = h('div','card mb-3 qa-card-item');
      item.innerHTML = `
        <div class="card-header bg-danger text-white fw-bold px-3 py-2">${t(title)}</div>
        <div class="card-body bg-light pt-2 pb-3 px-2">
          ${commonToolbar('card')}
          <div class="qa-content"></div>
        </div>`;
      wrap.appendChild(item);
      if (state.mode==='USER') lockAsUser(item);
      return { id, node:item, kind:'card' };
    }

    function commonToolbar(scope){
      return `
        <div class="d-flex flex-wrap align-items-center gap-2 mb-2 qa-admin">
          <div class="d-flex flex-wrap align-items-center gap-2">
            <button type="button" class="btn btn-outline-danger btn-sm qa-insert-sub">插入標題</button>
            <button type="button" class="btn btn-outline-danger btn-sm qa-insert-li">插入項目</button>
            <button type="button" class="btn btn-outline-danger btn-sm qa-insert-table">插入表格</button>
            <button type="button" class="btn btn-outline-secondary btn-sm qa-insert-remark">新增備註</button>
          </div>
          <div class="ms-auto">
            ${scope==='acc'
              ? `<button type="button" class="btn btn-outline-dark btn-sm qa-acc-del">刪除手風琴</button>`
              : `<button type="button" class="btn btn-outline-dark btn-sm qa-card-del">刪除卡片</button>`
            }
          </div>
        </div>`;
    }

    // ===== 事件：輸入/鍵盤/點擊 =====
    host.addEventListener('input', (e)=>{
      if (e.target.classList.contains('qa-remark-text')){
        const r=e.target.closest('.qa-block-remark'); const txt=(e.target.textContent||'').trim(); r.style.display = txt ? '' : 'none';
        const root=e.target.closest('.qa-content'); if (root) ensureRemarkAtBottom(root);
      }
    });

    host.addEventListener('keydown', (e)=>{
      if (e.key!=='Enter' || state.mode!=='ADMIN') return;
      if (e.target.classList.contains('qa-sub')){
        const txt=(e.target.textContent||'').trim(); if(!txt){ e.preventDefault(); e.target.closest('.qa-block-sub')?.remove(); }
      }
      if (e.target.tagName==='LI'){
        const txt=(e.target.textContent||'').trim(); if(!txt){ e.preventDefault();
          const ul=e.target.closest('ul'); e.target.remove(); if(ul && !ul.querySelector('li')) ul.closest('.qa-block-list')?.remove();
        }
      }
    });

    host.addEventListener('blur', (e)=>{
      if (state.mode!=='ADMIN') return;
      if (e.target.classList && e.target.classList.contains('qa-sub')){
        const w=e.target.closest('.qa-block-sub'); if (w && !e.target.textContent.trim()) w.remove();
      }
      if (e.target.tagName==='LI'){
        const ul=e.target.closest('ul'); if (!e.target.textContent.trim()){ e.target.remove(); if(ul && !ul.querySelector('li')) ul.closest('.qa-block-list')?.remove(); }
      }
    }, true);

    host.addEventListener('click', (e)=>{
      // 內容編輯
      if (e.target.classList.contains('qa-insert-sub'))    { const blk=e.target.closest('.accordion-item, .qa-card-item'); insertSubheading(state, blk, '請輸入副標'); return; }
      if (e.target.classList.contains('qa-insert-li'))     { const blk=e.target.closest('.accordion-item, .qa-card-item'); insertListItem(state, blk, '請輸入項目'); return; }
      if (e.target.classList.contains('qa-insert-table'))  { const blk=e.target.closest('.accordion-item, .qa-card-item'); insertTable(state, blk, {}); return; }
      if (e.target.classList.contains('qa-insert-remark')) { const blk=e.target.closest('.accordion-item, .qa-card-item'); insertRemark(state, blk, '請輸入備註'); return; }

      // 刪除
      if (e.target.classList.contains('qa-acc-del'))  { e.target.closest('.accordion-item')?.remove(); return; }
      if (e.target.classList.contains('qa-card-del')) { e.target.closest('.qa-card-item')?.remove(); return; }
    });

    // 模式切換
    function lockAsUser(scope){ (scope||host).querySelectorAll('.qa-admin').forEach(n=> n.style.display='none'); (scope||host).querySelectorAll('[contenteditable="true"]').forEach(td=> td.setAttribute('contenteditable','false')); host.setAttribute('data-mode','USER'); }
    function unlockAsAdmin(scope){ (scope||host).querySelectorAll('.qa-admin').forEach(n=> n.style.display=''); (scope||host).querySelectorAll('.qa-sub, li, th, td, .qa-remark-text').forEach(el=>{ if (el.closest('.tap-qualify')) el.setAttribute('contenteditable','true'); }); host.setAttribute('data-mode','ADMIN'); }
    if (state.mode==='USER') lockAsUser();

    // JSON：序列化/還原（支援 kind 與新表格 cols）
    function getJSON(){
      const categories = state.categories.map(c=>{
        const card = c.node, items=[];
        // 手風琴
        card.querySelectorAll('.qa-acc-wrap .accordion-item').forEach(item=>{
          items.push({ kind:'accordion', title: item.querySelector('.accordion-button')?.textContent.trim()||'', blocks: readBlocks(item.querySelector('.qa-content')) });
        });
        // 卡片
        card.querySelectorAll('.qa-card-wrap .qa-card-item').forEach(item=>{
          items.push({ kind:'card', title: item.querySelector('.card-header')?.textContent.trim()||'', blocks: readBlocks(item.querySelector('.qa-content')) });
        });
        // 按實際 DOM 順序重排
        const order = []; card.querySelectorAll('.qa-card-item, .accordion-item').forEach(n=>{
          const title = n.classList.contains('qa-card-item') ? n.querySelector('.card-header')?.textContent.trim()||'' : n.querySelector('.accordion-button')?.textContent.trim()||'';
          const kind  = n.classList.contains('qa-card-item') ? 'card' : 'accordion';
          const found = items.find(x=> x.kind===kind && x.title===title && !x._taken);
          if (found){ found._taken=true; order.push({kind:found.kind,title:found.title,blocks:found.blocks}); }
        });
        order.forEach(o=> delete o._taken);
        return { title:c.title, icon:c.icon, cardFirst: !!c.cardFirst, items: order };
      });
      return { schemaVersion: 3, updatedAt: Date.now(), categories };

      function readBlocks(root){
        const out=[]; if(!root) return out;
        Array.from(root.children).forEach(child=>{
          if (child.classList.contains('qa-block-sub')){
            out.push({ type:'subheading', text:(child.querySelector('.qa-sub')?.textContent||'').trim() });
          } else if (child.classList.contains('qa-block-list')){
            const ul=child.querySelector('ul'); const arr = ul? Array.from(ul.querySelectorAll('li')).map(li=> (li.textContent||'').trim()) : [];
            out.push({ type:'list', items:arr });
          } else if (child.classList.contains('qa-block-table')){
            const table = child.querySelector('table'); const thead = table.querySelectorAll('thead th');
            const cols = []; thead.forEach((th,i)=>{ const txt=(th.querySelector('.qa-head-text')?.textContent || th.textContent || '').trim(); cols.push({ head:txt, width:0 }); });
            const cg = table.querySelectorAll('colgroup col'); cg.forEach((c,i)=> cols[i] && (cols[i].width = parseInt((c.style.width||'').replace('%',''))||0));
            const rows=[]; table.querySelectorAll('tbody tr').forEach(tr=>{ rows.push(Array.from(tr.querySelectorAll('td')).map(td=> td.textContent.trim())); });
            out.push({ type:'table', cols, rows });
          } else if (child.classList.contains('qa-block-remark')){
            out.push({ type:'remark', text:(child.querySelector('.qa-remark-text')?.textContent||'').trim() });
          }
        });
        return out;
      }
    }

    function setJSON(data={}){
      catsWrap.innerHTML=''; state.categories=[];
      (data.categories||[]).forEach(cat=>{
        const ref = addCategory(cat.title||'未命名類別', { icon:cat.icon||'' });
        ref.cardFirst = !!cat.cardFirst; applyOrder(ref);

        (cat.items||[]).forEach(it=>{
          const kind = it.kind || 'accordion';
          const holder = (kind==='card')
            ? addCard(ref.node, it.title||'未命名卡片')
            : addAccordion(ref.node, ref.accId, it.title||'未命名手風琴');
          (it.blocks||[]).forEach(b=>{
            if (b.type==='subheading') insertSubheading(state, holder, b.text||'');
            else if (b.type==='list' && Array.isArray(b.items)) b.items.forEach(x=> insertListItem(state, holder, x||''));
            else if (b.type==='table'){
              if (Array.isArray(b.cols)) insertTable(state, holder, { cols:b.cols, rows:b.rows||[] });
              else insertTable(state, holder, { headLeft:b.headLeft, headRight:b.headRight, leftWidth:b.leftWidth, rightWidth:b.rightWidth, rows:b.rows||[] });
            } else if (b.type==='remark') insertRemark(state, holder, b.text||'');
          });
          const root = findContentRoot(holder); if (root) ensureRemarkAtBottom(root);
        });
      });
      if (state.mode==='USER') lockAsUser();
    }

    function setMode(next){ const v=String(next||'USER').toUpperCase()==='ADMIN'?'ADMIN':'USER'; state.mode=v; if(v==='USER') lockAsUser(); else unlockAsAdmin(); }

    const api = { setJSON, getJSON, setMode,
      // 也保留外部插入器
      addCategory: (title,opts)=> addCategory(title,opts),
      addAccordion: (catRef,title)=>{ const ref = (catRef&&catRef.node)?catRef : state.categories.find(c=>c.id===catRef||c.node===catRef); if(!ref) return null; return addAccordion(ref.node, ref.accId, title); },
      addCard: (catRef,title)=>{ const ref = (catRef&&catRef.node)?catRef : state.categories.find(c=>c.id===catRef||c.node===catRef); if(!ref) return null; return addCard(ref.node, title); }
    };

    host._tap_qualify = api;
    return api;
  }

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
