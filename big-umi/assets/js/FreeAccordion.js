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

  // ===== 設定（顏色、工具）=====
  const THEME_COLOR = 'var(--main-red)'; // 統一主題紅
  let   INST = 0;
  const uid  = (p='qa') => `${p}-${++INST}-${Math.random().toString(36).slice(2,8)}`;
  const $all = (root, sel)=> Array.from((root instanceof Element?root:document).querySelectorAll(sel));
  const t    = (s)=> (s==null ? '' : String(s));
  const h    = (tag, cls, html)=>{ const el=document.createElement(tag); if(cls) el.className=cls; if(html!=null) el.innerHTML=html; return el; };
  const insertAfter = (newNode, refNode)=> refNode.parentNode.insertBefore(newNode, refNode.nextSibling);

  // ===== 主掛載 =====
  function mount(target, opts={}){
    const host = (typeof target==='string') ? document.querySelector(target) : target;
    if (!host) return null;
    if (host._tap_qualify) return host._tap_qualify;

    // 改用 FreeTop 的統一判定/參數
    const mode    = FreeTop.resolveMode(host, opts, global);        // 'ADMIN' | 'USER'
    const faClass = FreeTop.getFaClass(host, opts, global);         // 預設 'fas'（FA5）

    const state = { id: uid('qa'), mode, categories: [] };

    host.innerHTML = '';
    host.classList.add('tap-qualify');
    host.setAttribute('data-mode', state.mode);

    // ===== Admin：新增「類別」控制面板 =====
    let cfg = null;
    if (state.mode === 'ADMIN') {
      cfg = h('div','card mb-3 qa-admin');
      const cid = state.id;

      // 改用 FreeTop.iconPicker（單一 icon 清單；FA5 名稱）
      const ip = FreeTop.iconPicker({
        faClass,
        value: '',
        icons: FreeTop.getIconSet(), // 內建常用清單（含 '' = 無）
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

    // 類別容器
    const catsWrap = h('div','qa-categories');
    host.appendChild(catsWrap);

    // ===== 建立類別卡片 =====
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

    // ===== 在某類別下新增手風琴 =====
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

    // ===== 內容小工具 =====
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

    // 清單項目插入到「最後一個副標後」的清單；若無副標，放在備註上方
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

      // 表格插在備註上方；若無備註則 append
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

    // ===== 事件委派 =====
    host.addEventListener('input', (e)=>{
      // 備註空字自動隱藏（並固定在底部）
      if (e.target.classList.contains('qa-remark-text')) {
        const r = e.target.closest('.qa-block-remark');
        const txt = (e.target.textContent||'').trim();
        r.style.display = txt ? '' : 'none';
        const root = e.target.closest('.qa-content');
        if (root) ensureRemarkAtBottom(root);
      }
      // 即時調整表格欄寬
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

    // 空行 Enter 刪除（副標 / 清單項目）
    host.addEventListener('keydown', (e)=>{
      if (e.key !== 'Enter') return;
      if (state.mode !== 'ADMIN') return;

      // 副標
      if (e.target.classList.contains('qa-sub')) {
        const txt = (e.target.textContent||'').trim();
        if (!txt) {
          e.preventDefault();
          const wrap = e.target.closest('.qa-block-sub');
          if (wrap) wrap.remove();
        }
      }
      // 清單項目
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

    // 失焦也清空空白節點
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

    // 其他按鈕
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

      // 表格工具
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

    // ===== JSON serialize/restore =====
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

  // ===== 自動掛載（加上前台自動吃資料）=====
  function autoload(){
    document.querySelectorAll('[data-tap-plugin="qualify"]').forEach(node=>{
      if (node._tap_qualify) return;
      const api = mount(node, {});
      // 新增：自動從 data-json-var / data-json-script / data-json-local 載入
      FreeTop.applyInitialJSON(node, api);
    });
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', autoload);
  else autoload();

  // 對外 API
  global.TAPQualifyKit = { mount };

})(window);
