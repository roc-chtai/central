/*!
 * TAPSubjectsKit — 高普考科目自訂表格（可重用插件 / XOOPS Admin 版）
 * v2.5.x
 *
 * 召喚：
 *   <div data-tap-plugin="subjects"></div>  // 自動掛載（會自動判定 ADMIN/USER）
 *   // 或手動：
 *   const api = TAPSubjectsKit.mount('#subjectsPlugin', {
 *     columns: [ {label:'考科',width:30}, {label:'科目名稱',width:54}, {label:'錄取(備取)',width:16} ]
 *   });
 *
 * 模式自動判定（命中一個就回傳）：
 *   opts.mode / data-mode
 *   window.TAP_DETECT_MODE()          // 你可在頁面定義回傳 'ADMIN' | 'USER'
 *   window.XOOPS_IS_ADMIN === true | 1 | '1'
 *   window.MODE == 'ADMIN' | 'USER'
 *   window.TAP_SUBJECTS_DEFAULT_MODE
 *   預設 'USER'
 *
 * ※ Font Awesome：預設使用 FA6 'fa-solid'，可用 window.TAP_SUBJECTS_FA_CLASS 覆寫
 */

(function (global) {
  'use strict';

  // ============== 基本設定 & 小工具 ==============
  const DEFAULT_FA  = global.TAP_SUBJECTS_FA_CLASS || 'fa-solid';
  const THEME_COLOR = 'var(--main-red, #ea7066)';

  const ICON_SET = [
    '', 'fa-book', 'fa-users', 'fa-gavel', 'fa-briefcase', 'fa-stethoscope',
    'fa-flask', 'fa-cog', 'fa-chart-line', 'fa-university', 'fa-user-graduate', 'fa-scale-balanced'
  ];

  let INST = 0;
  const makeId = (p='ts') => `${p}-${++INST}-${Math.random().toString(36).slice(2,8)}`;
  const t  = (s)=> (s==null ? '' : String(s));
  const $$ = (root, sel)=> Array.from((root instanceof Element?root:document).querySelectorAll(sel));
  const swap = (arr,i,j)=>{ const tmp=arr[i]; arr[i]=arr[j]; arr[j]=tmp; };
  const cloneCols = (cols=[]) => cols.map(c => ({ label: String(c.label||''), width: Number(c.width)||0 }));

  function h(tag, cls, html){
    const el = document.createElement(tag);
    if (cls)  el.className = cls;
    if (html!=null) el.innerHTML = html;
    return el;
  }

  // 欄寬正規化（總和=100，最小 5%）
  function normalizeColumns(cols){
    if (!Array.isArray(cols) || !cols.length) return [];
    let out = cols.map(c => (typeof c === 'string')
      ? { label: c, width: 0 }
      : { label: String(c.label || ''), width: Number(c.width) || 0 }
    );
    if (!out.some(c => c.width > 0)) {
      const per = Math.max(5, Math.round(100 / out.length));
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

  // 模式判定（含 XOOPS）
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
    // XOOPS：true / 1 / '1' 都視為 admin
    if (global.XOOPS_IS_ADMIN === true || global.XOOPS_IS_ADMIN === 1 || global.XOOPS_IS_ADMIN === '1') return 'ADMIN';
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

  // ============== Icon Picker（極簡） ==============
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

  // ============== 主掛載 ==============
  function mount(target, opts={}){
    const host = (typeof target==='string') ? document.querySelector(target) : target;
    if (!host) return null;
    if (host._tap_subjects) return host._tap_subjects; // 防重複

    const mode    = resolveMode(host, opts, global);
    const faClass = host.dataset.fa || opts.faClass || DEFAULT_FA;

    const state = {
      id: makeId('ts'),
      mode, // 'ADMIN' | 'USER'
      sharedColumns: normalizeColumns(
        Array.isArray(opts.columns) && opts.columns.length ? opts.columns.slice()
        : ['高考科目','普考科目','分數比重','名額']
      ),
      groups: [] // {id, name, icon, sizeClass, locked, columns?}
    };

    host.innerHTML = '';
    host.classList.add('tap-subjects');
    host.setAttribute('data-mode', state.mode);

    // Anchors（依插入順序）
    const anchors = h('div','ts-anchors d-flex flex-wrap gap-2 mb-3');
    host.appendChild(anchors);

    // ===== Admin 設定卡（只有 ADMIN 才渲染）=====
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

      // 欄位設定 UI
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
              if (!block._group.locked) swapColumns(block, idx, idx-1);
            });
            renderColList(); applyColgroupsToAllShared();
          });
          row.querySelector('.ts-col-down').addEventListener('click', ()=>{
            if (idx>=state.sharedColumns.length-1) return;
            swap(state.sharedColumns, idx, idx+1);
            $$(groupsWrap,'.ts-block').forEach(block=>{
              if (!block._group.locked) swapColumns(block, idx, idx+1);
            });
            renderColList(); applyColgroupsToAllShared();
          });
          row.querySelector('.ts-col-del').addEventListener('click', ()=>{
            if (state.sharedColumns.length<=1) return;
            state.sharedColumns.splice(idx,1);
            state.sharedColumns = normalizeColumns(state.sharedColumns);
            $$(groupsWrap,'.ts-block').forEach(block=>{
              if (!block._group.locked) deleteColumn(block, idx);
            });
            renderColList(); applyColgroupsToAllShared();
          });
        });
      }
      btnAddCol.addEventListener('click', ()=>{
        state.sharedColumns.push({ label:'新欄位', width: 0 });
        state.sharedColumns = normalizeColumns(state.sharedColumns);
        $$(groupsWrap,'.ts-block').forEach(block=>{
          if (!block._group.locked) appendColumn(block,'新欄位');
        });
        renderColList(); applyColgroupsToAllShared();
      });
      renderColList();

      function applyColgroupsToAllShared(){
        $$(groupsWrap,'.ts-block').forEach(block=>{
          if (!block._group.locked) applyColgroup(block.querySelector('table.ts-table'), state.sharedColumns);
        });
      }

      // 新增類組
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

    // ===== 共用小工具 =====
    function labelsOf(columns){ return normalizeColumns(columns).map(c=>c.label); }

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
      if (block._group.locked) return; // 鎖定的不吃 shared
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
      const labels = (block._group.locked ? labelsOf(block._group.columns) : labelsOf(state.sharedColumns));
      block.querySelectorAll('tbody tr').forEach(trEl=>{
        Array.from(trEl.children).forEach((td, idx)=> td.setAttribute('data-label', labels[idx]||''));
      });
    }
    function deleteColumn(block, idx){
      const th = block.querySelector(`thead th:nth-child(${idx+1})`); if(th) th.remove();
      block.querySelectorAll('tbody tr').forEach(trEl=>{
        const td = trEl.querySelector(`td:nth-child(${idx+1})`); if(td) td.remove();
      });
      const cols = block._group.locked ? block._group.columns : state.sharedColumns;
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
      const cols = block._group.locked ? block._group.columns : state.sharedColumns;
      applyColgroup(block.querySelector('table.ts-table'), cols);
    }

    // ===== 鎖定欄位：UI 與編輯面板 =====
    function updateLockUI(block){
      const g = block._group;
      const toggleBtn = block.querySelector('.ts-btn-toggle-lock');
      const editBtn   = block.querySelector('.ts-btn-edit-cols');
      const editor    = block.querySelector('.ts-cols-editor');

      if (g.locked){
        if (toggleBtn) toggleBtn.textContent = '解鎖（跟隨全域）';
        if (editBtn)   editBtn.style.display = '';
        if (editor)    editor.classList.add('d-none'); // 預設收起
      } else {
        if (toggleBtn) toggleBtn.textContent = '鎖定欄位';
        if (editBtn)   editBtn.style.display = 'none';
        if (editor)    editor.remove(); // 解鎖時直接移除專屬編輯器
      }
    }

    function buildColsInlineEditor(block){
      const g = block._group;
      if (!g.locked) return null;

      const holder = h('div','p-2 border-top d-none ts-admin ts-cols-editor');
      const cols = normalizeColumns(g.columns);

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
          g.columns = normalizeColumns(cols);
          updateHeadersForLocked(block);
        });
        widthInp.addEventListener('input', ()=>{
          cols[idx].width = Number(widthInp.value) || 0;
          g.columns = normalizeColumns(cols);
          applyColgroup(block.querySelector('table.ts-table'), g.columns);
        });

        row.querySelector('.ts-gcol-up').addEventListener('click', ()=>{
          if (idx===0) return;
          swap(cols, idx, idx-1);
          g.columns = normalizeColumns(cols);
          rebuildLockedHeader(block, true);
          refreshColsEditor(block, holder);
        });
        row.querySelector('.ts-gcol-down').addEventListener('click', ()=>{
          if (idx>=cols.length-1) return;
          swap(cols, idx, idx+1);
          g.columns = normalizeColumns(cols);
          rebuildLockedHeader(block, true);
          refreshColsEditor(block, holder);
        });
        row.querySelector('.ts-gcol-del').addEventListener('click', ()=>{
          if (cols.length<=1) return;
          cols.splice(idx,1);
          g.columns = normalizeColumns(cols);
          rebuildLockedHeader(block, true);
          refreshColsEditor(block, holder);
        });
      });

      const addBtnRow = h('div','');
      addBtnRow.innerHTML = `<button type="button" class="btn btn-outline-danger btn-sm">新增欄位</button>`;
      addBtnRow.querySelector('button').addEventListener('click', ()=>{
        cols.push({ label:'新欄位', width:0 });
        g.columns = normalizeColumns(cols);
        rebuildLockedHeader(block, true);
        refreshColsEditor(block, holder);
      });
      holder.appendChild(addBtnRow);

      return holder;
    }

    function refreshColsEditor(block, holder){
      const next = buildColsInlineEditor(block);
      holder.replaceWith(next);
    }

    function rebuildLockedHeader(block, addMissingCells){
      const g = block._group;
      const cols = normalizeColumns(g.columns);
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
          if (addMissingCells) td.textContent = '';
          trEl.appendChild(td);
        }
        cols.forEach((c,i)=>{
          const td = trEl.children[i];
          if (td) td.setAttribute('data-label', t(c.label));
        });
      });
      applyColgroup(block.querySelector('table.ts-table'), cols);
    }

    function updateHeadersForLocked(block){
      const g = block._group;
      const cols = normalizeColumns(g.columns);
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

    // ===== 產生群組卡片 =====
    function createGroup(name, { sizeClass='fs-5', icon='' } = {}, rows, columns){
      const gid  = makeId('g');
      const card = h('div','card mb-4 shadow-sm ts-block');
      card.id = `${state.id}-${gid}`;

      const groupMeta = {
        id: card.id,
        name, icon, sizeClass,
        locked: Array.isArray(columns) && columns.length ? true : false,
        columns: Array.isArray(columns) && columns.length ? normalizeColumns(columns) : cloneCols(state.sharedColumns)
      };
      if (!groupMeta.locked) groupMeta.columns = null; // 未鎖定就跟隨 shared

      card._group = groupMeta;

      const title = icon
        ? `<i class="${faClass} ${icon} me-2" style="color:${THEME_COLOR};"></i><span class="${sizeClass}">${t(name)}</span>`
        : `<span class="${sizeClass}">${t(name)}</span>`;

      const editColsBtn = `<button type="button" class="btn btn-sm btn-secondary ts-btn-edit-cols ts-admin" style="display:none;">編欄</button>`;

      card.innerHTML = `
        <div class="card-header bg-white border-bottom border-danger fw-bold d-flex justify-content-between align-items-center">
          <span class="ts-title">${title}</span>
          <div class="d-flex gap-2 ts-admin">
            <button type="button" class="btn btn-sm btn-outline-secondary ts-btn-toggle-lock">鎖定欄位</button>
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
        </div>`;

      groupsWrap.appendChild(card);

      const useCols = groupMeta.locked ? groupMeta.columns : state.sharedColumns;

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
        (groupMeta.locked ? groupMeta.columns : state.sharedColumns).forEach((c,i)=>{
          const td = document.createElement('td');
          td.setAttribute('data-label', t(c.label));
          td.contentEditable = state.mode==='ADMIN';
          td.spellcheck = false;
          td.textContent = t(arr?.[i] || '');
          r.appendChild(td);
        });
        tbody.appendChild(r);
      }
      if (Array.isArray(rows) && rows.length) rows.forEach(addRowFromArray);
      else if (state.mode==='ADMIN') addRowFromArray([]);

      // 套欄寬
      applyColgroup(card.querySelector('table.ts-table'), useCols);

      // 專屬欄位編輯器（只在「鎖定」時存在）
      if (groupMeta.locked) {
        const editor = buildColsInlineEditor(card);
        if (editor) card.querySelector('.card-body').appendChild(editor);
      }

      // 記錄 & 錨點
      state.groups.push(groupMeta);
      renderAnchors();

      if (state.mode==='USER') lockAsUser(card);

      // 初次 UI 調整
      updateLockUI(card);
      return card;
    }

   // ===== 事件（單一委派）=====
