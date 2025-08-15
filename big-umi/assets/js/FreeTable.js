/*!
 * TAPSubjectsKit — 高普考科目自訂表格（可重用插件）
 * 需要：Font Awesome（建議 v6，預設 class = fa-solid）
 * 召喚：
 *   <div data-tap-plugin="subjects"></div>
 *   // 或
 *   const api = TAPSubjectsKit.mount('#subjectsPlugin', { /* 可選 */ });
 *
 * 自動判定管理者（優先度由高到低）：
 *   1) window.TAP_DETECT_MODE() -> 'ADMIN' | 'USER'
 *   2) window.XOOPS_IS_ADMIN === true -> 'ADMIN'；=== false -> 'USER'
 *   3) window.MODE === 'ADMIN' | 'USER'
 *   4) data-mode / opts.mode
 *   5) window.TAP_SUBJECTS_DEFAULT_MODE
 *   6) default: 'USER'
 *
 * 全域可選設定（需在本檔前）：
 *   window.TAP_SUBJECTS_DEFAULT_MODE = 'ADMIN' | 'USER'
 *   window.TAP_SUBJECTS_FA_CLASS     = 'fa-solid' | 'fas' ...
 */
(function (global) {
  'use strict';

  // ====== 基本設定 ======
  const DEFAULT_FA  = global.TAP_SUBJECTS_FA_CLASS || 'fa-solid'; // FA6: fa-solid；FA5: fas
  const THEME_COLOR = 'var(--main-red, #ea7066)';

  // == Mode 判定（恢復 XOOPS / 全域 的優先權）==
  function resolveMode(host, opts, global){
    // 1) TAP_DETECT_MODE()
    if (typeof global.TAP_DETECT_MODE === 'function') {
      const v = String(global.TAP_DETECT_MODE() || '').toUpperCase();
      if (v === 'ADMIN' || v === 'USER') return v;
    }
    // 2) XOOPS_IS_ADMIN
    if (global.XOOPS_IS_ADMIN === true)  return 'ADMIN';
    if (global.XOOPS_IS_ADMIN === false) return 'USER';
    // 3) 全域 MODE
    if (typeof global.MODE === 'string') {
      const v = global.MODE.toUpperCase();
      if (v === 'ADMIN' || v === 'USER') return v;
    }
    // 4) data-mode / opts.mode（較低優先）
    const explicit = (host && host.dataset && host.dataset.mode) || (opts && opts.mode);
    if (explicit) {
      const v = String(explicit).toUpperCase();
      if (v === 'ADMIN' || v === 'USER') return v;
    }
    // 5) TAP_SUBJECTS_DEFAULT_MODE
    if (typeof global.TAP_SUBJECTS_DEFAULT_MODE === 'string') {
      const v = global.TAP_SUBJECTS_DEFAULT_MODE.toUpperCase();
      if (v === 'ADMIN' || v === 'USER') return v;
    }
    // 6) default
    return 'USER';
  }

  // 常用 icon 候選（可自行增減）
  const ICON_SET = [
    '', 'fa-book', 'fa-users', 'fa-gavel', 'fa-briefcase', 'fa-stethoscope',
    'fa-flask', 'fa-cog', 'fa-chart-line', 'fa-landmark', 'fa-user-graduate', 'fa-scale-balanced'
  ];

  // ====== 小工具 ======
  let INST = 0;
  const makeId = (p='ts') => `${p}-${++INST}-${Math.random().toString(36).slice(2,8)}`;
  const h  = (tag, cls, html) => { const el=document.createElement(tag); if(cls) el.className=cls; if(html!=null) el.innerHTML=html; return el; };
  const t  = (s)=> (s==null ? '' : String(s));
  const $$ = (root, sel)=> Array.from((root instanceof Element?root:document).querySelectorAll(sel));
  const swap = (arr,i,j)=>{ const tmp=arr[i]; arr[i]=arr[j]; arr[j]=tmp; };
  const cloneCols = (cols=[]) => cols.map(c => ({ label: String(c.label||''), width: Number(c.width)||0 }));

  // columns 正規化
  function normalizeColumns(cols){
    if (!Array.isArray(cols) || !cols.length) return [];
    let out = cols.map(c => (typeof c === 'string')
      ? { label: c, width: 0 }
      : { label: String(c.label || ''), width: Number(c.width) || 0 }
    );
    if (!out.some(c => c.width > 0)) {
      const perBase = Math.round(100 / out.length);
      const per = Math.max(5, perBase);
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

  // ====== Icon Picker（極簡內建樣式） ======
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
      .ts-ip-item.active{border-color:var(--main-red,#ea7066); box-shadow:0 0 0 2px rgba(234,112,102,.15);}
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
    // Guard：避免重複初始化（按一次新增兩列）
    if (host._tap_subjects) return host._tap_subjects;

    const mode    = resolveMode(host, opts, global);   // ★ 恢復自動判定
    const faClass = host.dataset.fa || opts.faClass || DEFAULT_FA;

    const state = {
      id: makeId('ts'),
      mode,
      columns: normalizeColumns(
        Array.isArray(opts.columns) && opts.columns.length ? opts.columns.slice()
        : ['高考科目','普考科目','分數比重','名額']
      ),
      groups: [] // {id, name, icon, sizeClass, locked, columns?, rows?}
    };

    // 容器骨架
    host.innerHTML = '';
    host.classList.add('tap-subjects');
    host.setAttribute('data-mode', state.mode);

    // 錨點列（只放按鈕，不顯示「快速定位」文字）
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
          <span class="text-muted small">欄位順序=表頭順序；可直接設定每欄寬度（%）</span>
        </div>
        <div id="${cid}-col-list" class="d-flex flex-column gap-2 mb-3"></div>

        <div class="d-flex flex-wrap align-items-end gap-2">
          <div class="flex-grow-1" style="max-width:320px;">
            <label class="form-label small mb-1">新增類組名稱</label>
            <input type="text" class="form-control form-control-sm" id="${cid}-group-name" placeholder="例如：共同科目／文組">
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

    // ====== group / columns 相關 ======
    function getGroup(block){
      const id = block?.id; return state.groups.find(g => g.id === id);
    }
    function getColumnsForBlock(block){
      const g = getGroup(block);
      if (g && g.locked && Array.isArray(g.columns) && g.columns.length) return g.columns;
      return state.columns;
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
    const applyColgroupsToAll = ()=> {
      $$(groupsWrap,'.ts-block table.ts-table').forEach(tbl => {
        const block = tbl.closest('.ts-block');
        applyColgroup(tbl, getColumnsForBlock(block));
      });
    };

    // ====== 欄位設定 UI ======
    const colList   = cfg.querySelector(`#${cid}-col-list`);
    const btnAddCol = cfg.querySelector(`#${cid}-add-col`);

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

        // 標題改變 → 更新所有「未鎖定」表頭
        labelInp.addEventListener('input', ()=>{
          state.columns[idx].label = labelInp.value;
          $$(groupsWrap,'.ts-block').forEach(b=>{
            const g = getGroup(b); if (g && g.locked) return;
            updateHeaders(b);
          });
        });

        // 寬度改變 → 正規化，並對每張表套 colgroup（鎖定用自己的欄寬）
        widthInp.addEventListener('input', ()=>{
          state.columns[idx].width = Number(widthInp.value) || 0;
          state.columns = normalizeColumns(state.columns);
          renderColList();
          applyColgroupsToAll();
        });

        row.querySelector('.ts-col-up').addEventListener('click', ()=>{
          if (idx===0) return;
          swap(state.columns, idx, idx-1);
          $$(groupsWrap,'.ts-block').forEach(b=>{
            const g = getGroup(b); if (g && g.locked) return;
            swapColumns(b, idx, idx-1);
          });
          renderColList(); applyColgroupsToAll();
        });
        row.querySelector('.ts-col-down').addEventListener('click', ()=>{
          if (idx>=state.columns.length-1) return;
          swap(state.columns, idx, idx+1);
          $$(groupsWrap,'.ts-block').forEach(b=>{
            const g = getGroup(b); if (g && g.locked) return;
            swapColumns(b, idx, idx+1);
          });
          renderColList(); applyColgroupsToAll();
        });
        row.querySelector('.ts-col-del').addEventListener('click', ()=>{
          if (state.columns.length<=1) return;
          state.columns.splice(idx,1);
          state.columns = normalizeColumns(state.columns);
          $$(groupsWrap,'.ts-block').forEach(b=>{
            const g = getGroup(b); if (g && g.locked) return;
            deleteColumn(b, idx);
          });
          renderColList(); applyColgroupsToAll();
        });
      });
    }
    btnAddCol.addEventListener('click', ()=>{
      state.columns.push({ label:'新欄位', width: 0 });
      state.columns = normalizeColumns(state.columns);
      $$(groupsWrap,'.ts-block').forEach(b=>{
        const g = getGroup(b); if (g && g.locked) return;
        appendColumn(b,'新欄位');
      });
      renderColList(); applyColgroupsToAll();
    });
    renderColList();

    // ====== 新增類組（字級 + icon；編欄只在鎖定時顯示） ======
    const sizeSel    = cfg.querySelector(`#${cid}-size`);
    const iconPicker = createIconPicker({ faClass:faClass, value:'' });
    cfg.querySelector(`#${cid}-iconpicker`).appendChild(iconPicker.root);

    cfg.querySelector(`#${cid}-add-group`).addEventListener('click', ()=>{
      const name = (cfg.querySelector(`#${cid}-group-name`).value || '').trim() || '未命名類組';
      createGroup(name, { sizeClass: sizeSel.value || 'fs-5', icon: iconPicker.get() || '' });
      cfg.querySelector(`#${cid}-group-name`).value = '';
    });

    function updateLockUI(block){
      const g = getGroup(block); if (!g) return;
      const toggleBtn = block.querySelector('.ts-btn-toggle-lock');
      const editBtn   = block.querySelector('.ts-btn-edit-columns');
      if (g.locked){
        if (toggleBtn) toggleBtn.textContent = '解鎖（跟隨全域）';
        if (editBtn)   editBtn.style.display = '';
      } else {
        if (toggleBtn) toggleBtn.textContent = '鎖定欄位';
        if (editBtn)   editBtn.style.display = 'none';
      }
    }

    function createGroup(name, { sizeClass='fs-5', icon='' } = {}, rows, columns){
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
            <button type="button" class="btn btn-sm btn-outline-secondary ts-btn-toggle-lock">鎖定欄位</button>
            <button type="button" class="btn btn-sm btn-outline-secondary ts-btn-edit-columns" style="display:none;">編欄</button>
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

      // 記錄
      const groupCols = Array.isArray(columns) && columns.length ? normalizeColumns(columns) : [];
      state.groups.push({ id: card.id, name, icon, sizeClass, locked: !!(columns && columns.length), columns: groupCols });

      // 表頭
      const tr = card.querySelector('thead tr'); tr.innerHTML='';
      getColumnsForBlock(card).forEach(c=>{
        const th=document.createElement('th'); th.innerHTML = t(c.label); tr.appendChild(th);
      });

      // 內容列
      const tbody = card.querySelector('tbody');
      function addRowFromArray(arr){
        const r = document.createElement('tr');
        getColumnsForBlock(card).forEach((c,i)=>{
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
      applyColgroup(card.querySelector('table.ts-table'), getColumnsForBlock(card));

      // 錨點依插入順序
      renderAnchors();

      if (state.mode==='USER') lockAsUser(card);

      updateLockUI(card); // 編欄只在鎖定時顯示
      return card;
    }

    // ====== 表頭/欄位操作（針對單一 block） ======
    function updateHeaders(block){
      const cols = getColumnsForBlock(block);
      const tr = block.querySelector('thead tr'); if(!tr) return;
      tr.innerHTML='';
      cols.forEach(c=>{
        const th=document.createElement('th');
        th.innerHTML = t(c.label);
        tr.appendChild(th);
      });
      const rows = block.querySelectorAll('tbody tr');
      rows.forEach(trEl=>{
        while(trEl.children.length > cols.length) trEl.removeChild(trEl.lastElementChild);
        while(trEl.children.length < cols.length){
          const td=document.createElement('td');
          td.contentEditable = state.mode==='ADMIN';
          td.spellcheck=false;
          trEl.appendChild(td);
        }
        cols.forEach((c,i)=>{
          const td = trEl.children[i];
          td.setAttribute('data-label', t(c.label));
        });
      });
      applyColgroup(block.querySelector('table.ts-table'), cols);
    }

    function swapColumns(block, i, j){
      const tr = block.querySelector('thead tr'), ths = Array.from(tr.children);
      if (ths[i] && ths[j]) tr.insertBefore(ths[j], ths[i]);
      block.querySelectorAll('tbody tr').forEach(trEl=>{
        const tds = Array.from(trEl.children);
        if (tds[i] && tds[j]) trEl.insertBefore(tds[j], tds[i]);
      });
      const labels = getColumnsForBlock(block).map(c=>c.label);
      block.querySelectorAll('tbody tr').forEach(trEl=>{
        Array.from(trEl.children).forEach((td, idx)=> td.setAttribute('data-label', labels[idx]||''));
      });
    }
    function deleteColumn(block, idx){
      const th = block.querySelector(`thead th:nth-child(${idx+1})`); if(th) th.remove();
      block.querySelectorAll('tbody tr').forEach(trEl=>{
        const td = trEl.querySelector(`td:nth-child(${idx+1})`); if(td) td.remove();
      });
      applyColgroup(block.querySelector('table.ts-table'), getColumnsForBlock(block));
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
      applyColgroup(block.querySelector('table.ts-table'), getColumnsForBlock(block));
    }

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

    // ====== 卡片內事件（新增/刪除列、鎖定、編欄） ======
    host.addEventListener('click', (e)=>{
      if (e.target.classList.contains('ts-btn-add-row')){
        const block = e.target.closest('.ts-block');
        const tbody = block.querySelector('tbody');
        const tr = document.createElement('tr');
        getColumnsForBlock(block).forEach(c=>{
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
          const id = block.id;
          block.remove();
          const idx = state.groups.findIndex(g=>g.id===id);
          if (idx>-1) state.groups.splice(idx,1);
          renderAnchors();
        }
        return;
      }
      if (e.target.classList.contains('ts-btn-toggle-lock')){
        const block = e.target.closest('.ts-block'); if (!block) return;
        const g = getGroup(block); if (!g) return;
        if (g.locked){
          g.locked = false;
          g.columns = [];
        } else {
          g.locked = true;
          g.columns = cloneCols( getColumnsForBlock(block) );
        }
        updateHeaders(block);
        applyColgroup(block.querySelector('table.ts-table'), getColumnsForBlock(block));
        updateLockUI(block);
        return;
      }
      if (e.target.classList.contains('ts-btn-edit-columns')){
        const block = e.target.closest('.ts-block');
        const current = getColumnsForBlock(block).map(c => `${c.label}:${c.width}`).join(',');
        const input = prompt('請輸入欄位（格式：標題:寬%，逗號分隔）\n例如：項目:30,科目名稱:70', current);
        if (input === null) return;
        const cols = input.split(',').map(s=>{
          const p = s.split(':').map(x=>x.trim());
          return { label: p[0]||'欄位', width: Number(p[1])||0 };
        });
        const g = getGroup(block);
        if (g){
          g.locked = true;
          g.columns = normalizeColumns(cols);
          updateHeaders(block);
          applyColgroup(block.querySelector('table.ts-table'), getColumnsForBlock(block));
          updateLockUI(block);
        }
        return;
      }
    });

    // ====== USER 模式：藏管理 UI + 鎖 contenteditable ======
    function lockAsUser(scope){
      (scope||host).querySelectorAll('.ts-admin').forEach(n=> n.style.display='none');
      (scope||host).querySelectorAll('[contenteditable="true"]').forEach(td=> td.setAttribute('contenteditable','false'));
      host.setAttribute('data-mode','USER');
    }
    function unlockAsAdmin(scope){
      (scope||host).querySelectorAll('.ts-admin').forEach(n=> n.style.display='');
      (scope||host).querySelectorAll('td').forEach(td=> td.setAttribute('contenteditable','true'));
      host.setAttribute('data-mode','ADMIN');
    }
    if (state.mode==='USER') lockAsUser();

    // ====== 對外 API ======
    function getJSON(){
      const groupsData = state.groups.map(g=>{
        const card = document.getElementById(g.id);
        const rows = [];
        if (card) {
          card.querySelectorAll('tbody tr').forEach(tr=>{
            const arr = Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim());
            if (arr.some(v => v !== '')) rows.push(arr);
          });
        }
        return {
          name: g.name, icon: g.icon, sizeClass: g.sizeClass,
          locked: !!g.locked,
          columns: g.locked ? cloneCols(g.columns) : null,
          rows
        };
      });
      return {
        schemaVersion: 3,
        updatedAt: Date.now(),
        columns: state.columns.map(c => ({ label:c.label, width:c.width })),
        groups: groupsData
      };
    }

    function setJSON(data={}){
      if (Array.isArray(data.columns) && data.columns.length)
        state.columns = normalizeColumns(data.columns);

      // 重新渲染全域欄位 UI（僅 ADMIN 看得到）
      renderColList();

      groupsWrap.innerHTML=''; state.groups=[];
      (data.groups||[]).forEach(g=>{
        const card = createGroup(g.name||'未命名類組',
                                 { sizeClass:g.sizeClass||'fs-5', icon:g.icon||'' },
                                 g.rows||[],
                                 (g.locked && Array.isArray(g.columns) && g.columns.length) ? g.columns : undefined);
        if (g.locked) updateLockUI(card);
      });
      applyColgroupsToAll();

      // 套用 mode（避免載入資料後又露出 admin）
      if (state.mode==='USER') lockAsUser();
      else unlockAsAdmin();
    }

    function setMode(next='USER'){
      const v = String(next).toUpperCase()==='ADMIN' ? 'ADMIN':'USER';
      state.mode = v;
      if (v==='USER') lockAsUser();
      else unlockAsAdmin();
    }

    // 新公開：可帶 rows 與 columns（columns 代表鎖定欄位）
    function addGroupPublic(name, opts={}, rows=[], columns){
      return createGroup(name, opts||{}, rows||[], columns);
    }

    if (opts.data) setJSON(opts.data);

    const api = { getJSON, setJSON, setMode, addGroup: addGroupPublic };
    host._tap_subjects = api;
    return api;
  }

  // ====== 自動掛載（data-tap-plugin="subjects"） ======
  function autoload(){
    document.querySelectorAll('[data-tap-plugin="subjects"]').forEach(node=>{
      if (node._tap_subjects) return;
      mount(node, { /* 不傳 mode，交給 resolveMode 判定 */ });
    });
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', autoload);
  else autoload();

  // 導出
  global.TAPSubjectsKit = { mount };

})(window);
