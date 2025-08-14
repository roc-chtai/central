/*!
 * FreeTable.js — TAP Subjects Plugin (auto ADMIN/USER detection, per-group locked columns, anchors, icon picker)
 * v2.4
 * 
 * 使用方式：
 *   1) 自動掛載：<div data-tap-plugin="subjects"></div>
 *   2) 手動掛載：TAPSubjectsKit.mount('#subjectsPlugin', { columns:[...] })
 * 
 * 模式自動判定順序（任一命中即回傳）：
 *   opts.mode / data-mode
 *   window.TAP_DETECT_MODE()   // 建議在頁面上實作；CodePen 用 MODE 常數回傳
 *   window.XOOPS_IS_ADMIN === true
 *   window.MODE                // 若你僅有常數 MODE 也會吃
 *   window.TAP_SUBJECTS_DEFAULT_MODE
 *   預設 'USER'
 */

(function (global) {
  'use strict';

  // ===================== Config & Utils =====================
  const DEFAULT_FA   = global.TAP_SUBJECTS_FA_CLASS || 'fa-solid'; // FA6 預設
  const THEME_COLOR  = 'var(--main-red)';
  const ICON_SET = [
    '', 'fa-book', 'fa-users', 'fa-gavel', 'fa-briefcase', 'fa-stethoscope',
    'fa-flask', 'fa-cog', 'fa-chart-line', 'fa-university', 'fa-user-graduate', 'fa-scale-balanced'
  ];

  let INST = 0;
  const makeId = (p='ts') => `${p}-${++INST}-${Math.random().toString(36).slice(2,8)}`;
  const t  = (s)=> (s==null ? '' : String(s));
  const $$ = (root, sel)=> Array.from((root instanceof Element?root:document).querySelectorAll(sel));
  const swap = (arr,i,j)=>{ const tmp=arr[i]; arr[i]=arr[j]; arr[j]=tmp; };

  function h(tag, cls, html){
    const el = document.createElement(tag);
    if (cls)  el.className = cls;
    if (html!=null) el.innerHTML = html;
    return el;
  }

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

  // 模式自動判定
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

  // ===================== Core: mount =====================
  function mount(target, opts={}){
    const host = (typeof target==='string') ? document.querySelector(target) : target;
    if (!host) return null;
    if (host._tap_subjects) return host._tap_subjects; // guard: avoid double init

    const mode    = resolveMode(host, opts, global);
    const faClass = host.dataset.fa || opts.faClass || DEFAULT_FA;

    const state = {
      id: makeId('ts'),
      mode,                             // 'ADMIN' | 'USER'
      sharedColumns: normalizeColumns(
        Array.isArray(opts.columns) && opts.columns.length ? opts.columns.slice()
        : ['請輸入表頭','請輸入表頭','請輸入表頭','請輸入表頭']
      ),
      groups: [] // {id, name, icon, sizeClass, columns|null}
    };

    // 容器與模式標記
    host.innerHTML = '';
    host.classList.add('tap-subjects');
    host.setAttribute('data-mode', state.mode);

    // ---- Anchors（按插入順序顯示）----
    const anchors = h('div','ts-anchors d-flex flex-wrap gap-2 mb-3');
    host.appendChild(anchors);

    // ---- Admin 設定卡（僅 ADMIN 才渲染）----
    let cfg = null;
    if (state.mode === 'ADMIN') {
      cfg = h('div','card mb-3 ts-admin');
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

      // 欄位設定編輯 UI
      const colList   = cfg.querySelector(`#${cid}-col-list`);
      const btnAddCol = cfg.querySelector(`#${cid}-add-col`);
      function renderColList(){
        colList.innerHTML = '';
        state.sharedColumns.forEach((col, idx)=>{
          const row = h('div','d-flex align-items-center gap-2 ts-col-item');
          row.innerHTML = `
            <input type="text" class="form-control form-control-sm ts-col-label" value="${t(col.label).replace(/"/g,'&quot;')}" placeholder="欄位名稱">
            <div class="input-group input-group-sm" style="width:110px;">
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
            state.sharedColumns[idx].label = labelInp.value;
            $$(groupsWrap,'.ts-block').forEach(updateHeadersForShared);
          });

          widthInp.addEventListener('input', ()=>{
            state.sharedColumns[idx].width = Number(widthInp.value) || 0;
            state.sharedColumns = normalizeColumns(state.sharedColumns);
            renderColList();
            applyColgroupsToAllShared();
          });

          row.querySelector('.ts-col-up').addEventListener('click', ()=>{
            if (idx===0) return;
            swap(state.sharedColumns, idx, idx-1);
            $$(groupsWrap,'.ts-block').forEach(block=>{
              if (!block._group.columns) swapColumns(block, idx, idx-1);
            });
            renderColList(); applyColgroupsToAllShared();
          });
          row.querySelector('.ts-col-down').addEventListener('click', ()=>{
            if (idx>=state.sharedColumns.length-1) return;
            swap(state.sharedColumns, idx, idx+1);
            $$(groupsWrap,'.ts-block').forEach(block=>{
              if (!block._group.columns) swapColumns(block, idx, idx+1);
            });
            renderColList(); applyColgroupsToAllShared();
          });
          row.querySelector('.ts-col-del').addEventListener('click', ()=>{
            if (state.sharedColumns.length<=1) return;
            state.sharedColumns.splice(idx,1);
            state.sharedColumns = normalizeColumns(state.sharedColumns);
            $$(groupsWrap,'.ts-block').forEach(block=>{
              if (!block._group.columns) deleteColumn(block, idx);
            });
            renderColList(); applyColgroupsToAllShared();
          });
        });
      }
      btnAddCol.addEventListener('click', ()=>{
        state.sharedColumns.push({ label:'新欄位', width: 0 });
        state.sharedColumns = normalizeColumns(state.sharedColumns);
        $$(groupsWrap,'.ts-block').forEach(block=>{
          if (!block._group.columns) appendColumn(block,'新欄位');
        });
        renderColList(); applyColgroupsToAllShared();
      });
      renderColList();

      function applyColgroupsToAllShared(){
        $$(groupsWrap,'.ts-block').forEach(tbl=>{
          if (!tbl._group.columns) applyColgroup(tbl.querySelector('table.ts-table'), state.sharedColumns);
        });
      }

      // 新增類組（標題字級 + icon）
      const sizeSel    = cfg.querySelector(`#${cid}-size`);
      const iconPicker = createIconPicker({ faClass:faClass, value:'' });
      cfg.querySelector(`#${cid}-iconpicker`).appendChild(iconPicker.root);

      cfg.querySelector(`#${cid}-add-group`).addEventListener('click', ()=>{
        const name = (cfg.querySelector(`#${cid}-group-name`).value || '').trim() || '未命名類組';
        createGroup(name, { sizeClass: sizeSel.value || 'fs-5', icon: iconPicker.get() || '' });
        cfg.querySelector(`#${cid}-group-name`).value = '';
      });
    }

    // 類組容器
    const groupsWrap = h('div','ts-groups');
    host.appendChild(groupsWrap);

    // ===================== Group Helpers =====================
    function labelsOf(columns){
      return normalizeColumns(columns).map(c=>c.label);
    }

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

    function updateHeadersForShared(block){
      if (block._group.columns) return; // locked group 不吃 shared header
      const tr = block.querySelector('thead tr'); if(!tr) return;
      tr.innerHTML='';
      state.sharedColumns.forEach(c=>{
        const th=document.createElement('th');
        th.innerHTML = t(c.label);
        tr.appendChild(th);
      });
      const rows = block.querySelectorAll('tbody tr');
      rows.forEach(trEl=>{
        while(trEl.children.length > state.sharedColumns.length) trEl.removeChild(trEl.lastElementChild);
        while(trEl.children.length < state.sharedColumns.length){
          const td=document.createElement('td');
          td.contentEditable = state.mode==='ADMIN';
          td.spellcheck=false;
          trEl.appendChild(td);
        }
        state.sharedColumns.forEach((c,i)=>{
          const td = trEl.children[i];
          td.setAttribute('data-label', t(c.label));
        });
      });
      applyColgroup(block.querySelector('table.ts-table'), state.sharedColumns);
    }

    function swapColumns(block, i, j){
      const tr = block.querySelector('thead tr'), ths = Array.from(tr.children);
      if (ths[i] && ths[j]) tr.insertBefore(ths[j], ths[i]);
      block.querySelectorAll('tbody tr').forEach(trEl=>{
        const tds = Array.from(trEl.children);
        if (tds[i] && tds[j]) trEl.insertBefore(tds[j], tds[i]);
      });
      const labels = (block._group.columns ? labelsOf(block._group.columns) : labelsOf(state.sharedColumns));
      block.querySelectorAll('tbody tr').forEach(trEl=>{
        Array.from(trEl.children).forEach((td, idx)=> td.setAttribute('data-label', labels[idx]||''));
      });
    }
    function deleteColumn(block, idx){
      const th = block.querySelector(`thead th:nth-child(${idx+1})`); if(th) th.remove();
      block.querySelectorAll('tbody tr').forEach(trEl=>{
        const td = trEl.querySelector(`td:nth-child(${idx+1})`); if(td) td.remove();
      });
      const cols = block._group.columns ? block._group.columns : state.sharedColumns;
      applyColgroup(block.querySelector('table.ts-table'), cols);
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
      const cols = block._group.columns ? block._group.columns : state.sharedColumns;
      applyColgroup(block.querySelector('table.ts-table'), cols);
    }

    // 小型欄位編輯器（僅鎖定欄位的 group 顯示「編欄」）
    function buildColsInlineEditor(block){
      if (!block._group.columns) return null;
      const holder = h('div','p-2 border-top d-none ts-admin ts-cols-editor');
      const cols = normalizeColumns(block._group.columns);
      cols.forEach((c, idx)=>{
        const row = h('div','d-flex align-items-center gap-2 mb-2');
        row.innerHTML = `
          <input type="text" class="form-control form-control-sm ts-gcol-label" value="${t(c.label).replace(/"/g,'&quot;')}" placeholder="欄位名稱">
          <div class="input-group input-group-sm" style="width:110px;">
            <input type="number" class="form-control ts-gcol-width" min="5" max="100" step="5" value="${c.width}">
            <span class="input-group-text">%</span>
          </div>
          <div class="btn-group btn-group-sm">
            <button type="button" class="btn btn-light ts-gcol-up">▲</button>
            <button type="button" class="btn btn-light ts-gcol-down">▼</button>
            <button type="button" class="btn btn-outline-danger ts-gcol-del">刪</button>
          </div>
        `;
        holder.appendChild(row);

        const labelInp = row.querySelector('.ts-gcol-label');
        const widthInp = row.querySelector('.ts-gcol-width');

        labelInp.addEventListener('input', ()=>{
          cols[idx].label = labelInp.value;
          block._group.columns = normalizeColumns(cols);
          updateHeadersForLocked(block);
        });
        widthInp.addEventListener('input', ()=>{
          cols[idx].width = Number(widthInp.value) || 0;
          block._group.columns = normalizeColumns(cols);
          applyColgroup(block.querySelector('table.ts-table'), block._group.columns);
        });

        row.querySelector('.ts-gcol-up').addEventListener('click', ()=>{
          if (idx===0) return;
          swap(cols, idx, idx-1);
          block._group.columns = normalizeColumns(cols);
          rebuildLockedHeader(block);
          buildColsInlineEditorRefresh(block, holder);
        });
        row.querySelector('.ts-gcol-down').addEventListener('click', ()=>{
          if (idx>=cols.length-1) return;
          swap(cols, idx, idx+1);
          block._group.columns = normalizeColumns(cols);
          rebuildLockedHeader(block);
          buildColsInlineEditorRefresh(block, holder);
        });
        row.querySelector('.ts-gcol-del').addEventListener('click', ()=>{
          if (cols.length<=1) return;
          cols.splice(idx,1);
          block._group.columns = normalizeColumns(cols);
          rebuildLockedHeader(block, true);
          buildColsInlineEditorRefresh(block, holder);
        });
      });

      const addBtnRow = h('div','');
      addBtnRow.innerHTML = `
        <button type="button" class="btn btn-outline-danger btn-sm">新增欄位</button>
      `;
      addBtnRow.querySelector('button').addEventListener('click', ()=>{
        cols.push({ label:'新欄位', width:0 });
        block._group.columns = normalizeColumns(cols);
        rebuildLockedHeader(block, true);
        buildColsInlineEditorRefresh(block, holder);
      });
      holder.appendChild(addBtnRow);
      return holder;
    }
    function buildColsInlineEditorRefresh(block, holder){
      holder.replaceWith(buildColsInlineEditor(block));
    }
    function rebuildLockedHeader(block, addBlankCells){
      const cols = normalizeColumns(block._group.columns);
      const tr = block.querySelector('thead tr'); tr.innerHTML='';
      cols.forEach(c=>{
        const th = document.createElement('th');
        th.innerHTML = t(c.label);
        tr.appendChild(th);
      });
      const tbody = block.querySelector('tbody');
      tbody.querySelectorAll('tr').forEach(trEl=>{
        while(trEl.children.length > cols.length) trEl.removeChild(trEl.lastElementChild);
        while(trEl.children.length < cols.length){
          const td = document.createElement('td');
          td.setAttribute('data-label', t(cols[trEl.children.length]?.label || ''));
          td.contentEditable = state.mode==='ADMIN';
          td.spellcheck=false;
          if (addBlankCells) td.textContent = '';
          trEl.appendChild(td);
        }
        cols.forEach((c,i)=>{
          const td = trEl.children[i];
          td.setAttribute('data-label', t(c.label));
        });
      });
      applyColgroup(block.querySelector('table.ts-table'), cols);
    }
    function updateHeadersForLocked(block){
      const cols = normalizeColumns(block._group.columns);
      const tr = block.querySelector('thead tr'); if(!tr) return;
      tr.innerHTML='';
      cols.forEach(c=>{
        const th=document.createElement('th');
        th.innerHTML = t(c.label);
        tr.appendChild(th);
      });
      block.querySelectorAll('tbody tr').forEach(trEl=>{
        cols.forEach((c,i)=>{
          const td = trEl.children[i];
          if (td) td.setAttribute('data-label', t(c.label));
        });
      });
      applyColgroup(block.querySelector('table.ts-table'), cols);
    }

    // 建立 group 卡片
    function createGroup(name, { sizeClass='fs-5', icon='' } = {}, rows, columns){
      const gid  = makeId('g');
      const card = h('div','card mb-4 shadow-sm ts-block');
      card.id = `${state.id}-${gid}`;

      const groupMeta = { id: card.id, name, icon, sizeClass, columns: Array.isArray(columns) && columns.length ? normalizeColumns(columns) : null };
      card._group = groupMeta;

      const title = icon
        ? `<i class="${faClass} ${icon} me-2" style="color:${THEME_COLOR};"></i><span class="${sizeClass}">${t(name)}</span>`
        : `<span class="${sizeClass}">${t(name)}</span>`;

      // 鎖定欄位才顯示「編欄」；且僅 ADMIN 有 admin 區塊
      const editColsBtn = groupMeta.columns ? `<button type="button" class="btn btn-sm btn-secondary ts-btn-edit-cols ts-admin">編欄</button>` : '';

      card.innerHTML = `
        <div class="card-header bg-white border-bottom border-danger fw-bold d-flex justify-content-between align-items-center">
          <span class="ts-title">${title}</span>
          <div class="d-flex gap-2 ts-admin">
            ${editColsBtn}
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
          ${groupMeta.columns ? '' : '' }
        </div>`;

      groupsWrap.appendChild(card);

      const useCols = groupMeta.columns ? groupMeta.columns : state.sharedColumns;

      // 表頭
      const tr = card.querySelector('thead tr');
      useCols.forEach(c=>{
        const th = document.createElement('th');
        th.innerHTML = t(c.label);
        tr.appendChild(th);
      });

      // 內容列
      const tbody = card.querySelector('tbody');
      function addRowFromArray(arr){
        const r = document.createElement('tr');
        (groupMeta.columns ? groupMeta.columns : state.sharedColumns).forEach((c,i)=>{
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
        if (state.mode==='ADMIN') addRowFromArray([]);
      }

      // 欄寬
      applyColgroup(card.querySelector('table.ts-table'), useCols);

      // inline 編欄區（僅鎖定欄位 group 有）
      if (groupMeta.columns) {
        const editor = buildColsInlineEditor(card);
        if (editor) card.querySelector('.card-body').appendChild(editor);
      }

      // 記錄 & 錨點
      state.groups.push(groupMeta);
      renderAnchors();

      if (state.mode==='USER') lockAsUser(card);

      return card;
    }

    // ===================== Events (single delegate per host) =====================
    host.addEventListener('click', (e)=>{
      // 切換鎖定 group 的「編欄」面板
      if (e.target.classList.contains('ts-btn-edit-cols')) {
        const block = e.target.closest('.ts-block');
        const p = block.querySelector('.ts-cols-editor');
        if (p) p.classList.toggle('d-none');
        return;
      }
      // 新增列
      if (e.target.classList.contains('ts-btn-add-row')){
        const block = e.target.closest('.ts-block');
        const tbody = block.querySelector('tbody');
        const cols = block._group.columns ? block._group.columns : state.sharedColumns;
        const tr = document.createElement('tr');
        cols.forEach(c=>{
          const td = document.createElement('td');
          td.setAttribute('data-label', t(c.label));
          td.contentEditable = state.mode==='ADMIN';
          td.spellcheck=false;
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
        return;
      }
      // 刪除列（刪到 0 列時自動刪掉整張表與錨點）
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
    });

    // ===================== Mode Lock/Unlock =====================
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

    // ===================== Public API =====================
    function getJSON(){
      const groupsData = state.groups.map(g=>{
        const card = document.getElementById(g.id);
        const tblCols = g.columns ? g.columns : state.sharedColumns;
        const rows = [];
        card.querySelectorAll('tbody tr').forEach(tr=>{
          const arr = Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim());
          if (arr.some(v => v !== '')) rows.push(arr);
        });
        return { name:g.name, icon:g.icon, sizeClass:g.sizeClass, columns: tblCols, rows };
      });
      return {
        schemaVersion: 3,
        updatedAt: Date.now(),
        sharedColumns: state.sharedColumns.map(c => ({ label:c.label, width:c.width })),
        groups: groupsData
      };
    }

    function setJSON(data={}){
      if (Array.isArray(data.sharedColumns) && data.sharedColumns.length) {
        state.sharedColumns = normalizeColumns(data.sharedColumns);
      } else if (Array.isArray(data.columns) && data.columns.length) {
        // 向後相容
        state.sharedColumns = normalizeColumns(data.columns);
      }
      // 重建
      groupsWrap.innerHTML=''; state.groups=[];
      (data.groups||[]).forEach(g=>{
        createGroup(g.name||'未命名類組', { sizeClass:g.sizeClass||'fs-5', icon:g.icon||'' }, g.rows||[], g.columns||null);
      });
      renderAnchors();
      // 套 shared colgroup 到非鎖定的
      $$(groupsWrap,'.ts-block').forEach(block=>{
        if (!block._group.columns) applyColgroup(block.querySelector('table.ts-table'), state.sharedColumns);
      });
    }

    function setMode(next){
      const v = String(next||'USER').toUpperCase()==='ADMIN' ? 'ADMIN' : 'USER';
      state.mode = v;
      if (v==='USER') lockAsUser();
      else unlockAsAdmin();
    }

    function addGroupPublic(name, opts, rows, columns){ return createGroup(name, opts||{}, rows, columns); }

    const api = { getJSON, setJSON, setMode, addGroup: addGroupPublic };
    host._tap_subjects = api;
    return api;
  }

  // ===================== Autoload =====================
  function autoload(){
    document.querySelectorAll('[data-tap-plugin="subjects"]').forEach(node=>{
      if (node._tap_subjects) return;
      mount(node, {}); // 模式自動判定
    });
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', autoload);
  else autoload();

  // export
  global.TAPSubjectsKit = { mount };

})(window);
