/*!
 * TAPAccordionKit (Eligibility / Q&A + bottom table + notes)
 * v1.0
 *
 * 使用：
 *   <div data-tap-plugin="eligibility"></div>
 *   // 或手動：TAPAccordionKit.mount('#eligibilityPlugin')
 *
 * 模式自動判定順序：
 *   opts.mode / data-mode
 *   window.TAP_DETECT_MODE()        // 建議提供，回傳 'ADMIN' 或 'USER'
 *   window.XOOPS_IS_ADMIN === true  // XOOPS 時可用
 *   window.MODE                     // 若你只設 MODE 常數也會吃
 *   預設 'USER'
 */

(function (global) {
  'use strict';

  // ---------- 基本設定 ----------
  const DEFAULT_FA  = global.TAP_SUBJECTS_FA_CLASS || 'fa-solid'; // FA6 預設
  const THEME_COLOR = 'var(--main-red)';
  const ICON_SET = [
    '', 'fa-book', 'fa-users', 'fa-gavel', 'fa-briefcase', 'fa-stethoscope',
    'fa-flask', 'fa-cog', 'fa-chart-line', 'fa-university', 'fa-user-graduate', 'fa-scale-balanced'
  ];

  // 內建一些極輕量樣式（icon picker / 小刪除鈕）
  if (!document.getElementById('tap-acc-inline-style')) {
    const st = document.createElement('style');
    st.id = 'tap-acc-inline-style';
    st.textContent = `
      .tap-eligibility[data-mode="USER"] .acc-admin { display:none !important; }
      .ta-del { cursor:pointer; user-select:none; }
      .ta-del:hover { opacity:.8; }
      .badge-qa { background:#fff0f0; color:#d03a2f; border:1px solid #f2b7b2; padding:.08rem .35rem; border-radius:.35rem; font-weight:700; font-size:.8rem; }
      .ta-flow .ta-subtitle { font-weight:700; margin:.5rem 0; }
      .ta-flow ul { margin:.25rem 0 .75rem; }
      /* IconPicker（沿用 subjects 插件，不重複注入） */
      .ts-ip-wrap{position:relative; display:inline-block;}
      .ts-ip-btn{display:inline-flex; align-items:center; gap:.4rem;}
      .ts-ip-menu{
        position:absolute; z-index:1050; top:100%; left:0;
        background:#fff; border:1px solid #e9ecef; border-radius:10px;
        box-shadow:0 6px 18px rgba(0,0,0,.08); padding:10px; margin-top:6px;
        width:300px; max-height:260px; overflow:auto;
      }
      .ts-ip-grid{display:grid; grid-template-columns:repeat(6,1fr); gap:8px;}
      .ts-ip-item{
        display:flex; justify-content:center; align-items:center;
        width:44px; height:40px; border:1px solid #eee; border-radius:8px;
        cursor:pointer; transition:.15s;
      }
      .ts-ip-item:hover{transform:translateY(-1px); border-color:#ddd;}
      .ts-ip-item.active{border-color:var(--main-red); box-shadow:0 0 0 2px rgba(234,112,102,.15);}
      .ts-ip-none{font-size:12px; color:#6c757d;}
    `;
    document.head.appendChild(st);
  }

  let INST = 0;
  const makeId = (p='ta') => `${p}-${++INST}-${Math.random().toString(36).slice(2,8)}`;
  const t  = (s)=> (s==null ? '' : String(s));
  const h  = (tag, cls, html)=>{ const el=document.createElement(tag); if(cls) el.className=cls; if(html!=null) el.innerHTML=html; return el; };

  function resolveMode(host, opts, global){
    const explicit = (opts && opts.mode) || (host && host.dataset && host.dataset.mode);
    if (explicit) {
      const v = String(explicit).toUpperCase(); if (v==='ADMIN' || v==='USER') return v;
    }
    if (typeof global.TAP_DETECT_MODE === 'function') {
      const v = String(global.TAP_DETECT_MODE() || '').toUpperCase(); if (v==='ADMIN' || v==='USER') return v;
    }
    if (global.XOOPS_IS_ADMIN === true) return 'ADMIN';
    if (typeof global.MODE === 'string') {
      const v = global.MODE.toUpperCase(); if (v==='ADMIN' || v==='USER') return v;
    }
    return 'USER';
  }

  // ---------- Icon Picker ----------
  function createIconPicker({ faClass=DEFAULT_FA, value='' } = {}) {
    const wrap = h('div','ts-ip-wrap');
    const btn  = h('button','btn btn-outline-secondary btn-sm ts-ip-btn');
    btn.type = 'button';
    btn.innerHTML = value
      ? `<i class="${faClass} ${value}" style="color:${THEME_COLOR};"></i><span>更換圖示</span>`
      : `<span class="ts-ip-none">選擇圖示（可不選）</span>`;
    const menu = h('div','ts-ip-menu d-none');
    const grid = h('div','ts-ip-grid');
    ICON_SET.forEach(ic=>{
      const cell = h('div','ts-ip-item'+(ic===value?' active':''), ic ? `<i class="${faClass} ${ic}" style="color:${THEME_COLOR};"></i>` : `<span class="ts-ip-none">無</span>`);
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
      const cell = e.target.closest('.ts-ip-item'); if(!cell) return;
      current = cell.dataset.icon || '';
      grid.querySelectorAll('.ts-ip-item').forEach(i=>i.classList.toggle('active', i===cell));
      btn.innerHTML = current
        ? `<i class="${faClass} ${current}" style="color:${THEME_COLOR};"></i><span>更換圖示</span>`
        : `<span class="ts-ip-none">選擇圖示（可不選）</span>`;
      close();
      wrap.dispatchEvent(new CustomEvent('icon:change',{ detail:{ icon: current }}));
    });
    return { root:wrap, get:()=>current, set:(v='')=>{
      current=v||'';
      grid.querySelectorAll('.ts-ip-item').forEach(i=>i.classList.toggle('active', i.dataset.icon===current));
      btn.innerHTML = current
        ? `<i class="${faClass} ${current}" style="color:${THEME_COLOR};"></i><span>更換圖示</span>`
        : `<span class="ts-ip-none">選擇圖示（可不選）</span>`;
    }};
  }

  // ---------- 表格欄寬 ----------
  function normalizeColumns(cols){
    if (!Array.isArray(cols) || !cols.length) return [];
    let out = cols.map(c => (typeof c === 'string')
      ? { label: c, width: 0 }
      : { label: String(c.label || ''), width: Number(c.width) || 0 }
    );
    if (!out.some(c => c.width > 0)) {
      const per = Math.round(100 / out.length);
      out = out.map((c,i)=> ({ label:c.label, width: i===out.length-1 ? (100 - per*(out.length-1)) : per }));
    } else {
      const sum = out.reduce((a,b)=> a + (b.width||0), 0) || 100;
      out = out.map(c=>{
        const w = Math.max(5, Math.round(100 * (c.width||0) / sum));
        return { label:c.label, width:w };
      });
      let diff = 100 - out.reduce((a,b)=> a+b.width,0);
      if (diff !== 0) out[out.length-1].width += diff;
    }
    return out;
  }
  function applyColgroup(table, columns){
    const cols = normalizeColumns(columns || []);
    let cg = table.querySelector('colgroup');
    if (!cg) { cg = document.createElement('colgroup'); table.insertBefore(cg, table.firstChild); }
    cg.innerHTML = '';
    cols.forEach(c=>{
      const col = document.createElement('col');
      col.style.width = (c.width||0) + '%';
      cg.appendChild(col);
    });
  }

  // ---------- 主掛載 ----------
  function mount(target, opts={}){
    const host = (typeof target==='string') ? document.querySelector(target) : target;
    if (!host) return null;
    if (host._tap_acc) return host._tap_acc; // 避免重複初始化

    const mode = resolveMode(host, opts, global);
    const faClass = host.dataset.fa || opts.faClass || DEFAULT_FA;

    const state = {
      id: makeId('acc'),
      mode,
      title: opts.title || '',
      titleIcon: opts.icon || '',
      groups: [],  // {id, title, qaMode, blocks:[{type:'title',text}|{type:'list',items:[...]}]}
      table: null, // {title, columns:[{label,width}], rows:[[]]}
      note: ''     // 備註
    };

    host.classList.add('tap-eligibility');
    host.setAttribute('data-mode', mode);
    host.innerHTML = '';

    // --- 頂部顯示標題 ---
    const header = h('div','d-flex align-items-center gap-2 mb-2');
    const titleSpan = h('div','fw-bold fs-5', '');
    const iconSpan  = h('span','', '');
    header.appendChild(iconSpan); header.appendChild(titleSpan);
    host.appendChild(header);

    function renderTopTitle(){
      iconSpan.innerHTML = state.titleIcon ? `<i class="${faClass} ${state.titleIcon}" style="color:${THEME_COLOR};"></i>` : '';
      titleSpan.textContent = t(state.title || '');
      header.style.display = (state.title || state.titleIcon) ? '' : 'none';
    }

    // --- Admin 設定卡 ---
    let cfg = null;
    if (mode === 'ADMIN') {
      cfg = h('div','card mb-3 acc-admin');
      const cid = state.id;
      cfg.innerHTML = `
        <div class="card-header bg-white border-bottom border-danger fw-bold">報名資格／類科條件（管理）</div>
        <div class="card-body">
          <div class="row g-2 align-items-end">
            <div class="col-md-5">
              <label class="form-label small mb-1">大標題</label>
              <input type="text" class="form-control form-control-sm" id="${cid}-bigtitle" placeholder="例如：報考資格 & 類科條件">
            </div>
            <div class="col-md-3">
              <label class="form-label small mb-1">大標題圖示</label>
              <div id="${cid}-iconpicker"></div>
            </div>
            <div class="col-md-4">
              <label class="form-label small mb-1">新增手風琴標題</label>
              <div class="input-group input-group-sm">
                <input type="text" class="form-control" id="${cid}-newAccTitle" placeholder="例如：高等考試三級">
                <button class="btn btn-danger" id="${cid}-addAcc">增加手風琴</button>
              </div>
              <div class="form-text">加入後會自動展開，內層可用「插入標題 / 插入項目」。</div>
            </div>
          </div>

          <hr class="my-3">

          <div class="row g-2 align-items-end">
            <div class="col-md-6">
              <label class="form-label small mb-1">表格標題</label>
              <input type="text" class="form-control form-control-sm" id="${cid}-tblTitle" placeholder="例如：個別類科資格（舉例）">
            </div>
            <div class="col-md-6">
              <label class="form-label small mb-1 d-block">表格</label>
              <button class="btn btn-outline-danger btn-sm" id="${cid}-insertTbl">插入表格</button>
              <button class="btn btn-outline-secondary btn-sm" id="${cid}-removeTbl">刪除表格</button>
              <span class="text-muted small ms-2">固定在最底、備註之上。預設 2 欄，可調寬/加欄。</span>
            </div>
          </div>

          <hr class="my-3">

          <div>
            <label class="form-label small mb-1">備註（空白則不顯示）</label>
            <textarea class="form-control form-control-sm" id="${cid}-note" rows="2" placeholder="※ 例如：詳細內容請參考考試簡章"></textarea>
          </div>
        </div>`;
      host.appendChild(cfg);

      const bigTitle = cfg.querySelector(`#${cid}-bigtitle`);
      const noteInp  = cfg.querySelector(`#${cid}-note`);
      const tblTitle = cfg.querySelector(`#${cid}-tblTitle`);
      const addAccBtn= cfg.querySelector(`#${cid}-addAcc`);
      const newAcc   = cfg.querySelector(`#${cid}-newAccTitle`);
      const iconPicker = createIconPicker({ faClass, value: '' });
      cfg.querySelector(`#${cid}-iconpicker`).appendChild(iconPicker.root);

      bigTitle.addEventListener('input', ()=>{ state.title = bigTitle.value; renderTopTitle(); });
      iconPicker.root.addEventListener('icon:change', (e)=>{ state.titleIcon = e.detail.icon || ''; renderTopTitle(); });

      addAccBtn.addEventListener('click', ()=>{
        const title = (newAcc.value||'').trim() || '未命名';
        const g = createAccordionItem(title, { qa:false });
        // 展開
        const btn = g.querySelector('.accordion-button');
        if (btn && typeof bootstrap !== 'undefined') {
          const collapseEl = g.querySelector('.accordion-collapse');
          new bootstrap.Collapse(collapseEl, { toggle: true });
        }
        newAcc.value='';
      });

      cfg.querySelector(`#${cid}-insertTbl`).addEventListener('click', ()=>{
        ensureTable({ title: tblTitle.value || '' });
      });
      cfg.querySelector(`#${cid}-removeTbl`).addEventListener('click', ()=>{
        removeTable();
      });
      noteInp.addEventListener('input', ()=>{
        state.note = noteInp.value || '';
        renderNote();
      });
    }

    // --- 手風琴容器 ---
    const accId   = state.id + '-accordion';
    const accWrap = h('div','accordion mb-3', ''); accWrap.id = accId;
    host.appendChild(accWrap);

    // --- 表格容器（固定在最底、備註之上）---
    const tableMount = h('div','', '');
    host.appendChild(tableMount);

    // --- 備註 ---
    const noteBox = h('div','small text-muted', '');
    host.appendChild(noteBox);
    function renderNote(){
      const text = t(state.note || '').trim();
      if (!text) { noteBox.style.display='none'; noteBox.innerHTML=''; return; }
      noteBox.style.display=''; noteBox.innerHTML = `※ ${escapeHtml(text)}`;
    }

    function escapeHtml(str){
      return str.replace(/[&<>"']/g, s=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[s]));
    }

    // ---------- 建立一個手風琴項目 ----------
    function createAccordionItem(title, { qa=false } = {} , presetBlocks){
      const gid = makeId('g');
      const item = h('div','accordion-item mb-2','');
      const hId  = gid+'-h';
      const cId  = gid+'-c';

      item.innerHTML = `
        <h2 class="accordion-header" id="${hId}">
          <button class="accordion-button collapsed ${qa?'':'bg-danger text-white'}" type="button" data-bs-toggle="collapse" data-bs-target="#${cId}" aria-expanded="false" aria-controls="${cId}">
            ${qa ? `<span class="badge-qa me-2">Q</span>` : ''}<span class="acc-title-text">${escapeHtml(title)}</span>
          </button>
        </h2>
        <div id="${cId}" class="accordion-collapse collapse" aria-labelledby="${hId}" data-bs-parent="#${accId}">
          <div class="accordion-body">
            <div class="d-flex flex-wrap gap-2 mb-2 acc-admin">
              <button type="button" class="btn btn-outline-danger btn-sm ta-insert-title">插入標題</button>
              <button type="button" class="btn btn-outline-danger btn-sm ta-insert-item">插入項目</button>
              <div class="ms-auto d-flex align-items-center gap-2">
                <label class="small mb-0">樣式</label>
                <select class="form-select form-select-sm ta-style" style="width:120px">
                  <option value="std"${qa?'':' selected'}>一般</option>
                  <option value="qa"${qa?' selected':''}>Q&A</option>
                </select>
              </div>
            </div>
            <div class="ta-flow"></div>
          </div>
        </div>
      `;
      accWrap.appendChild(item);

      // 狀態
      const meta = { id: gid, title: title, qaMode: !!qa, blocks: [] };
      state.groups.push(meta);
      item._meta = meta;

      const flow = item.querySelector('.ta-flow');
      // 預設內容（可無）
      if (Array.isArray(presetBlocks)) {
        presetBlocks.forEach(b=>{
          if (b.type==='title') appendSubtitle(flow, b.text||'');
          if (b.type==='list')  appendList(flow, Array.isArray(b.items)? b.items : []);
        });
      }

      // 事件（插入標題/項目、切換樣式）
      item.querySelector('.ta-insert-title').addEventListener('click', ()=>{
        appendSubtitle(flow, '');
      });
      item.querySelector('.ta-insert-item').addEventListener('click', ()=>{
        appendListItem(flow, '');
      });
      item.querySelector('.ta-style').addEventListener('change', (e)=>{
        meta.qaMode = (e.target.value==='qa');
        const btn = item.querySelector('.accordion-button');
        const titleSpan = item.querySelector('.acc-title-text');
        if (meta.qaMode){
          btn.classList.remove('bg-danger','text-white');
          if (!btn.querySelector('.badge-qa')) btn.insertAdjacentHTML('afterbegin', `<span class="badge-qa me-2">Q</span>`);
        }else{
          btn.classList.add('bg-danger','text-white');
          const bq = btn.querySelector('.badge-qa'); if (bq) bq.remove();
        }
      });

      // USER 模式把 admin 區塊藏起來（由全域 CSS 也會保險）
      if (state.mode === 'USER') {
        item.querySelectorAll('.acc-admin').forEach(n=> n.style.display='none');
      }

      return item;
    }

    // ----- 內容 block -----
    function appendSubtitle(flow, text){
      const wrap = h('div','ta-subtitle d-flex align-items-center gap-2','');
      const span = h('div','', escapeHtml(text||'副標題'));
      span.contentEditable = (state.mode==='ADMIN');
      span.spellcheck = false;
      const del  = h('span','text-danger ta-del','刪');
      del.addEventListener('click', ()=> wrap.remove());
      wrap.appendChild(span); if (state.mode==='ADMIN') wrap.appendChild(del);
      flow.appendChild(wrap);
      return wrap;
    }
    function ensureLastList(flow){
      const blocks = Array.from(flow.children).reverse();
      let ul = blocks.find(x => x.tagName==='UL' && x.classList.contains('ta-list'));
      if (!ul) { ul = h('ul','ta-list',''); flow.appendChild(ul); }
      return ul;
    }
    function appendList(flow, items){
      const ul = h('ul','ta-list','');
      (items||[]).forEach(txt=>{
        const li = h('li','d-flex align-items-start gap-2','');
        const span = h('div','', escapeHtml(txt||''));
        span.contentEditable = (state.mode==='ADMIN'); span.spellcheck=false;
        const del  = h('span','text-danger ta-del small','刪');
        del.addEventListener('click', ()=> li.remove());
        li.appendChild(span); if (state.mode==='ADMIN') li.appendChild(del);
        ul.appendChild(li);
      });
      flow.appendChild(ul);
      return ul;
    }
    function appendListItem(flow, text){
      const ul = ensureLastList(flow);
      const li = h('li','d-flex align-items-start gap-2','');
      const span = h('div','', escapeHtml(text||''));
      span.contentEditable = (state.mode==='ADMIN'); span.spellcheck=false;
      const del  = h('span','text-danger ta-del small','刪');
      del.addEventListener('click', ()=> li.remove());
      li.appendChild(span); if (state.mode==='ADMIN') li.appendChild(del);
      ul.appendChild(li);
      return li;
    }

    // ---------- 表格 ----------
    function ensureTable({ title='' } = {}){
      if (!state.table) {
        state.table = {
          title: title || '',
          columns: normalizeColumns([{label:'欄位1',width:50},{label:'欄位2',width:50}]),
          rows: []
        };
        renderTable();
      } else {
        state.table.title = title;
        renderTable();
      }
    }
    function removeTable(){
      state.table = null;
      tableMount.innerHTML = '';
    }
    function renderTable(){
      tableMount.innerHTML = '';
      if (!state.table) return;

      const card = h('div','card mb-3','');
      const head = h('div','card-header bg-white border-bottom border-danger fw-bold d-flex align-items-center justify-content-between','');
      head.innerHTML = `
        <span class="tbl-title">${escapeHtml(state.table.title||'')}</span>
        <div class="acc-admin d-flex align-items-center gap-2">
          <button class="btn btn-sm btn-danger ta-tbl-add-row">新增列</button>
          <button class="btn btn-sm btn-danger ta-tbl-del-row">刪除列</button>
        </div>
      `;
      const body = h('div','card-body p-0','');
      const tbl  = h('table','table table-bordered mb-0 align-middle ta-table','<thead><tr></tr></thead><tbody></tbody>');

      // thead
      const trh = tbl.querySelector('thead tr'); trh.innerHTML='';
      state.table.columns.forEach(c=>{
        const th = document.createElement('th');
        th.textContent = t(c.label||'');
        th.contentEditable = (state.mode==='ADMIN'); th.spellcheck=false;
        trh.appendChild(th);
      });
      // tbody
      const tb  = tbl.querySelector('tbody'); tb.innerHTML='';
      state.table.rows.forEach(arr=>{
        const tr = document.createElement('tr');
        state.table.columns.forEach((c,i)=>{
          const td = document.createElement('td');
          td.textContent = t(arr?.[i]||''); td.contentEditable = (state.mode==='ADMIN'); td.spellcheck=false;
          tr.appendChild(td);
        });
        tb.appendChild(tr);
      });
      applyColgroup(tbl, state.table.columns);

      body.appendChild(tbl);
      card.appendChild(head); card.appendChild(body);

      // 欄位編輯器（寬度 / 新增欄）
      const editor = h('div','acc-admin p-2 border-top','');
      const wrap   = h('div','d-flex flex-wrap align-items-center gap-2','');
      state.table.columns.forEach((c,idx)=>{
        const box = h('div','input-group input-group-sm','');
        box.style.width='150px';
        box.innerHTML = `
          <span class="input-group-text">${escapeHtml(c.label)}</span>
          <input type="number" class="form-control ta-colw" data-idx="${idx}" min="5" max="100" step="5" value="${c.width}">
          <span class="input-group-text">%</span>`;
        wrap.appendChild(box);
      });
      const addColBtn = h('button','btn btn-outline-danger btn-sm','新增欄位');
      wrap.appendChild(addColBtn);
      editor.appendChild(wrap);
      card.appendChild(editor);

      // 事件：新增/刪除列
      head.querySelector('.ta-tbl-add-row').addEventListener('click', ()=>{
        const arr = new Array(state.table.columns.length).fill('');
        state.table.rows.push(arr); renderTable();
      });
      head.querySelector('.ta-tbl-del-row').addEventListener('click', ()=>{
        state.table.rows.pop(); renderTable();
      });

      // 事件：調整欄寬
      wrap.querySelectorAll('.ta-colw').forEach(inp=>{
        inp.addEventListener('input', ()=>{
          const i = Number(inp.dataset.idx)||0;
          state.table.columns[i].width = Number(inp.value)||0;
          state.table.columns = normalizeColumns(state.table.columns);
          renderTable();
        });
      });

      // 事件：新增欄位
      addColBtn.addEventListener('click', ()=>{
        state.table.columns.push({ label:`欄位${state.table.columns.length+1}`, width:0 });
        // 對每一列補一格
        state.table.rows = state.table.rows.map(r=> (r||[]).concat(['']));
        state.table.columns = normalizeColumns(state.table.columns);
        renderTable();
      });

      // 同步使用者直接改 thead/th、td 的內容
      if (state.mode==='ADMIN') {
        tbl.addEventListener('input', ()=>{
          // 讀回欄名
          const labels = Array.from(tbl.querySelectorAll('thead th')).map(th=> th.textContent.trim());
          state.table.columns = normalizeColumns(labels.map((lab,i)=>({label:lab,width: state.table.columns[i]?.width || 0})));
          // 讀回列
          state.table.rows = Array.from(tbl.querySelectorAll('tbody tr')).map(tr=>{
            return Array.from(tr.children).map(td=> td.textContent.trim());
          });
        });
      }

      tableMount.appendChild(card);
    }

    // ---------- 公用 API ----------
    function getJSON(){
      const groupsData = state.groups.map(g=>{
        const item = Array.from(accWrap.children).find(x=> x._meta && x._meta.id===g.id);
        const flow = item ? item.querySelector('.ta-flow') : null;
        const blocks = [];
        if (flow){
          Array.from(flow.children).forEach(node=>{
            if (node.classList.contains('ta-subtitle')){
              blocks.push({ type:'title', text: node.querySelector('div')?.textContent.trim() || '' });
            } else if (node.tagName==='UL'){
              const items = Array.from(node.querySelectorAll('li div')).map(d=> d.textContent.trim());
              blocks.push({ type:'list', items });
            }
          });
        }
        return { title: g.title, qaMode: g.qaMode, blocks };
      });
      return {
        schemaVersion: 1,
        updatedAt: Date.now(),
        title: state.title,
        titleIcon: state.titleIcon,
        groups: groupsData,
        table: state.table,
        note: state.note
      };
    }

    function setJSON(data={}){
      state.title = data.title || '';
      state.titleIcon = data.titleIcon || '';
      renderTopTitle();

      accWrap.innerHTML=''; state.groups=[];
      (data.groups||[]).forEach(g=>{
        createAccordionItem(g.title||'未命名', { qa: !!g.qaMode }, g.blocks||[]);
      });

      state.table = data.table ? {
        title: t(data.table.title||''),
        columns: normalizeColumns(data.table.columns||[]),
        rows: Array.isArray(data.table.rows)? data.table.rows : []
      } : null;
      renderTable();

      state.note = data.note || '';
      renderNote();

      // 回填到管理欄（如果存在）
      if (cfg){
        cfg.querySelector(`#${state.id}-bigtitle`).value = state.title || '';
        cfg.querySelector(`#${state.id}-tblTitle`).value = state.table ? (state.table.title||'') : '';
        cfg.querySelector(`#${state.id}-note`).value = state.note || '';
      }
    }

    function setMode(next){
      const v = String(next||'USER').toUpperCase()==='ADMIN' ? 'ADMIN' : 'USER';
      state.mode = v;
      host.setAttribute('data-mode', v);
      // 重新渲染表格（contentEditable/控制列會跟著切）
      renderTable();
      // 顯示/隱藏 admin 控制
      if (v==='USER'){
        host.querySelectorAll('.acc-admin').forEach(n=> n.style.display='none');
        host.querySelectorAll('[contenteditable="true"]').forEach(el=> el.setAttribute('contenteditable','false'));
      }else{
        host.querySelectorAll('.acc-admin').forEach(n=> n.style.display='');
        host.querySelectorAll('.ta-subtitle div, .ta-list li div, .ta-table th, .ta-table td')
            .forEach(el=> el.setAttribute('contenteditable','true'));
      }
    }

    // 初始渲染
    renderTopTitle(); renderNote();

    const api = { getJSON, setJSON, setMode, ensureTable, removeTable };
    host._tap_acc = api;
    return api;
  }

  // ---------- 自動掛載 ----------
  function autoload(){
    document.querySelectorAll('[data-tap-plugin="eligibility"]').forEach(node=>{
      if (node._tap_acc) return;
      mount(node, {}); // 模式自動判定
    });
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', autoload);
  else autoload();

  // export
  global.TAPAccordionKit = { mount };

})(window);
