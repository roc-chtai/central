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

(function(global){
  'use strict';

  // ======= 基本設定 =======
  const THEME_COLOR = 'var(--main-red, #ea7066)';

  // 小工具
  const t = s => s==null ? '' : String(s);
  const $all = (root, sel)=> Array.from((root instanceof Element?root:document).querySelectorAll(sel));
  const h = (tag, cls, html)=>{ const el=document.createElement(tag); if(cls) el.className=cls; if(html!=null) el.innerHTML=html; return el; };
  let INST = 0;
  const uid = (p='qa') => `${p}-${++INST}-${Math.random().toString(36).slice(2,8)}`;

  // 將某節點移到容器最後（保持 remark 置底等）
  const insertAfter = (newNode, refNode)=> refNode.parentNode.insertBefore(newNode, refNode.nextSibling);

  // ======= 內容區塊共用：插入元件 =======
  /** 找到區塊的內容根節點 */
  function findContentRoot(blockEl){
    return blockEl.querySelector('.qa-content');
  }

  /** 讓備註永遠在最底 */
  function ensureRemarkAtBottom(root){
    const r = root.querySelector('.qa-block-remark');
    if (r) root.appendChild(r);
  }

  /** 找到最後一個可以插「副標」的錨點（非表格/非備註） */
  function findLastNonTableNonRemark(root){
    const blocks = Array.from(root.children);
    for (let i=blocks.length-1;i>=0;i--){
      const b = blocks[i];
      if (!b.classList.contains('qa-block-table') && !b.classList.contains('qa-block-remark')) return b;
    }
    return null;
  }

  /** 插入「副標」 */
  function insertSubheading(blockEl, text, editable){
    const root = findContentRoot(blockEl); if(!root) return null;
    const wrap = h('div','qa-block qa-block-sub mb-2');
    const el = h('div','fw-bold text-danger mb-0 qa-sub');
    el.contentEditable = !!editable;
    el.textContent = t(text || '請輸入副標');
    wrap.appendChild(el);

    const anchor = findLastNonTableNonRemark(root);
    if (anchor) insertAfter(wrap, anchor);
    else root.insertBefore(wrap, root.firstChild);

    el.focus();
    ensureRemarkAtBottom(root);
    return wrap;
  }

  /** 插入「清單項目」（會接在最後一個副標的清單之後；沒有副標就放備註上方） */
  function insertListItem(blockEl, text, editable){
    const root = findContentRoot(blockEl); if(!root) return null;
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
    li.contentEditable = !!editable;
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

  /** 插入「備註」（單一個，空字時自動隱藏） */
  function insertRemark(blockEl, text, editable){
    const root = findContentRoot(blockEl); if(!root) return null;
    let w = root.querySelector('.qa-block-remark');
    if (!w) {
      w = h('div','qa-block qa-block-remark small text-muted mt-2');
      w.innerHTML = `※ <span class="qa-remark-text" ${editable?'contenteditable="true"':''}></span>`;
      root.appendChild(w);
    }
    const span = w.querySelector('.qa-remark-text');
    span.textContent = t(text || '請輸入備註');
    w.style.display = '';
    ensureRemarkAtBottom(root);
    span.focus();
    return w;
  }

  /** 插入「動態表格」（可 +列/–列、+欄/–欄；thead 可編輯欄名；等寬配置） */
  function insertFlexTable(blockEl, { cols=2, rows=1, editable } = {}){
    const root = findContentRoot(blockEl); if(!root) return null;
    cols = Math.max(1, Math.min(8, parseInt(cols)||2));
    rows = Math.max(1, Math.min(50, parseInt(rows)||1));

    const wrap = h('div','qa-block qa-block-table mb-2');
    const panel = h('div','qa-admin d-flex align-items-center gap-2 mb-2');
    panel.innerHTML = `
      <div class="d-flex align-items-center gap-2 flex-wrap">
        <span class="small text-muted">欄位：</span>
        <button type="button" class="btn btn-outline-danger btn-sm qa-tbl-addcol">+ 欄</button>
        <button type="button" class="btn btn-outline-secondary btn-sm qa-tbl-delcol">- 欄</button>
        <span class="small text-muted ms-2">列：</span>
        <button type="button" class="btn btn-outline-danger btn-sm qa-tbl-addrow">+ 列</button>
        <button type="button" class="btn btn-outline-secondary btn-sm qa-tbl-delrow">- 列</button>
      </div>
      <div class="ms-auto">
        <button type="button" class="btn btn-outline-dark btn-sm qa-tbl-del">刪除表格</button>
      </div>
    `;
    const tableWrap = h('div','table-responsive qa-table-wrap mb-2');
    const table = h('table','table table-bordered align-middle small mb-0');

    const cg = document.createElement('colgroup');
    const thead = h('thead','table-danger'); const thr = document.createElement('tr');
    const tbody = document.createElement('tbody');

    // 產欄
    const applyColCount = (n)=>{
      cg.innerHTML=''; thr.innerHTML='';
      const width = Math.round(100 / n);
      for (let i=0;i<n;i++){
        const col = document.createElement('col');
        col.style.width = width + '%';
        cg.appendChild(col);

        const th = document.createElement('th');
        th.contentEditable = !!editable;
        th.textContent = `欄${i+1}`;
        thr.appendChild(th);
      }
      // 調整每列的 cell 數
      Array.from(tbody.querySelectorAll('tr')).forEach(tr=>{
        while(tr.children.length > n) tr.removeChild(tr.lastElementChild);
        while(tr.children.length < n){
          const td = document.createElement('td');
          td.contentEditable = !!editable;
          td.spellcheck = false;
          tr.appendChild(td);
        }
      });
    };

    // 產列
    const addRow = ()=>{
      const n = thr.children.length || cols;
      const tr = document.createElement('tr');
      for (let i=0;i<n;i++){
        const td = document.createElement('td');
        td.contentEditable = !!editable;
        td.spellcheck = false;
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    };

    table.appendChild(cg);
    thead.appendChild(thr); table.appendChild(thead);
    table.appendChild(tbody);
    tableWrap.appendChild(table);
    wrap.appendChild(panel); wrap.appendChild(tableWrap);

    applyColCount(cols);
    for (let r=0;r<rows;r++) addRow();

    // 事件（此表格作用域）
    panel.addEventListener('click', (e)=>{
      if (e.target.classList.contains('qa-tbl-addcol')){
        applyColCount( (thr.children.length||1) + 1 ); return;
      }
      if (e.target.classList.contains('qa-tbl-delcol')){
        const n = (thr.children.length||1);
        if (n>1) applyColCount(n-1);
        return;
      }
      if (e.target.classList.contains('qa-tbl-addrow')){
        addRow(); return;
      }
      if (e.target.classList.contains('qa-tbl-delrow')){
        const rows = tbody.querySelectorAll('tr');
        if (rows.length) rows[rows.length-1].remove();
        return;
      }
      if (e.target.classList.contains('qa-tbl-del')){
        wrap.remove(); return;
      }
    });

    // 插入到 remark 上方（若有）
    const remark = root.querySelector('.qa-block-remark');
    if (remark) root.insertBefore(wrap, remark); else root.appendChild(wrap);
    ensureRemarkAtBottom(root);
    return wrap;
  }

  // ======= 兩種內容區塊：手風琴 / 卡片 =======
  /** 建立共同的「灰色工具列」HTML（依容器類型帶入 data-target） */
  function buildAdminToolbar(){
    return `
      <div class="d-flex flex-wrap align-items-center gap-2 mb-2 qa-admin">
        <div class="d-flex flex-wrap align-items-center gap-2">
          <button type="button" class="btn btn-outline-danger btn-sm qa-insert-sub">插入標題</button>
          <button type="button" class="btn btn-outline-danger btn-sm qa-insert-li">插入項目</button>
          <button type="button" class="btn btn-outline-danger btn-sm qa-insert-table">插入表格</button>
          <button type="button" class="btn btn-outline-secondary btn-sm qa-insert-remark">新增備註</button>
        </div>
        <div class="ms-auto">
          <button type="button" class="btn btn-outline-dark btn-sm qa-block-del">刪除</button>
        </div>
      </div>`;
  }

  /** 新增「手風琴區塊」 */
  function createAccordionBlock(title, { editable }){
    const hid = uid('heading');
    const cid = uid('collapse');
    const wrap = h('div','qa-item qa-type-accordion mb-3');
    wrap.innerHTML = `
      <div class="accordion-item mb-2" style="border:none;">
        <h2 class="accordion-header" id="${hid}">
          <button class="accordion-button bg-danger text-white fw-bold rounded collapsed px-3 py-2"
            type="button" data-bs-toggle="collapse" data-bs-target="#${cid}"
            aria-expanded="false" aria-controls="${cid}">${t(title)}</button>
        </h2>
        <div id="${cid}" class="accordion-collapse collapse" aria-labelledby="${hid}">
          <div class="accordion-body bg-light pt-2 pb-3 px-2">
            ${buildAdminToolbar()}
            <div class="qa-content"></div>
          </div>
        </div>
      </div>
    `;
    // 在 USER 模式時關閉工具列與編輯
    if (!editable) {
      wrap.querySelectorAll('.qa-admin').forEach(n=> n.style.display='none');
      wrap.querySelectorAll('[contenteditable="true"]').forEach(td=> td.setAttribute('contenteditable','false'));
    }
    return wrap;
  }

  /** 新增「卡片區塊」（年齡限制卡版型） */
  function createCardBlock(title, { editable }){
    const wrap = h('div','qa-item qa-type-card mb-3');
    wrap.innerHTML = `
      <div class="card mb-2">
        <div class="card-header bg-white border-bottom border-danger fw-bold">
          ${t(title)}
        </div>
        <div class="card-body bg-light pt-2 pb-3 px-2">
          ${buildAdminToolbar()}
          <div class="qa-content"></div>
        </div>
      </div>
    `;
    if (!editable) {
      wrap.querySelectorAll('.qa-admin').forEach(n=> n.style.display='none');
      wrap.querySelectorAll('[contenteditable="true"]').forEach(td=> td.setAttribute('contenteditable','false'));
    }
    return wrap;
  }

  // ======= 主掛載 =======
  function mount(target, opts={}){
    const host = (typeof target==='string') ? document.querySelector(target) : target;
    if (!host) return null;
    if (host._tap_accordion) return host._tap_accordion;

    // 模式與 FA 類別
    const mode    = FreeTop.resolveMode(host, opts, global);
    const faClass = FreeTop.getFaClass(host, opts, global); // 預設 'fas'

    // 狀態
    const state = { id: uid('qa'), mode, categories: [] };

    // 佈局
    host.innerHTML = '';
    host.classList.add('tap-qualify');
    host.setAttribute('data-mode', state.mode);

    // ===== Admin：新增類別 =====
    let cfgCat = null;
    if (state.mode==='ADMIN'){
      cfgCat = h('div','card mb-3 qa-admin');
      const cid = state.id;

      const ip = FreeTop.iconPicker({
        faClass, value:'', icons: FreeTop.getIconSet(),
        prefix:'qa', themeVar:'--main-red', fallback:'#ea7066'
      });

      cfgCat.innerHTML = `
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
        </div>
      `;
      host.appendChild(cfgCat);
      cfgCat.querySelector(`#${cid}-cat-icon`).appendChild(ip.root);
      cfgCat.querySelector(`#${cid}-cat-add`).addEventListener('click', ()=>{
        const title = (cfgCat.querySelector(`#${cid}-cat-title`).value||'').trim() || '未命名類別';
        const icon  = ip.get() || '';
        addCategory(title, { icon });
        cfgCat.querySelector(`#${cid}-cat-title`).value = '';
      });
    }

    // 類別容器
    const catsWrap = h('div','qa-categories');
    host.appendChild(catsWrap);

    // ===== 類別卡片 =====
    function addCategory(title, { icon='' } = {}){
      const catId = uid('cat');
      const card = h('div','mb-3 qa-category');
      const iconHtml = icon ? `<i class="${faClass} ${icon} me-2" style="color:${THEME_COLOR};"></i>` : '';
      card.innerHTML = `
        <div class="d-flex align-items-center mb-2" style="gap:.5rem;">
          <div class="fw-bold fs-5" style="letter-spacing:1px;">${iconHtml}${t(title)}</div>
          <div class="ms-auto qa-admin d-flex align-items-center gap-2">
            <button type="button" class="btn btn-outline-secondary btn-sm qa-sort-toggle">切換排序（目前：依插入順序）</button>
            <button type="button" class="btn btn-outline-dark btn-sm qa-cat-del">刪除類別</button>
          </div>
        </div>

        <!-- 新增內容區塊 -->
        <div class="card mb-2 qa-admin">
          <div class="card-header bg-white border-bottom border-danger fw-bold">新增內容區塊</div>
          <div class="card-body">
            <div class="d-flex flex-wrap align-items-end gap-2">
              <div class="flex-grow-1" style="max-width:360px;">
                <label class="form-label small mb-1">內容標題</label>
                <input type="text" class="form-control form-control-sm qa-item-title" placeholder="輸入標題...">
              </div>
              <button type="button" class="btn btn-danger btn-sm qa-add-acc">插入手風琴</button>
              <button type="button" class="btn btn-danger btn-sm qa-add-card">插入卡片</button>
            </div>
          </div>
        </div>

        <div class="qa-blocks"></div>
      `;
      catsWrap.appendChild(card);

      const catState = { id:catId, node:card, title, icon, sortMode:'insertion' /* 或 'grouped' */ };
      state.categories.push(catState);

      // 刪除類別
      const delBtn = card.querySelector('.qa-cat-del');
      if (delBtn) delBtn.addEventListener('click', ()=>{
        const idx = state.categories.findIndex(c=>c.node===card);
        if (idx>-1) state.categories.splice(idx,1);
        card.remove();
      });

      // 排序切換
      const sortBtn = card.querySelector('.qa-sort-toggle');
      sortBtn?.addEventListener('click', ()=>{
        catState.sortMode = (catState.sortMode==='insertion') ? 'grouped' : 'insertion';
        sortBtn.textContent = `切換排序（目前：${catState.sortMode==='insertion'?'依插入順序':'手風琴在上'}）`;
        applySort(catState);
      });

      // 新增內容：手風琴 / 卡片
      const blocksWrap = card.querySelector('.qa-blocks');
      const titleInp   = card.querySelector('.qa-item-title');

      card.querySelector('.qa-add-acc')?.addEventListener('click', ()=>{
        const title = (titleInp.value||'').trim() || '未命名手風琴';
        const blk = createAccordionBlock(title, { editable: state.mode==='ADMIN' });
        blocksWrap.appendChild(blk);
        titleInp.value = '';
        applySort(catState);
      });

      card.querySelector('.qa-add-card')?.addEventListener('click', ()=>{
        const title = (titleInp.value||'').trim() || '未命名卡片';
        const blk = createCardBlock(title, { editable: state.mode==='ADMIN' });
        blocksWrap.appendChild(blk);
        titleInp.value = '';
        applySort(catState);
      });

      if (state.mode==='USER') lockAsUser(card);
      return catState;
    }

    /** 依 sortMode 排序一個類別下的區塊 */
    function applySort(catState){
      const wrap = catState.node.querySelector('.qa-blocks');
      if (!wrap) return;
      if (catState.sortMode==='insertion') return; // 保持 DOM 既有順序

      // grouped：手風琴在上、卡片在下
      const acc = []; const cards = [];
      Array.from(wrap.children).forEach(child=>{
        if (child.classList.contains('qa-type-accordion')) acc.push(child);
        else if (child.classList.contains('qa-type-card')) cards.push