host.addEventListener('click', (e)=>{

  // 鎖定/解鎖欄位
  if (e.target.classList.contains('ts-btn-toggle-lock')) {
    const block = e.target.closest('.ts-block');
    const g = block._group;
    if (g.locked) {
      // 解鎖：改用 sharedColumns
      g.locked = false;
      g.columns = null;
      updateHeadersForShared(block);
      applyColgroup(block.querySelector('table.ts-table'), state.sharedColumns);
    } else {
      // 鎖定：複製目前有效欄位做為群組 columns
      g.locked = true;
      g.columns = cloneCols(state.sharedColumns);
      rebuildLockedHeader(block, false);
      applyColgroup(block.querySelector('table.ts-table'), g.columns);
      // 若沒有專屬編欄面板就建立一次
      let editor = block.querySelector('.ts-cols-editor');
      if (!editor) {
        editor = buildColsInlineEditor(block);
        if (editor) block.querySelector('.card-body').appendChild(editor);
      }
    }
    updateLockUI(block);
    return;
  }

  // 顯示/收起「編欄」面板（僅鎖定狀態有此鈕）
  // 兼容舊 class 名：ts-btn-edit-columns
  if (
    e.target.classList.contains('ts-btn-edit-cols') ||
    e.target.classList.contains('ts-btn-edit-columns')
  ) {
    e.stopPropagation(); // 不讓外層任何點擊監聽到
    const block = e.target.closest('.ts-block');
    let editor = block.querySelector('.ts-cols-editor');
    if (!editor) {
      editor = buildColsInlineEditor(block);
      if (editor) block.querySelector('.card-body').appendChild(editor);
    }
    if (editor) editor.classList.toggle('d-none');
    return;
  }

  // 新增列
  if (e.target.classList.contains('ts-btn-add-row')){
    const block = e.target.closest('.ts-block');
    const tbody = block.querySelector('tbody');
    const cols = block._group.locked ? block._group.columns : state.sharedColumns;
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

  // 刪除列（刪到 0 會刪整張表 & 錨點）
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

host.addEventListener('click', (e)=>{
  if (e.target.closest('.ts-cols-editor')) e.stopPropagation();
});

    // ===== 模式切換 =====
    function lockAsUser(scope){
      (scope||host).querySelectorAll('.ts-admin').forEach(n=> n.style.display='none');
      (scope||host).querySelectorAll('[contenteditable="true"]').forEach(td=> td.setAttribute('contenteditable','false'));
      host.setAttribute('data-mode','USER');
    }
    function unlockAsAdmin(scope){
      (scope||host).querySelectorAll('.ts-admin').forEach(n=> n.style.display='');
      (scope||host).querySelectorAll('td, th').forEach(el=> el.setAttribute('contenteditable','true'));
      host.setAttribute('data-mode','ADMIN');
    }
    if (state.mode==='USER') lockAsUser();

    // ===== 公開 API =====
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
        schemaVersion: 4,
        updatedAt: Date.now(),
        sharedColumns: state.sharedColumns.map(c => ({ label:c.label, width:c.width })),
        groups: groupsData
      };
    }

    function setJSON(data={}){
      if (Array.isArray(data.sharedColumns) && data.sharedColumns.length) {
        state.sharedColumns = normalizeColumns(data.sharedColumns);
      } else if (Array.isArray(data.columns) && data.columns.length) {
        // 舊資料相容
        state.sharedColumns = normalizeColumns(data.columns);
      }

      groupsWrap.innerHTML=''; state.groups=[];
      (data.groups||[]).forEach(g=>{
        const card = createGroup(
          g.name||'未命名類組',
          { sizeClass:g.sizeClass||'fs-5', icon:g.icon||'' },
          g.rows||[],
          (g.locked && Array.isArray(g.columns) && g.columns.length) ? g.columns : null
        );
        updateLockUI(card);
      });

      // 套 shared colgroup 到非鎖定的
      $$(groupsWrap,'.ts-block').forEach(block=>{
        if (!block._group.locked) applyColgroup(block.querySelector('table.ts-table'), state.sharedColumns);
      });
    }

    function setMode(next){
      const v = String(next||'USER').toUpperCase()==='ADMIN' ? 'ADMIN' : 'USER';
      state.mode = v;
      if (v==='USER') lockAsUser();
      else unlockAsAdmin();
    }

    function addGroupPublic(name, opts={}, rows=[], columns){
      return createGroup(name, opts||{}, rows||[], columns);
    }

    const api = { getJSON, setJSON, setMode, addGroup: addGroupPublic };
    host._tap_subjects = api;
    return api;
  }

  // ============== 自動掛載 ==============
  function autoload(){
    document.querySelectorAll('[data-tap-plugin="subjects"]').forEach(node=>{
      if (node._tap_subjects) return;
      mount(node, {}); // 自動判定模式
    });
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', autoload);
  else autoload();

  // export
  global.TAPSubjectsKit = { mount };

})(window);
