/*!
 * FreeTable.js (Subjects Plugin) — per-table lock columns
 * - 每張表抬頭自帶「鎖定欄位」按鈕；鎖後才出現該表的欄位編輯面板
 * - USER 模式自動隱藏所有 .ts-admin 功能
 * - 支援 locks: { deleteRows?:boolean, deleteGroup?:boolean }
 */

(function (global) {
  'use strict';

  // -------- Mode 判定（支援 XOOPS、全域常數、dataset、opts）--------
  function resolveMode(host, opts, g){
    const explicit = (opts && opts.mode) || (host && host.dataset && host.dataset.mode);
    if (explicit) {
      const v = String(explicit).toUpperCase();
      if (v==='ADMIN' || v==='USER') return v;
    }
    if (typeof g.TAP_DETECT_MODE === 'function') {
      const v = String(g.TAP_DETECT_MODE() || '').toUpperCase();
      if (v==='ADMIN' || v==='USER') return v;
    }
    if (g.XOOPS_IS_ADMIN === true) return 'ADMIN';
    if (typeof g.MODE === 'string') {
      const v = g.MODE.toUpperCase();
      if (v==='ADMIN' || v==='USER') return v;
    }
    if (typeof g.TAP_SUBJECTS_DEFAULT_MODE === 'string') {
      const v = g.TAP_SUBJECTS_DEFAULT_MODE.toUpperCase();
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
  const swap = (arr,i,j)=>{ const tmp=arr[i]; arr[i]=arr[j]; arr[j]=tmp; };

  function clone(obj){ return JSON.parse(JSON.stringify(obj)); }

  // 欄寬正規化（總和 = 100、每欄 >= 5%）
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

  // -------- 主掛載 --------
  function mount(target, opts={}){
    const host = (typeof target==='string') ? document.querySelector(target) : target;
    if (!host) return null;
    if (host._tap_subjects) return host._tap_subjects; // guard

    const mode    = resolveMode(host, opts, global);
    const faClass = host.dataset.fa || opts.faClass || DEFAULT_FA;

    const state = {
      id: uid('ts'),
      mode,
      columns: normalizeColumns(
        Array.isArray(opts.columns) && opts.columns.length ? opts.columns.slice()
        : ['高考科目','普考科目','分數比重','名額']
      ),
      groups: [] // { id, name, sizeClass, locked:bool, locks:{...} }
    };

    // 骨架
    host.innerHTML = '';
    host.classList.add('tap-subjects');
    host.setAttribute('data-mode', state.mode);

    const anchors = document.createElement('div');
    anchors.className = 'ts-anchors d-flex flex-wrap gap-2 mb-3';
    host.appendChild(anchors);

    // 新增類組（ADMIN 才顯示）
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
      </div>`;
    host.appendChild(cfgGroup);

    const groupsWrap = document.createElement('div');
    groupsWrap.className = 'ts-groups';
    host.appendChild(groupsWrap);

    // 事件：新增類組
    cfgGroup.querySelector(`#${state.id}-add-group`)?.addEventListener('click', ()=>{
      const name = (cfgGroup.querySelector(`#${state.id}-group-name`).value||'').trim() || '未命名類組';
      const sizeClass = cfgGroup.querySelector(`#${state.id}-size`).value || 'fs-5';
      addGroup(name, { sizeClass });
      cfgGroup.querySelector(`#${state.id}-group-name`).value = '';
    });

    // ---- 共同工具 ----
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
    function renderAnchors(){
      anchors.innerHTML = '';
      state.groups.forEach(g=>{
        const a = document.createElement('a');
        a.className = 'btn btn-outline-danger btn-sm';
        a.href = `#${g.id}`;
        a.textContent = g.name;
        anchors.appendChild(a);
      });
    }
    function getActiveCols(block){
      return block.dataset.locked==='1'
        ? JSON.parse(block.dataset.localColumns||'[]')
        : state.columns;
    }
    function setLocalCols(block, cols){
      block.dataset.localColumns = JSON.stringify(normalizeColumns(cols||[]));
      updateHeaders(block);
    }

    // ---- 建立一張表 ----
    function addGroup(name, opts={}, rows, columns){
      const gid  = uid('g');
      const card = document.createElement('div');
      card.className = 'card mb-4 shadow-sm ts-block';
      card.id = `${state.id}-${gid}`;

      const sizeClass = opts.sizeClass || 'fs-5';
      const locks = Object.assign({ deleteRows:true, deleteGroup:true }, opts.locks||{});
      const startLocked = Array.isArray(columns) && columns.length>0;

      if (startLocked){
        card.setAttribute('data-locked','1');
        card.dataset.localColumns = JSON.stringify(normalizeColumns(columns));
      } else {
        card.setAttribute('data-locked','0');
      }

      // Header（新增/刪除/鎖定欄位）
      card.innerHTML = `
        <div class="card-header bg-white border-bottom border-danger fw-bold d-flex justify-content-between align-items-center">
          <span class="ts-title ${sizeClass}">${t(name)}</span>
          <div class="d-flex gap-2 ts-admin">
            <button type="button" class="btn btn-sm btn-danger ts-btn-add-row">新增列</button>
            <button type="button" class="btn btn-sm btn-danger ts-btn-del-row"${locks.deleteRows===false?' style="display:none"':''}>刪除列</button>
            <button type="button" class="btn btn-sm btn-outline-danger ts-btn-lock">
              <i class="${DEFAULT_FA} ${startLocked?'fa-lock':'fa-lock-open'} me-1"></i>${startLocked?'解除鎖定欄位':'鎖定欄位'}
            </button>
          </div>
        </div>
        <div class="ts-col-editor ts-admin" style="${startLocked?'':'display:none'}"></div>
        <div class="card-body p-0">
          <table class="table table-bordered mb-0 align-middle ts-table">
            <colgroup></colgroup>
            <thead class="table-danger"><tr></tr></thead>
            <tbody></tbody>
          </table>
        </div>`;

      groupsWrap.appendChild(card);

      // 表頭與初始列
      updateHeaders(card);
      const tbody = card.querySelector('tbody');
      function addRowFromArray(arr){
        const r = document.createElement('tr');
        getActiveCols(card).forEach((c,i)=>{
          const td = document.createElement('td');
          td.setAttribute('data-label', t(c.label));
          td.contentEditable = state.mode==='ADMIN';
          td.spellcheck=false;
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
      applyColgroup(card.querySelector('table.ts-table'), getActiveCols(card));

      // 記錄
      state.groups.push({ id: card.id, name, sizeClass, locked: startLocked, locks });

      // 如果一開始就鎖定，建 col-editor
      if (startLocked) buildColEditor(card);

      renderAnchors();
      if (state.mode==='USER') lockAsUser(card);
      return card;
    }

    // ---- 表頭/欄位調整 ----
    function updateHeaders(block){
      const tr = block.querySelector('thead tr'); if(!tr) return;
      const cols = getActiveCols(block);
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

    // ---- 建立該表的欄位編輯器（只在鎖定時顯示）----
    function buildColEditor(block){
      const holder = block.querySelector('.ts-col-editor');
      const cols = getActiveCols(block);
      holder.innerHTML = `
        <div class="p-2">
          <div class="d-flex align-items-center justify-content-between mb-2">
            <div class="fw-bold text-danger">欄位設定（僅此表）</div>
            <button type="button" class="btn btn-sm btn-outline-secondary ts-col-add">新增欄位</button>
          </div>
          <div class="ts-col-list d-flex flex-column gap-2"></div>
        </div>
      `;
      const list = holder.querySelector('.ts-col-list');

      function render(){
        const data = getActiveCols(block);
        list.innerHTML = '';
        data.forEach((c, idx)=>{
          const row = document.createElement('div');
          row.className = 'd-flex align-items-center gap-2';
          row.innerHTML = `
            <input type="text" class="form-control form-control-sm ts-col-label" value="${t(c.label).replace(/"/g,'&quot;')}" placeholder="欄位名稱">
            <div class="input-group input-group-sm" style="width:100px;">
              <input type="number" class="form-control ts-col-width" min="5" max="100" step="5" value="${c.width}">
              <span class="input-group-text">%</span>
            </div>
            <div class="btn-group btn-group-sm">
              <button type="button" class="btn btn-light ts-col-up">▲</button>
              <button type="button" class="btn btn-light ts-col-down">▼</button>
              <button type="button" class="btn btn-outline-danger ts-col-del">刪</button>
            </div>`;
          list.appendChild(row);

          const labelInp = row.querySelector('.ts-col-label');
          const widthInp = row.querySelector('.ts-col-width');

          labelInp.addEventListener('input', ()=>{
            const cols = getActiveCols(block);
            cols[idx].label = labelInp.value;
            setLocalCols(block, cols);
          });
          widthInp.addEventListener('input', ()=>{
            const cols = getActiveCols(block);
            cols[idx].width = Number(widthInp.value)||0;
            setLocalCols(block, normalizeColumns(cols));
            render();
          });
          row.querySelector('.ts-col-up').addEventListener('click', ()=>{
            const cols = getActiveCols(block); if (idx===0) return;
            swap(cols, idx, idx-1); setLocalCols(block, cols); render();
          });
          row.querySelector('.ts-col-down').addEventListener('click', ()=>{
            const cols = getActiveCols(block); if (idx>=cols.length-1) return;
            swap(cols, idx, idx+1); setLocalCols(block, cols); render();
          });
          row.querySelector('.ts-col-del').addEventListener('click', ()=>{
            let cols = getActiveCols(block); if (cols.length<=1) return;
            cols.splice(idx,1); cols = normalizeColumns(cols); setLocalCols(block, cols); render();
          });
        });
      }
      render();

      holder.querySelector('.ts-col-add').addEventListener('click', ()=>{
        const cols = getActiveCols(block);
        cols.push({ label:'新欄位', width: 0 });
        setLocalCols(block, normalizeColumns(cols));
        buildColEditor(block);
      });
    }

    // ---- 事件委派：每張表的新增/刪除列、鎖定欄位 ----
    host.addEventListener('click', (e)=>{
      // 新增列
      if (e.target.classList.contains('ts-btn-add-row')){
        const block = e.target.closest('.ts-block');
        const cols = getActiveCols(block);
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
      // 刪除列（含最後一列 → 可能刪整表，受 locks 控制）
      if (e.target.classList.contains('ts-btn-del-row')){
        const block = e.target.closest('.ts-block');
        const info = state.groups.find(g=>g.id===block.id) || {};
        const tbody = block.querySelector('tbody');
        const rows = Array.from(tbody.querySelectorAll('tr'));
        if (!rows.length) return;

        if (rows.length===1){
          // 最後一列
          if (info.locks && info.locks.deleteGroup===false) return; // 禁刪整表
          rows[0].remove();
          block.remove();
          const idx = state.groups.findIndex(g=>g.id===info.id);
          if (idx>-1) state.groups.splice(idx,1);
          renderAnchors();
          return;
        }
        rows[rows.length-1].remove();
        return;
      }
      // 鎖定/解除鎖定欄位
      if (e.target.classList.contains('ts-btn-lock') || e.target.closest('.ts-btn-lock')){
        const btn   = e.target.classList.contains('ts-btn-lock') ? e.target : e.target.closest('.ts-btn-lock');
        const block = btn.closest('.ts-block');
        const locked = block.dataset.locked==='1';
        const icon = btn.querySelector('i');

        if (!locked){
          // 由「未鎖」→「鎖定」：複製目前的欄為本地欄
          block.dataset.locked = '1';
          block.dataset.localColumns = JSON.stringify(clone(getActiveCols(block)));
          updateHeaders(block);
          applyColgroup(block.querySelector('table.ts-table'), getActiveCols(block));
          // 打開面板
          const panel = block.querySelector('.ts-col-editor');
          panel.style.display = '';
          buildColEditor(block);
          if (icon){ icon.classList.remove('fa-lock-open'); icon.classList.add('fa-lock'); }
          btn.innerHTML = `<i class="${DEFAULT_FA} fa-lock me-1"></i>解除鎖定欄位`;
        }else{
          // 由「鎖定」→「解除」：移除本地欄，改用全域欄
          block.dataset.locked = '0';
          delete block.dataset.localColumns;
          updateHeaders(block);
          applyColgroup(block.querySelector('table.ts-table'), getActiveCols(block));
          // 關閉面板
          const panel = block.querySelector('.ts-col-editor');
          panel.style.display = 'none';
          panel.innerHTML = '';
          if (icon){ icon.classList.remove('fa-lock'); icon.classList.add('fa-lock-open'); }
          btn.innerHTML = `<i class="${DEFAULT_FA} fa-lock-open me-1"></i>鎖定欄位`;
        }
        return;
      }
    });

    // USER 模式鎖住
    function lockAsUser(scope){
      (scope||host).querySelectorAll('.ts-admin').forEach(n=> n.style.display='none');
      (scope||host).querySelectorAll('[contenteditable="true"]').forEach(td=> td.setAttribute('contenteditable','false'));
      host.setAttribute('data-mode','USER');
    }
    if (state.mode==='USER') lockAsUser();

    // ---- 對外 API ----
    function getJSON(){
      const groupsData = state.groups.map(g=>{
        const card = document.getElementById(g.id);
        const rows = [];
        card.querySelectorAll('tbody tr').forEach(tr=>{
          const arr = Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim());
          if (arr.some(v => v !== '')) rows.push(arr);
        });
        const locked = card.dataset.locked==='1';
        const cols = locked ? JSON.parse(card.dataset.localColumns||'[]') : state.columns;
        return { name:g.name, sizeClass:g.sizeClass, lockedColumns:locked, columns: cols, rows, locks: g.locks||{} };
      });
      return { schemaVersion: 4, updatedAt: Date.now(), columns: state.columns, groups: groupsData };
    }

    function setJSON(data={}){
      if (Array.isArray(data.columns) && data.columns.length) {
        state.columns = normalizeColumns(data.columns);
      }
      groupsWrap.innerHTML=''; state.groups=[];
      (data.groups||[]).forEach(g=>{
        addGroup(g.name||'未命名類組',
          { sizeClass:g.sizeClass||'fs-5', locks:g.locks||{} },
          g.rows||[],
          g.lockedColumns ? (g.columns||[]) : null
        );
      });
      renderAnchors();
    }

    function setMode(next){
      const v = String(next||'USER').toUpperCase()==='ADMIN' ? 'ADMIN' : 'USER';
      state.mode = v;
      if (v==='USER') lockAsUser();
      else {
        host.querySelectorAll('td').forEach(td=> td.contentEditable=true);
        host.querySelectorAll('.ts-admin').forEach(n=> n.style.display='');
      }
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
