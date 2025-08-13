/*!
 * TAP Subjects Kit v1.1 (no-common)
 * 可在任意 DIV 召喚的「可自訂欄位的類組表格＋錨點」插件（不含共同科目）
 * 依賴：Font Awesome（建議 solid），Bootstrap CSS（非必須但外觀較佳）
 * 用法：<div data-tap-plugin="subjects" data-mode="ADMIN"></div>
 */
(function (global) {
  'use strict';

  const DEFAULT_MODE   = (global.TAP_SUBJECTS_DEFAULT_MODE || 'ADMIN').toUpperCase();
  const DEFAULT_FA     = global.TAP_SUBJECTS_FA_CLASS || 'fas'; // FA6 可設 'fa-solid'
  const THEME_COLOR    = 'var(--main-red)';

  // 可調整的常用 ICON 候選
  const ICON_SET = [
    '',                 // 無
    'fa-book',          // 文組/學習
    'fa-users',         // 社勞/人群
    'fa-gavel',         // 法政
    'fa-briefcase',     // 行政/管理
    'fa-stethoscope',   // 醫衛
    'fa-flask',         // 理工/生資
    'fa-cog',           // 技術/管理
    'fa-chart-line',    // 財商/趨勢
    'fa-university',    // 機關/制度
    'fa-user-graduate', // 教育/學歷
    'fa-scale-balanced' // 法律（舊版可用 fa-balance-scale）
  ];

  // --- 工具 ---
  let INST = 0;
  const makeId = (p='ts') => `${p}-${++INST}-${Math.random().toString(36).slice(2,8)}`;
  const h = (tag, cls, html) => { const el=document.createElement(tag); if(cls) el.className=cls; if(html!=null) el.innerHTML=html; return el; };
  const t = (s)=> (s==null ? '' : String(s));
  const swap = (arr,i,j)=>{ const tmp=arr[i]; arr[i]=arr[j]; arr[j]=tmp; };
  const $$ = (root, sel)=> Array.from((root instanceof Element?root:document).querySelectorAll(sel));

  // --- Icon Picker 內嵌樣式（只針對選擇器） ---
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

    let current = value || '';
    const open  = ()=>{ menu.classList.remove('d-none'); document.addEventListener('click', onDoc); };
    const close = ()=>{ menu.classList.add('d-none');   document.removeEventListener('click', onDoc); };
    const onDoc = e => { if (!wrap.contains(e.target)) close(); };

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

  // --- 主插件 ---
  function mount(target, opts={}){
    const host = (typeof target==='string') ? document.querySelector(target) : target;
    if (!host) return null;

    const mode    = ((host.dataset.mode || opts.mode || DEFAULT_MODE)+'').toUpperCase()==='ADMIN' ? 'ADMIN' : 'USER';
    const faClass = opts.faClass || DEFAULT_FA;

    const state = {
      id: makeId('ts'),
      mode,
      columns: Array.isArray(opts.columns) && opts.columns.length ? opts.columns.slice()
               : ['高考科目','普考科目','分數比重','名額'],
      groups: [] // {id, name, icon, sizeClass}
    };

    // 骨架
    host.innerHTML = '';
    host.classList.add('tap-subjects');
    host.setAttribute('data-mode', state.mode);

    // 錨點列（只顯示按鈕）
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
          <span class="text-muted small">欄位順序=表頭順序；含「名額」會自動窄＋小字</span>
        </div>
        <div id="${cid}-col-list" class="d-flex flex-column gap-2 mb-3"></div>

        <div class="d-flex flex-wrap align-items-end gap-2">
          <div class="flex-grow-1" style="max-width:320px;">
            <label class="form-label small mb-1">新增類組名稱</label>
            <input type="text" class="form-control form-control-sm" id="${cid}-group-name" placeholder="例如：文組">
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

    // 欄位設定 UI
    const colList  = cfg.querySelector(`#${cid}-col-list`);
    const btnAddCol= cfg.querySelector(`#${cid}-add-col`);
    function renderColList(){
      colList.innerHTML = '';
      state.columns.forEach((col, idx)=>{
        const row = h('div','d-flex align-items-center gap-2 ts-col-item', `
          <input type="text" class="form-control form-control-sm" value="${t(col).replace(/"/g,'&quot;')}">
          <div class="btn-group btn-group-sm">
            <button type="button" class="btn btn-light ts-col-up">▲</button>
            <button type="button" class="btn btn-light ts-col-down">▼</button>
            <button type="button" class="btn btn-outline-danger ts-col-del">刪</button>
          </div>
        `);
        colList.appendChild(row);
        const inp = row.querySelector('input');
        inp.addEventListener('input', ()=>{
          state.columns[idx] = inp.value;
          $$(groupsWrap,'.ts-block').forEach(updateHeaders);
        });
        row.querySelector('.ts-col-up').addEventListener('click', ()=>{
          if (idx===0) return;
          swap(state.columns, idx, idx-1);
          $$(groupsWrap,'.ts-block').forEach(b=>swapColumns(b, idx, idx-1));
          renderColList();
        });
        row.querySelector('.ts-col-down').addEventListener('click', ()=>{
          if (idx>=state.columns.length-1) return;
          swap(state.columns, idx, idx+1);
          $$(groupsWrap,'.ts-block').forEach(b=>swapColumns(b, idx, idx+1));
          renderColList();
        });
        row.querySelector('.ts-col-del').addEventListener('click', ()=>{
          if (state.columns.length<=1) return;
          state.columns.splice(idx,1);
          $$(groupsWrap,'.ts-block').forEach(b=>deleteColumn(b, idx));
          renderColList();
        });
      });
    }
    btnAddCol.addEventListener('click', ()=>{
      state.columns.push('新欄位');
      $$(groupsWrap,'.ts-block').forEach(b=>appendColumn(b,'新欄位'));
      renderColList();
    });
    renderColList();

    // Icon Picker & size
    const sizeSel = cfg.querySelector(`#${cid}-size`);
    const iconPicker = createIconPicker({ faClass:faClass, value:'' });
    cfg.querySelector(`#${cid}-iconpicker`).appendChild(iconPicker.root);

    // 新增類組
    cfg.querySelector(`#${cid}-add-group`).addEventListener('click', ()=>{
      const name = (cfg.querySelector(`#${cid}-group-name`).value || '').trim() || '未命名類組';
      createGroup(name, state.columns.slice(), {
        sizeClass: sizeSel.value || 'fs-5',
        icon: iconPicker.get() || ''
      });
      cfg.querySelector(`#${cid}-group-name`).value = '';
    });

    // 類組建立與操作
    function createGroup(name, columns, { sizeClass='fs-5', icon='' } = {}, rows){
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
            <thead class="table-danger"><tr></tr></thead>
            <tbody></tbody>
          </table>
        </div>`;
      groupsWrap.appendChild(card);

      // 表頭
      const tr = card.querySelector('thead tr');
      tr.innerHTML = '';
      columns.forEach(lbl=>{
        const th = document.createElement('th');
        if (String(lbl).includes('名額')) th.classList.add('ts-col-quota');
        th.innerHTML = String(lbl).includes('名額') ? `<span class="small">${t(lbl)}</span>` : t(lbl);
        tr.appendChild(th);
      });

      // 內容列
      const tbody = card.querySelector('tbody');
      function addRowFromArray(arr){
        const r = document.createElement('tr');
        columns.forEach((lbl,i)=>{
          const td = document.createElement('td');
          td.setAttribute('data-label', t(lbl));
          if (String(lbl).includes('名額')) td.classList.add('ts-quota-cell');
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
        // ADMIN 有一列空白起手；USER 不自動給列
        if (state.mode==='ADMIN') addRowFromArray([]);
      }

      // 記錄
      state.groups.push({ id: card.id, name, icon, sizeClass });
      renderAnchors();

      if (state.mode==='USER') lockAsUser(card);

      return card;
    }

    function updateHeaders(block){
      const tr = block.querySelector('thead tr'); if(!tr) return;
      const cols = state.columns.slice();
      tr.innerHTML='';
      cols.forEach(lbl=>{
        const th=document.createElement('th');
        if (String(lbl).includes('名額')) th.classList.add('ts-col-quota');
        th.innerHTML = String(lbl).includes('名額') ? `<span class="small">${t(lbl)}</span>` : t(lbl);
        tr.appendChild(th);
      });
      const rows = block.querySelectorAll('tbody tr');
      rows.forEach(trEl=>{
        // 調整欄數
        while(trEl.children.length > cols.length) trEl.removeChild(trEl.lastElementChild);
        while(trEl.children.length < cols.length){
          const td=document.createElement('td');
          td.contentEditable = state.mode==='ADMIN';
          td.spellcheck=false;
          trEl.appendChild(td);
        }
        // 更新 data-label + quota 樣式
        cols.forEach((lbl,i)=>{
          const td = trEl.children[i];
          td.setAttribute('data-label', t(lbl));
          td.classList.toggle('ts-quota-cell', String(lbl).includes('名額'));
        });
      });
    }
    function swapColumns(block, i, j){
      const tr = block.querySelector('thead tr'), ths = Array.from(tr.children);
      if (ths[i] && ths[j]) tr.insertBefore(ths[j], ths[i]);
      block.querySelectorAll('tbody tr').forEach(trEl=>{
        const tds = Array.from(trEl.children);
        if (tds[i] && tds[j]) trEl.insertBefore(tds[j], tds[i]);
      });
      // 重算 data-label
      const labels = Array.from(block.querySelectorAll('thead th')).map(th=> (th.textContent||'').trim());
      block.querySelectorAll('tbody tr').forEach(trEl=>{
        Array.from(trEl.children).forEach((td, idx)=> td.setAttribute('data-label', labels[idx]||''));
      });
    }
    function deleteColumn(block, idx){
      const th = block.querySelector(`thead th:nth-child(${idx+1})`); if(th) th.remove();
      block.querySelectorAll('tbody tr').forEach(trEl=>{
        const td = trEl.querySelector(`td:nth-child(${idx+1})`); if(td) td.remove();
      });
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
    }

    // 事件（新增/刪除列）
    host.addEventListener('click', (e)=>{
      if (e.target.classList.contains('ts-btn-add-row')){
        const block = e.target.closest('.ts-block');
        const cols  = Array.from(block.querySelectorAll('thead th')).map(th=> (th.textContent||'').trim());
        const tbody = block.querySelector('tbody');
        const tr = document.createElement('tr');
        cols.forEach(lbl=>{
          const td = document.createElement('td');
          td.setAttribute('data-label', t(lbl));
          if (String(lbl).includes('名額')) td.classList.add('ts-quota-cell');
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
          // 列刪光 → 刪整張表 + 更新錨點
          const id = block.id;
          block.remove();
          const idx = state.groups.findIndex(g=>g.id===id);
          if (idx>-1) state.groups.splice(idx,1);
          renderAnchors();
        }
        return;
      }
    });

    // 錨點
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

    // USER 模式鎖定
    function lockAsUser(scope){
      (scope||host).querySelectorAll('.ts-admin').forEach(n=> n.style.display='none');
      (scope||host).querySelectorAll('[contenteditable="true"]').forEach(td=> td.setAttribute('contenteditable','false'));
    }
    if (state.mode==='USER') lockAsUser();

    // 對外 API
    function getJSON(){
      const groupsData = state.groups.map(g=>{
        const card = document.getElementById(g.id);
        const headers = Array.from(card.querySelectorAll('thead th')).map(th=> (th.textContent||'').trim());
        const rows = [];
        card.querySelectorAll('tbody tr').forEach(tr=>{
          const arr = Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim());
          if (arr.some(v => v !== '')) rows.push(arr);
        });
        return { name:g.name, icon:g.icon, sizeClass:g.sizeClass, headers, rows };
      });
      return { schemaVersion: 2, updatedAt: Date.now(), columns: state.columns.slice(), groups: groupsData };
    }
    function setJSON(data={}){
      if (Array.isArray(data.columns) && data.columns.length) state.columns = data.columns.slice();
      renderColList();
      groupsWrap.innerHTML=''; state.groups=[];
      (data.groups||[]).forEach(g=>{
        createGroup(g.name||'未命名類組', g.headers||state.columns, { sizeClass:g.sizeClass||'fs-5', icon:g.icon||'' }, g.rows||[]);
      });
      renderAnchors();
    }
    function setMode(next='USER'){
      state.mode = String(next).toUpperCase()==='ADMIN' ? 'ADMIN':'USER';
      host.setAttribute('data-mode', state.mode);
      if (state.mode==='USER') lockAsUser();
      else { host.querySelectorAll('td').forEach(td=> td.contentEditable=true); host.querySelectorAll('.ts-admin').forEach(n=> n.style.display=''); }
    }
    function addGroupPublic(name, columns, opts){ return createGroup(name, columns||state.columns, opts||{}); }

    if (opts.data) setJSON(opts.data);

    const api = { getJSON, setJSON, setMode, addGroup: addGroupPublic };
    host._tap_subjects = api;
    return api;
  }

  // 自動掛載
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
