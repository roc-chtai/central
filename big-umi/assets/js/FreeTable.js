/*!
 *
 * 召喚方式：
 *   <div data-tap-plugin="subjects" data-mode="ADMIN"></div>
 * 或 JS：
 *   TAPSubjectsKit.mount('#subjectsPlugin', { mode:'ADMIN' })
 *
 * 需要的外部資源：
 *   - Font Awesome
 *
 * 全域可選設定（需在本檔前）：
 *   window.TAP_SUBJECTS_DEFAULT_MODE = 'ADMIN' | 'USER'
 *   window.TAP_SUBJECTS_FA_CLASS     = 'fas' | 'fa-solid' ...
 */

(function (global) {
  'use strict';

  // ====== 基本設定 ======
  const DEFAULT_MODE = (global.TAP_SUBJECTS_DEFAULT_MODE || 'ADMIN').toUpperCase();
  const DEFAULT_FA   = global.TAP_SUBJECTS_FA_CLASS || 'fas'; // FA5 'fas'；FA6 用 'fa-solid'
  const THEME_COLOR  = 'var(--main-red)';

  // 常用 icon 候選（可自行增減）
  const ICON_SET = [
    '', 'fa-book', 'fa-users', 'fa-gavel', 'fa-briefcase', 'fa-stethoscope',
    'fa-flask', 'fa-cog', 'fa-chart-line', 'fa-university', 'fa-user-graduate', 'fa-scale-balanced'
  ];

  // ====== 小工具 ======
  let INST = 0;
  const makeId = (p='ts') => `${p}-${++INST}-${Math.random().toString(36).slice(2,8)}`;
  const h  = (tag, cls, html) => { const el=document.createElement(tag); if(cls) el.className=cls; if(html!=null) el.innerHTML=html; return el; };
  const t  = (s)=> (s==null ? '' : String(s));
  const $$ = (root, sel)=> Array.from((root instanceof Element?root:document).querySelectorAll(sel));
  const swap = (arr,i,j)=>{ const tmp=arr[i]; arr[i]=arr[j]; arr[j]=tmp; };

  // 將 columns 規格統一為 [{label, width%}] 並正規化百分比
  function normalizeColumns(cols){
    if (!Array.isArray(cols) || !cols.length) return [];
    let out = cols.map(c => (typeof c === 'string')
      ? { label: c, width: 0 }
      : { label: String(c.label || ''), width: Number(c.width) || 0 }
    );
    // 若全部沒給寬度 → 均分
    if (!out.some(c => c.width > 0)) {
      const per = Math.round(100 / out.length);
      out = out.map((c,i)=> ({ label:c.label, width: i===out.length-1 ? (100 - per*(out.length-1)) : per }));
    } else {
      const sum = out.reduce((a,b)=> a + (b.width||0), 0) || 100;
      out = out.map(c=>{
        const w = Math.max(5, Math.round(100 * (c.width||0) / sum)); // 每欄至少 5%
        return { label:c.label, width:w };
      });
      // 調整差值使總和=100
      let diff = 100 - out.reduce((a,b)=> a+b.width,0);
      if (diff !== 0) out[out.length-1].width += diff;
    }
    return out;
  }

  // ====== Icon Picker（內建最小樣式） ======
  if (!document.getElementById('ts-iconpicker-style')) {
    const st = document.createElement('style');
    st.id = 'ts-iconpicker-style';
    st.textContent = `
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

  // ====== 主掛載 ======
  function mount(target, opts={}){
    const host = (typeof target==='string') ? document.querySelector(target) : target;
    if (!host) return null;
  if (host._tap_subjects) {
    // console.log('TAPSubjectsKit: already mounted on this host — returning existing instance.');
    return host._tap_subjects;
  }

    const mode    = ((host.dataset.mode || opts.mode || DEFAULT_MODE)+'').toUpperCase()==='ADMIN' ? 'ADMIN' : 'USER';
    const faClass = host.dataset.fa || opts.faClass || DEFAULT_FA;

    const state = {
      id: makeId('ts'),
      mode,
      columns: normalizeColumns(
        Array.isArray(opts.columns) && opts.columns.length ? opts.columns.slice()
        : ['考科','科目(分數占比)','名額']
      ),
      groups: [] // {id, name, icon, sizeClass}
    };

    // 容器骨架
    host.innerHTML = '';
    host.classList.add('tap-subjects');
    host.setAttribute('data-mode', state.mode);

    // 錨點列（只有按鈕，不顯示「快速定位」文字）
    const anchors = h('div','ts-anchors d-flex flex-wrap gap-2 mb-3');
    host.appendChild(anchors);

    // 設定卡（欄位設定 + 新增類組）
    const cfg = h('div','card mb-3 ts-admin');
    const cid = state.id;
    cfg.innerHTML = `
      <div class="card-header bg-white border-bottom border-danger fw-bold">類組欄位設定（不限數量）與新增類組</div>
      <div class="card-body">
        <div class="d-flex flex-wrap align-items-end gap-2 mb-2">
          <button type="button" class="btn btn-outline-danger btn-sm" id="${cid}-add-col">新增欄位</button>
          <span class="text-muted small">欄位順序 = 表頭順序；可直接設定每欄寬度（%）</span>
        </div>
        <div id="${cid}-col-list" class="d-flex flex-column gap-2 mb-3"></div>

        <div class="d-flex flex-wrap align-items-end gap-2">
          <div class="flex-grow-1" style="max-width:320px;">
            <label class="form-label small mb-1">新增類組名稱</label>
            <input type="text" class="form-control form-control-sm" id="${cid}-group-name" placeholder="例如：文組/營運職">
          </div>

          <div>
            <label class="form-label small mb-1">字級</label>
            <select class="form-select form-select-sm" id="${cid}-size">
              <option value="fs-6">小字</option>
              <option value="fs-5" selected>中字</option>
              <option value="fs-4">大字</option>
            </select>
          </div>

          <div>
            <label class="form-label small mb-1">圖示</label>
            <div id="${cid}-iconpicker"></div>
          </div>

          <button type="button" class="btn btn-danger btn-sm" id="${cid}-add-group">新增類組</button>
        </div>
      </div>`;
    host.appendChild(cfg);

    // 類組容器
    const groupsWrap = h('div','ts-groups');
    host.appendChild(groupsWrap);

    // ====== 欄位設定區 ======
    const colList   = cfg.querySelector(`#${cid}-col-list`);
    const btnAddCol = cfg.querySelector(`#${cid}-add-col`);

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
    const applyColgroupsToAll = ()=> {
      $$(groupsWrap,'.ts-block table.ts-table').forEach(tbl => applyColgroup(tbl, state.columns));
    };

    function renderColList(){
      colList.innerHTML = '';
      state.columns.forEach((col, idx)=>{
        const row = h('div','d-flex align-items-center gap-2 ts-col-item');
        row.innerHTML = `
          <input type="text" class="form-control form-control-sm ts-col-label" value="${t(col.label).replace(/"/g,'&quot;')}" placeholder="欄位名稱">
          <div class="input-group input-group-sm" style="width:100px;">
            <input type="number" class="form-control ts-col-width" min="5" max="100" step="5" value="${col.width}">
            <span class="input-group-text">%</span>
          </div>
          <div class="btn-group btn-group-sm">
            <button type="button" class="btn btn-light ts-col-up">▲</button>
            <button type="button" class="btn btn-light ts-col-down">▼</button>
            <button type="button" class="btn btn-outline-danger ts-col-del">刪</button>
          </div>
        `;
        colList.appendChild(row);

        const labelInp = row.querySelector('.ts-col-label');
        const widthInp = row.querySelector('.ts-col-width');

        labelInp.addEventListener('input', ()=>{
          state.columns[idx].label = labelInp.value;
          $$(groupsWrap,'.ts-block').forEach(updateHeaders);
        });

        widthInp.addEventListener('input', ()=>{
          state.columns[idx].width = Number(widthInp.value) || 0;
          state.columns = normalizeColumns(state.columns);
          renderColList();
          applyColgroupsToAll();
        });

        row.querySelector('.ts-col-up').addEventListener('click', ()=>{
          if (idx===0) return;
          swap(state.columns, idx, idx-1);
          $$(groupsWrap,'.ts-block').forEach(b=>swapColumns(b, idx, idx-1));
          renderColList(); applyColgroupsToAll();
        });
        row.querySelector('.ts-col-down').addEventListener('click', ()=>{
          if (idx>=state.columns.length-1) return;
          swap(state.columns, idx, idx+1);
          $$(groupsWrap,'.ts-block').forEach(b=>swapColumns(b, idx, idx+1));
          renderColList(); applyColgroupsToAll();
        });
        row.querySelector('.ts-col-del').addEventListener('click', ()=>{
          if (state.columns.length<=1) return;
          state.columns.splice(idx,1);
          state.columns = normalizeColumns(state.columns);
          $$(groupsWrap,'.ts-block').forEach(b=>deleteColumn(b, idx));
          renderColList(); applyColgroupsToAll();
        });
      });
    }
    btnAddCol.addEventListener('click', ()=>{
      state.columns.push({ label:'新欄位', width: 0 });
      state.columns = normalizeColumns(state.columns);
      $$(groupsWrap,'.ts-block').forEach(b=>appendColumn(b,'新欄位'));
      renderColList(); applyColgroupsToAll();
    });
    renderColList();

    // ====== 新增類組（標題字級 + icon） ======
    const sizeSel    = cfg.querySelector(`#${cid}-size`);
    const iconPicker = createIconPicker({ faClass:faClass, value:'' });
    cfg.querySelector(`#${cid}-iconpicker`).appendChild(iconPicker.root);

    cfg.querySelector(`#${cid}-add-group`).addEventListener('click', ()=>{
      const name = (cfg.querySelector(`#${cid}-group-name`).value || '').trim() || '未命名類組';
      createGroup(name, { sizeClass: sizeSel.value || 'fs-5', icon: iconPicker.get() || '' });
      cfg.querySelector(`#${cid}-group-name`).value = '';
    });

    // ====== 產生群組卡片 ======
    function createGroup(name, { sizeClass='fs-5', icon='' } = {}, rows){
      const gid  = makeId('g');
      const card = h('div','card mb-4 shadow-sm ts-block');
      card.id = `${state.id}-${gid}`;

      const title = icon
        ? `<i class="${faClass} ${icon} me-2" style="color:${THEME_COLOR};"></i><span class="${sizeClass}">${t(name)}</span>`
        : `<span class="${sizeClass}">${t(name)}</span>`;

      card.innerHTML = `
        <div class="card-header bg-white border-bottom border-danger fw-bold d-flex justify-content-between align-items-center">
          <span class="ts-title">${title}</span>
          <div class="d-flex gap-2 ts-admin">
            <button type="button" class="btn btn-sm btn-danger ts-btn-add-row">新增列</button>
            <button type="button" class="btn btn-sm btn-danger ts-btn-del-row">刪除列</button>
          </div>
        </div>
        <div class="card-body p-0">
          <table class="table table-bordered mb-0 align-middle ts-table">
            <colgroup></colgroup>
            <thead class="table-danger"><tr></tr></thead>
            <tbody></tbody>
          </table>
        </div>`;

      groupsWrap.appendChild(card);

      // 表頭
      const tr = card.querySelector('thead tr');
      tr.innerHTML = '';
      state.columns.forEach(c=>{
        const th = document.createElement('th');
        th.innerHTML = t(c.label);
        tr.appendChild(th);
      });

      // 內容列
      const tbody = card.querySelector('tbody');
      function addRowFromArray(arr){
        const r = document.createElement('tr');
        state.columns.forEach((c,i)=>{
          const td = document.createElement('td');
          td.setAttribute('data-label', t(c.label));
          td.contentEditable = state.mode==='ADMIN';
          td.spellcheck = false;
          td.textContent = t(arr?.[i] || '');
          r.appendChild(td);
        });
        tbody.appendChild(r);
      }
      if (Array.isArray(rows) && rows.length){
        rows.forEach(addRowFromArray);
      } else {
        if (state.mode==='ADMIN') addRowFromArray([]); // ADMIN 先給一列空白
      }

      // 套欄寬
      applyColgroup(card.querySelector('table.ts-table'), state.columns);

      // 記錄 & 錨點
      state.groups.push({ id: card.id, name, icon, sizeClass });
      renderAnchors();

      if (state.mode==='USER') lockAsUser(card);

      return card;
    }

    // ====== 表頭/欄位操作 ======
    function updateHeaders(block){
      const tr = block.querySelector('thead tr'); if(!tr) return;
      tr.innerHTML='';
      state.columns.forEach(c=>{
        const th=document.createElement('th');
        th.innerHTML = t(c.label);
        tr.appendChild(th);
      });
      const rows = block.querySelectorAll('tbody tr');
      rows.forEach(trEl=>{
        // 欄數修正
        while(trEl.children.length > state.columns.length) trEl.removeChild(trEl.lastElementChild);
        while(trEl.children.length < state.columns.length){
          const td=document.createElement('td');
          td.contentEditable = state.mode==='ADMIN';
          td.spellcheck=false;
          trEl.appendChild(td);
        }
        // data-label 修正
        state.columns.forEach((c,i)=>{
          const td = trEl.children[i];
          td.setAttribute('data-label', t(c.label));
        });
      });
      applyColgroup(block.querySelector('table.ts-table'), state.columns);
    }

    function swapColumns(block, i, j){
      const tr = block.querySelector('thead tr'), ths = Array.from(tr.children);
      if (ths[i] && ths[j]) tr.insertBefore(ths[j], ths[i]);
      block.querySelectorAll('tbody tr').forEach(trEl=>{
        const tds = Array.from(trEl.children);
        if (tds[i] && tds[j]) trEl.insertBefore(tds[j], tds[i]);
      });
      // 重算 data-label
      const labels = state.columns.map(c=>c.label);
      block.querySelectorAll('tbody tr').forEach(trEl=>{
        Array.from(trEl.children).forEach((td, idx)=> td.setAttribute('data-label', labels[idx]||''));
      });
    }
    function deleteColumn(block, idx){
      const th = block.querySelector(`thead th:nth-child(${idx+1})`); if(th) th.remove();
      block.querySelectorAll('tbody tr').forEach(trEl=>{
        const td = trEl.querySelector(`td:nth-child(${idx+1})`); if(td) td.remove();
      });
      applyColgroup(block.querySelector('table.ts-table'), state.columns);
    }
    function appendColumn(block, name){
      const tr = block.querySelector('thead tr');
      const th = document.createElement('th'); th.textContent = t(name); tr.appendChild(th);
      block.querySelectorAll('tbody tr').forEach(trEl=>{
        const td = document.createElement('td');
        td.setAttribute('data-label', t(name));
        td.contentEditable = state.mode==='ADMIN';
        td.spellcheck=false;
        trEl.appendChild(td);
      });
      applyColgroup(block.querySelector('table.ts-table'), state.columns);
    }

    // ====== 卡片內事件（新增/刪除列） ======
    host.addEventListener('click', (e)=>{
      if (e.target.classList.contains('ts-btn-add-row')){
        const block = e.target.closest('.ts-block');
        const tbody = block.querySelector('tbody');
        const tr = document.createElement('tr');
        state.columns.forEach(c=>{
          const td = document.createElement('td');
          td.setAttribute('data-label', t(c.label));
          td.contentEditable = state.mode==='ADMIN';
          td.spellcheck=false;
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
        return;
      }
      if (e.target.classList.contains('ts-btn-del-row')){
        const block = e.target.closest('.ts-block');
        const tbody = block.querySelector('tbody');
        const rows = Array.from(tbody.querySelectorAll('tr'));
        if (!rows.length) return;
        rows[rows.length-1].remove();
        if (!tbody.children.length){
          // 列刪光 → 刪整張表 + 錨點
          const id = block.id;
          block.remove();
          const idx = state.groups.findIndex(g=>g.id===id);
          if (idx>-1) state.groups.splice(idx,1);
          renderAnchors();
        }
        return;
      }
    });

    // ====== 錨點 ======
    function renderAnchors(){
      anchors.innerHTML = '';
      state.groups.forEach(g=>{
        const a = document.createElement('a');
        a.className = 'btn btn-outline-danger btn-sm';
        a.href = `#${g.id}`;
        a.innerHTML = g.icon
          ? `<i class="${faClass} ${g.icon} me-1" style="color:${THEME_COLOR};"></i>${t(g.name)}`
          : t(g.name);
        anchors.appendChild(a);
      });
    }

    // ====== USER 模式：鎖定 ======
    function lockAsUser(scope){
      (scope||host).querySelectorAll('.ts-admin').forEach(n=> n.style.display='none');
      (scope||host).querySelectorAll('[contenteditable="true"]').forEach(td=> td.setAttribute('contenteditable','false'));
    }
    if (state.mode==='USER') lockAsUser();

    // ====== 對外 API ======
    function getJSON(){
      const groupsData = state.groups.map(g=>{
        const card = document.getElementById(g.id);
        const rows = [];
        card.querySelectorAll('tbody tr').forEach(tr=>{
          const arr = Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim());
          if (arr.some(v => v !== '')) rows.push(arr);
        });
        return { name:g.name, icon:g.icon, sizeClass:g.sizeClass, rows };
      });
      return {
        schemaVersion: 2,
        updatedAt: Date.now(),
        columns: state.columns.map(c => ({ label:c.label, width:c.width })),
        groups: groupsData
      };
    }

    function setJSON(data={}){
      if (Array.isArray(data.columns) && data.columns.length) {
        state.columns = normalizeColumns(data.columns);
      }
      renderColList();

      groupsWrap.innerHTML=''; state.groups=[];
      (data.groups||[]).forEach(g=>{
        createGroup(g.name||'未命名類組', { sizeClass:g.sizeClass||'fs-5', icon:g.icon||'' }, g.rows||[]);
      });
      renderAnchors();
      applyColgroupsToAll();
    }

    function setMode(next='USER'){
      state.mode = String(next).toUpperCase()==='ADMIN' ? 'ADMIN':'USER';
      host.setAttribute('data-mode', state.mode);
      if (state.mode==='USER') lockAsUser();
      else { host.querySelectorAll('td').forEach(td=> td.contentEditable=true); host.querySelectorAll('.ts-admin').forEach(n=> n.style.display=''); }
    }

    function addGroupPublic(name, opts){ return createGroup(name, opts||{}, []); }

    if (opts.data) setJSON(opts.data);

    const api = { getJSON, setJSON, setMode, addGroup: addGroupPublic };
    host._tap_subjects = api;
    return api;
  }

  // ====== 自動掛載 ======
  function autoload(){
    document.querySelectorAll('[data-tap-plugin="subjects"]').forEach(node=>{
      if (node._tap_subjects) return;
      mount(node, { mode: node.dataset.mode, faClass: node.dataset.fa || undefined });
    });
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', autoload);
  else autoload();

  // 導出
  global.TAPSubjectsKit = { mount };

})(window);
