/*!
 * FreeTable.js (Subjects Plugin) — v2.5.0
 * - Admin 有「鎖定欄位（顯示編欄）」按鈕，預設不顯示編欄，按了才顯示
 * - 支援 addGroup 的 locks：{ deleteRows?:boolean, deleteGroup?:boolean }
 * - USER 模式看不到任何編輯 UI
 */

(function (global) {
  'use strict';

  // ===== Mode resolver（與前版一致）=====
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

  const DEFAULT_FA  = global.TAP_SUBJECTS_FA_CLASS || 'fa-solid';
  const THEME_COLOR = 'var(--main-red)';

  let INST = 0;
  const uid = (p='ts') => `${p}-${++INST}-${Math.random().toString(36).slice(2,8)}`;
  const t  = s => (s==null ? '' : String(s));
  const $$ = (root, sel)=> Array.from((root instanceof Element?root:document).querySelectorAll(sel));

  // 均分/正規化欄寬
  function normalizeColumns(cols){
    if (!Array.isArray(cols) || !cols.length) return [];
    let out = cols.map(c => (typeof c === 'string')
      ? { label: c, width: 0 }
      : { label: String(c.label || ''), width: Number(c.width) || 0 }
    );
    // 全沒給寬 → 均分
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
  const swap = (arr,i,j)=>{ const tmp=arr[i]; arr[i]=arr[j]; arr[j]=tmp; };

  // ===== 主掛載 =====
  function mount(target, opts={}){
    const host = (typeof target==='string') ? document.querySelector(target) : target;
    if (!host) return null;
    if (host._tap_subjects) return host._tap_subjects; // 防重複

    const mode    = resolveMode(host, opts, global);
    const faClass = host.dataset.fa || opts.faClass || DEFAULT_FA;

    const state = {
      id: uid('ts'),
      mode,
      showColEditor: !!opts.showColEditor,   // 新增：編欄面板是否顯示
      columns: normalizeColumns(
        Array.isArray(opts.columns) && opts.columns.length ? opts.columns.slice()
        : ['高考科目','普考科目','分數比重','名額']
      ),
      groups: [] // { id, name, icon, sizeClass, lockedColumns, locks:{deleteRows,deleteGroup} }
    };

    host.innerHTML = '';
    host.classList.add('tap-subjects');
    host.setAttribute('data-mode', state.mode);

    // 錨點列（只有按鈕）
    const anchors = document.createElement('div');
    anchors.className = 'ts-anchors d-flex flex-wrap gap-2 mb-3';
    host.appendChild(anchors);

    // Admin 控制列：鎖定欄位（顯示編欄）
    let adminBar = null;
    if (state.mode==='ADMIN'){
      adminBar = document.createElement('div');
      adminBar.className = 'd-flex align-items-center gap-2 mb-2 ts-admin';
      adminBar.innerHTML = `
        <button type="button" class="btn btn-outline-danger btn-sm" id="${state.id}-toggle-cols">
          <i class="${faClass} ${state.showColEditor?'fa-lock':'fa-lock-open'} me-1"></i>
          ${state.showColEditor?'關閉編欄':'鎖定欄位（顯示編欄）'}
        </button>
      `;
      host.appendChild(adminBar);
      adminBar.querySelector(`#${state.id}-toggle-cols`).addEventListener('click', ()=>{
        state.showColEditor = !state.showColEditor;
        renderColsPanel();
      });
    }

    // 欄位設定卡（可顯示/隱藏）
    const cfgCols = document.createElement('div');
    cfgCols.className = 'card mb-3 ts-admin';
    cfgCols.innerHTML = `
      <div class="card-header bg-white border-bottom border-danger fw-bold">欄位設定</div>
      <div class="card-body">
        <div class="d-flex flex-wrap align-items-end gap-2 mb-2">
          <button type="button" class="btn btn-outline-danger btn-sm" id="${state.id}-add-col">新增欄位</button>
          <span class="text-muted small">欄位順序 = 表頭順序；可設定每欄寬度（%）</span>
        </div>
        <div id="${state.id}-col-list" class="d-flex flex-column gap-2 mb-1"></div>
      </div>`;
    host.appendChild(cfgCols);

    // 新增類組卡（一直存在，但 USER 隱藏）
    const cfgGroup = document.createElement('div');
    cfgGroup.className = 'card mb-3 ts-admin';
    cfgGroup.innerHTML = `
      <div class="card-header bg-white border-bottom border-danger fw-bold">新增類組</div>
      <div class="card-body">
        <div class="d-flex flex-wrap align-items-end gap-2">
          <div class="flex-grow-1" style="max-width:320px;">
            <label class="form-label small mb-1">類組名稱</label>
            <input type="text" class="form-control form-control-sm" id="${state.id}-group-name" placeholder="例如：共同科目／文組">
          </div>
          <div>
            <label class="form-label small mb-1">字級</label>
            <select class="form-select form-select-sm" id="${state.id}-size">
              <option value="fs-6">小字</option>
              <option value="fs-5" selected>中字</option>
              <option value="fs-4">大字</option>
            </select>
          </div>
          <button type="button" class="btn btn-danger btn-sm" id="${state.id}-add-group">新增類組</button>
        </div>
        <div class="small text-muted mt-2">提示：若想讓此表「欄位與欄寬固定」，請建立後用上方「欄位設定」調整好，再用程式帶 columns 參數建立（或用 getJSON/保存）。</div>
      </div>`;
    host.appendChild(cfgGroup);

    // 類組容器
    const groupsWrap = document.createElement('div');
    groupsWrap.className = 'ts-groups';
    host.appendChild(groupsWrap);

    // ===== 欄位設定面板 =====
    const colList   = cfgCols.querySelector(`#${state.id}-col-list`);
    const btnAddCol = cfgCols.querySelector(`#${state.id}-add-col`);

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
      $$(groupsWrap,'.ts-block:not([data-locked="1"]) table.ts-table').forEach(tbl => applyColgroup(tbl, state.columns));
    };

    function renderColList(){
      colList.innerHTML = '';
      state.columns.forEach((col, idx)=>{
        const row = document.createElement('div');
        row.className = 'd-flex align-items-center gap-2 ts-col-item';
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
          // 套到所有未鎖欄的表
          $$(groupsWrap,'.ts-block:not([data-locked="1"])').forEach(updateHeaders);
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
          $$(groupsWrap,'.ts-block:not([data-locked="1"])').forEach(b=>swapColumns(b, idx, idx-1));
          renderColList(); applyColgroupsToAll();
        });
        row.querySelector('.ts-col-down').addEventListener('click', ()=>{
          if (idx>=state.columns.length-1) return;
          swap(state.columns, idx, idx+1);
          $$(groupsWrap,'.ts-block:not([data-locked="1"])').forEach(b=>swapColumns(b, idx, idx+1));
          renderColList(); applyColgroupsToAll();
        });
        row.querySelector('.ts-col-del').addEventListener('click', ()=>{
          if (state.columns.length<=1) return;
          state.columns.splice(idx,1);
          state.columns = normalizeColumns(state.columns);
          $$(groupsWrap,'.ts-block:not([data-locked="1"])').forEach(b=>deleteColumn(b, idx));
          renderColList(); applyColgroupsToAll();
        });
      });
    }
    btnAddCol.addEventListener('click', ()=>{
      state.columns.push({ label:'新欄位', width: 0 });
      state.columns = normalizeColumns(state.columns);
      $$(groupsWrap,'.ts-block:not([data-locked="1"])').forEach(b=>appendColumn(b,'新欄位'));
      renderColList(); applyColgroupsToAll();
    });
    renderColList();

    function renderColsPanel(){
      // 切換按鈕文案與圖示
      const btn = adminBar?.querySelector(`#${state.id}-toggle-cols`);
      if (btn){
        btn.innerHTML = `
          <i class="${faClass} ${state.showColEditor?'fa-lock':'fa-lock-open'} me-1"></i>
          ${state.showColEditor?'關閉編欄':'鎖定欄位（顯示編欄）'}
        `;
      }
      cfgCols.style.display = state.showColEditor ? '' : 'none';
    }
    renderColsPanel();

    // ===== 新增類組 =====
    cfgGroup.querySelector(`#${state.id}-add-group`)?.addEventListener('click', ()=>{
      const name = (cfgGroup.querySelector(`#${state.id}-group-name`).value||'').trim() || '未命名類組';
      const sizeClass = cfgGroup.querySelector(`#${state.id}-size`).value || 'fs-5';
      addGroup(name, { sizeClass });
      cfgGroup.querySelector(`#${state.id}-group-name`).value = '';
    });

    function updateHeaders(block){
      const tr = block.querySelector('thead tr'); if(!tr) return;
      const localCols = block.dataset.locked==='1'
        ? JSON.parse(block.dataset.localColumns||'[]')
        : state.columns;

      tr.innerHTML='';
      localCols.forEach(c=>{
        const th=document.createElement('th');
        th.innerHTML = t(c.label);
        tr.appendChild(th);
      });
      const rows = block.querySelectorAll('tbody tr');
      rows.forEach(trEl=>{
        while(trEl.children.length > localCols.length) trEl.removeChild(trEl.lastElementChild);
        while(trEl.children.length < localCols.length){
          const td=document.createElement('td');
          td.contentEditable = state.mode==='ADMIN';
          td.spellcheck=false;
          trEl.appendChild(td);
        }
        localCols.forEach((c,i)=>{
          const td = trEl.children[i];
          td.setAttribute('data-label', t(c.label));
        });
      });
      applyColgroup(block.querySelector('table.ts-table'), localCols);
    }
    function swapColumns(block, i, j){
      const tr = block.querySelector('thead tr'), ths = Array.from(tr.children);
      if (ths[i] && ths[j]) tr.insertBefore(ths[j], ths[i]);
      block.querySelectorAll('tbody tr').forEach(trEl=>{
        const tds = Array.from(trEl.children);
        if (tds[i] && tds[j]) trEl.insertBefore(tds[j], tds[i]);
      });
      const labels = (block.dataset.locked==='1'
        ? JSON.parse(block.dataset.localColumns||'[]')
        : state.columns).map(c=>c.label);
      block.querySelectorAll('tbody tr').forEach(trEl=>{
        Array.from(trEl.children).forEach((td, idx)=> td.setAttribute('data-label', labels[idx]||''));
      });
    }
    function deleteColumn(block, idx){
      const th = block.querySelector(`thead th:nth-child(${idx+1})`); if(th) th.remove();
      block.querySelectorAll('tbody tr').forEach(trEl=>{
        const td = trEl.querySelector(`td:nth-child(${idx+1})`); if(td) td.remove();
      });
      applyColgroup(block.querySelector('table.ts-table'),
        (block.dataset.locked==='1' ? JSON.parse(block.dataset.localColumns||'[]') : state.columns));
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
      applyColgroup(block.querySelector('table.ts-table'),
        (block.dataset.locked==='1' ? JSON.parse(block.dataset.localColumns||'[]') : state.columns));
    }

    function renderAnchors(){
      anchors.innerHTML = '';
      state.groups.forEach(g=>{
        const a = document.createElement('a');
        a.className = 'btn btn-outline-danger btn-sm';
        a.href = `#${g.id}`;
        a.innerHTML = t(g.name);
        anchors.appendChild(a);
      });
    }

    // 新增「卡片」
    function addGroup(name, opts={}, rows, localColumns){
      const gid  = uid('g');
      const card = document.createElement('div');
      card.className = 'card mb-4 shadow-sm ts-block';
      card.id = `${state.id}-${gid}`;

      const sizeClass = opts.sizeClass || 'fs-5';
      const lockedColumns = Array.isArray(localColumns) && localColumns.length;
      const locks = Object.assign({ deleteRows:true, deleteGroup:true }, opts.locks||{});

      card.setAttribute('data-locked', lockedColumns ? '1' : '0');
      if (lockedColumns) card.dataset.localColumns = JSON.stringify(normalizeColumns(localColumns));

      // 抬頭（新增/刪除列）
      card.innerHTML = `
        <div class="card-header bg-white border-bottom border-danger fw-bold d-flex justify-content-between align-items-center">
          <span class="ts-title ${sizeClass}">${t(name)}</span>
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
      const headerCols = lockedColumns ? normalizeColumns(localColumns) : state.columns;
      headerCols.forEach(c=>{
        const th = document.createElement('th');
        th.innerHTML = t(c.label);
        tr.appendChild(th);
      });

      // 內容列
      const tbody = card.querySelector('tbody');
      function addRowFromArray(arr){
        const r = document.createElement('tr');
        headerCols.forEach((c,i)=>{
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
      } else if (state.mode==='ADMIN') {
        addRowFromArray([]);
      }

      // 套欄寬
      applyColgroup(card.querySelector('table.ts-table'), headerCols);

      // 記錄
      state.groups.push({ id: card.id, name, sizeClass, lockedColumns, locks });

      // UI：若不允許刪列，隱藏該鈕
      if (state.mode==='ADMIN' && locks.deleteRows === false){
        const delBtn = card.querySelector('.ts-btn-del-row');
        if (delBtn) delBtn.style.display = 'none';
      }

      renderAnchors();
      if (state.mode==='USER') lockAsUser(card);
      return card;
    }

    // 事件委派：新增/刪除列
    host.addEventListener('click', (e)=>{
      if (e.target.classList.contains('ts-btn-add-row')){
        const block = e.target.closest('.ts-block');
        const id = block.id;
        const meta = state.groups.find(g=>g.id===id) || {};
        const cols = (block.dataset.locked==='1'
          ? JSON.parse(block.dataset.localColumns||'[]')
          : state.columns);
        const tbody = block.querySelector('tbody');
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
      if (e.target.classList.contains('ts-btn-del-row')){
        const block = e.target.closest('.ts-block');
        const id = block.id;
        const meta = state.groups.find(g=>g.id===id) || {};
        if (meta.locks && meta.locks.deleteRows === false) {
          // 禁刪列
          return;
        }
        const tbody = block.querySelector('tbody');
        const rows = Array.from(tbody.querySelectorAll('tr'));
        if (!rows.length) return;

        // 如果刪到 0 列，檢查是否允許刪整張表
        if (rows.length === 1) {
          if (meta.locks && meta.locks.deleteGroup === false) {
            // 不允許刪整張表 → 直接擋下
            return;
          }
          // 允許 → 刪表 + 移除錨點
          rows[0].remove();
          block.remove();
          const idx = state.groups.findIndex(g=>g.id===id);
          if (idx>-1) state.groups.splice(idx,1);
          renderAnchors();
          return;
        }

        // 一般刪最後一列
        rows[rows.length-1].remove();
        return;
      }
    });

    // USER 鎖定
    function lockAsUser(scope){
      (scope||host).querySelectorAll('.ts-admin').forEach(n=> n.style.display='none');
      (scope||host).querySelectorAll('[contenteditable="true"]').forEach(td=> td.setAttribute('contenteditable','false'));
      host.setAttribute('data-mode','USER');
    }
    if (state.mode==='USER') lockAsUser();

    // ===== 對外 API =====
    function getJSON(){
      const groupsData = state.groups.map(g=>{
        const card = document.getElementById(g.id);
        const rows = [];
        card.querySelectorAll('tbody tr').forEach(tr=>{
          const arr = Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim());
          if (arr.some(v => v !== '')) rows.push(arr);
        });
        const cols = (card.dataset.locked==='1'
          ? JSON.parse(card.dataset.localColumns||'[]')
          : state.columns);
        return { name:g.name, sizeClass:g.sizeClass, lockedColumns:!!g.lockedColumns, columns: cols, rows, locks: g.locks||{} };
      });
      return { schemaVersion: 3, updatedAt: Date.now(), columns: state.columns, groups: groupsData };
    }

    function setJSON(data={}){
      // 全域欄
      if (Array.isArray(data.columns) && data.columns.length) {
        state.columns = normalizeColumns(data.columns);
      }
      // 清空並重建
      groupsWrap.innerHTML=''; state.groups=[];
      (data.groups||[]).forEach(g=>{
        addGroup(g.name||'未命名類組',
          { sizeClass:g.sizeClass||'fs-5', locks: g.locks||{} },
          g.rows||[],
          g.lockedColumns ? (g.columns||[]) : null
        );
      });
      renderAnchors();
      renderColList();
      applyColgroupsToAll();
    }

    function setMode(next){
      const v = String(next||'USER').toUpperCase()==='ADMIN' ? 'ADMIN' : 'USER';
      state.mode = v;
      if (v==='USER') lockAsUser();
      else { host.querySelectorAll('td').forEach(td=> td.contentEditable=true); host.querySelectorAll('.ts-admin').forEach(n=> n.style.display=''); renderColsPanel(); }
    }

    const api = {
      getJSON, setJSON, setMode,
      addGroup: (name, opts, rows, columns)=> addGroup(name, opts||{}, rows, columns)
    };
    host._tap_subjects = api;
    return api;
  }

  // 自動掛載
  function autoload(){
    document.querySelectorAll('[data-tap-plugin="subjects"]').forEach(node=>{
      if (node._tap_subjects) return;
      mount(node, {});
    });
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', autoload);
  else autoload();

  // 導出
  global.TAPSubjectsKit = { mount };

})(window);
