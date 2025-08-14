/*!
 * FreeAccordion.js — TAP Qualify Plugin
 * v1.0.0
 * 自動 ADMIN/USER 判定、類別(大標題+icon)、手風琴、多型內容（副標/清單/雙欄表格/備註）
 * Class 完全沿用你的現有 HTML/CSS。
 */

(function (global) {
  'use strict';

  // ===================== Config & Utils =====================
  const DEFAULT_FA  = global.TAP_SUBJECTS_FA_CLASS || 'fa-solid'; // 預設用 FA6
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

  // 模式自動判定（與 FreeTable 一致）
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

  // ===================== Icon Picker (minimal) =====================
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

  // ===================== Core: mount() =====================
  function mount(target, opts={}){
    const host = (typeof target==='string') ? document.querySelector(target) : target;
    if (!host) return null;
    if (host._tap_qualify) return host._tap_qualify;

    const mode    = resolveMode(host, opts, global);
    const faClass = host.dataset.fa || opts.faClass || DEFAULT_FA;

    const state = {
      id: uid('qa'),
      mode,               // 'ADMIN' | 'USER'
      categories: []      // [{id, title, icon, accId}]
    };

    // 容器
    host.innerHTML = '';
    host.classList.add('tap-qualify');
    host.setAttribute('data-mode', state.mode);

    // ===== Admin：「新增類別區塊」 =====
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

    // ===== 類別容器 =====
    const catsWrap = h('div','qa-categories');
    host.appendChild(catsWrap);

    // ===== 生成「類別」 =====
    function addCategory(title, { icon='' } = {}){
      const catId = uid('cat');
      const accId = uid('acc');

      // 大標題（含圖示）+ 內層 accordion 容器
      const card = h('div','mb-3');
      const iconHtml = icon ? `<i class="${faClass} ${icon} me-2" style="color:${THEME_COLOR};"></i>` : '';
      card.innerHTML = `
        <div class="mb-3 fw-bold fs-5" style="letter-spacing:1px;">
          ${iconHtml}${t(title)}
        </div>

        <!-- 管理：新增手風琴 -->
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

      // 記錄
      state.categories.push({ id: catId, node: card, title, icon, accId });

      // 綁新增手風琴
      const addBtn = card.querySelector('.qa-acc-add');
      if (addBtn) addBtn.addEventListener('click', ()=>{
        const titleInput = card.querySelector('.qa-acc-title');
        const ttl = (titleInput.value||'').trim() || '未命名手風琴';
        addAccordion(card, accId, ttl); // append
        titleInput.value = '';
      });

      if (state.mode==='USER') lockAsUser(card);

      // 對外回傳 category 物件
      return { id: catId, node: card, accId };
    }

    // ===== 生成「手風琴項目」 =====
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
            <!-- 管理工具列 -->
            <div class="d-flex flex-wrap gap-2 mb-2 qa-admin">
              <button type="button" class="btn btn-outline-danger btn-sm qa-insert-sub">插入標題</button>
              <button type="button" class="btn btn-outline-danger btn-sm qa-insert-li">插入項目</button>
              <button type="button" class="btn btn-outline-danger btn-sm qa-insert-table">插入表格(雙欄)</button>
              <button type="button" class="btn btn-outline-secondary btn-sm qa-insert-remark">新增備註</button>
            </div>
            <!-- 內容將 append 在下方 -->
            <div class="qa-content"></div>
          </div>
        </div>
      `;
      acc.appendChild(item);

      if (state.mode==='USER') lockAsUser(item);

      return { id: cid, node: item };
    }

    // ===== 內容插入：副標 / 清單 / 表格 / 備註 =====
    function findContentRoot(accObj){
      const el = (accObj && accObj.node) ? accObj.node : accObj;
      return el.querySelector('.qa-content');
    }

    function insertSubheading(accObj, text){
      const root = findContentRoot(accObj); if(!root) return null;
      const el = h('div','fw-bold text-danger mb-2');
      el.contentEditable = (state.mode==='ADMIN');
      el.textContent = t(text || '請輸入副標');
      root.appendChild(el);
      return el;
    }

    function insertListItem(accObj, text){
      const root = findContentRoot(accObj); if(!root) return null;
      let ul = root.querySelector('ul');
      if (!ul) { ul = document.createElement('ul'); ul.className='mb-2'; root.appendChild(ul); }
      const li = document.createElement('li');
      li.contentEditable = (state.mode==='ADMIN');
      li.textContent = t(text || '請輸入項目');
      ul.appendChild(li);
      return li;
    }

    function insertTable(accObj, { headLeft='欄1', headRight='欄2', leftWidth=50, rightWidth=50 } = {}){
      const root = findContentRoot(accObj); if(!root) return null;
      const wrap = h('div','table-responsive qa-table-wrap mb-2');

      const tableId = uid('tbl');
      wrap.innerHTML = `
        <div class="d-flex align-items-center gap-2 mb-2 qa-admin">
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
          <button type="button" class="btn btn-outline-dark btn-sm qa-tbl-del">刪除表格</button>
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
      root.appendChild(wrap);
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
      let r = root.querySelector('.qa-remark');
      if (!r) {
        r = h('div','small text-muted mt-2 qa-remark');
        r.innerHTML = `※ <span class="qa-remark-text" ${state.mode==='ADMIN'?'contenteditable="true"':''}></span>`;
        root.appendChild(r);
      }
      const span = r.querySelector('.qa-remark-text');
      span.textContent = t(text || '');
      toggleRemarkVisibility(r);
      return r;
    }
    function toggleRemarkVisibility(r){
      const txt = (r.querySelector('.qa-remark-text')?.textContent || '').trim();
      r.style.display = txt ? '' : 'none';
    }

    // ===== 事件委派（單一綁定）=====
    host.addEventListener('input', (e)=>{
      // remark 即時隱藏/顯示
      if (e.target.classList.contains('qa-remark-text')) {
        const r = e.target.closest('.qa-remark');
        if (r) toggleRemarkVisibility(r);
      }
      // 表格欄寬
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
    host.addEventListener('click', (e)=>{
      // 內容插入按鈕（在手風琴 body 的工具列）
      if (e.target.classList.contains('qa-insert-sub')) {
        const acc = e.target.closest('.accordion-item');
        insertSubheading(acc, '請輸入副標');
        return;
      }
      if (e.target.classList.contains('qa-insert-li')) {
        const acc = e.target.closest('.accordion-item');
        insertListItem(acc, '請輸入項目');
        return;
      }
      if (e.target.classList.contains('qa-insert-table')) {
        const acc = e.target.closest('.accordion-item');
        insertTable(acc, {});
        return;
      }
      if (e.target.classList.contains('qa-insert-remark')) {
        const acc = e.target.closest('.accordion-item');
        insertRemark(acc, '');
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
        const w = e.target.closest('.qa-table-wrap'); if (w) w.remove(); return;
      }
    });

    // ===== Mode Lock =====
    function lockAsUser(scope){
      (scope||host).querySelectorAll('.qa-admin').forEach(n=> n.style.display='none');
      (scope||host).querySelectorAll('[contenteditable="true"]').forEach(td=> td.setAttribute('contenteditable','false'));
      host.setAttribute('data-mode','USER');
    }
    function unlockAsAdmin(scope){
      (scope||host).querySelectorAll('.qa-admin').forEach(n=> n.style.display='');
      (scope||host).querySelectorAll('[contenteditable="false"]').forEach(td=>{
        if (td.matches('th,td,li,div.fw-bold.text-danger.mb-2,.qa-remark-text')) td.setAttribute('contenteditable','true');
      });
      host.setAttribute('data-mode','ADMIN');
    }
    if (state.mode==='USER') lockAsUser();

    // ===== 序列化 / 還原 =====
    function getJSON(){
      const categories = state.categories.map(c=>{
        const card = c.node;
        const acc  = card.querySelector('#'+CSS.escape(c.accId));
        const items = [];
        acc.querySelectorAll('.accordion-item').forEach(item=>{
          const title = item.querySelector('.accordion-button')?.textContent.trim() || '';
          const content = item.querySelector('.qa-content');
          const blocks = [];
          // 副標
          content.querySelectorAll('.fw-bold.text-danger.mb-2').forEach(el=>{
            blocks.push({ type:'subheading', text: (el.textContent||'').trim() });
          });
          // 清單
          const ul = content.querySelector('ul');
          if (ul) {
            const arr = Array.from(ul.querySelectorAll('li')).map(li => (li.textContent||'').trim());
            if (arr.length) blocks.push({ type:'list', items: arr });
          }
          // 表格（可多個）
          content.querySelectorAll('.qa-table-wrap').forEach(w=>{
            const table = w.querySelector('table');
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
          });
          // 備註
          const r = content.querySelector('.qa-remark .qa-remark-text');
          const remark = r ? (r.textContent||'').trim() : '';

          items.push({ title, blocks, remark });
        });

        return { title:c.title, icon:c.icon, items };
      });
      return { schemaVersion: 1, updatedAt: Date.now(), categories };
    }

    function setJSON(data={}){
      catsWrap.innerHTML = ''; state.categories = [];
      (data.categories||[]).forEach(cat=>{
        const ref = addCategory(cat.title||'未命名類別', { icon: cat.icon||'' });
        (cat.items||[]).forEach(it=>{
          const acc = addAccordion(ref.node, ref.accId, it.title||'未命名手風琴');
          // blocks
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
            }
          });
          if (t(it.remark)) insertRemark(acc, it.remark);
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

    // ===== 對外 API =====
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

  // ===================== Autoload =====================
  function autoload(){
    document.querySelectorAll('[data-tap-plugin="qualify"]').forEach(node=>{
      if (node._tap_qualify) return;
      mount(node, {});
    });
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', autoload);
  else autoload();

  // export
  global.TAPQualifyKit = { mount };

})(window);
