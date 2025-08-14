/*!
 * FreeEligibility.js  v1.0
 * 需求：
 * - 管理模式才能看到各種「新增/編輯」區塊；一般使用者只看結果。
 * - 新增類別區塊（大標題 + 圖示）→ 新增手風琴 → 每個手風琴裡可插入：
 *   (1) 副標題（輸入框）
 *   (2) 項目（黑色圓點 ::marker，輸入框）
 *   (3) 表格（固定兩欄，欄寬%可調，表頭/內容可直接編輯）
 *   (4) 備註（※ + 文字；空白即整段隱藏）
 *
 * 依賴：Bootstrap 5（手風琴）、Font Awesome（大標題 icon）
 * 模式偵測順序： data-mode → opts.mode → window.TAP_DETECT_MODE() → window.XOOPS_IS_ADMIN → window.MODE → 預設 USER
 */

(function (global) {
  'use strict';

  const DEFAULT_FA  = global.TAP_SUBJECTS_FA_CLASS || 'fa-solid';
  const THEME_COLOR = 'var(--main-red)';
  const ICON_SET = ['', 'fa-book','fa-users','fa-gavel','fa-briefcase','fa-stethoscope','fa-flask','fa-cog','fa-chart-line','fa-university','fa-user-graduate','fa-scale-balanced'];

  // ── 最小必要樣式（不動列表樣式） ─────────────────────────
  if (!document.getElementById('fe-inline-style')) {
    const st = document.createElement('style');
    st.id = 'fe-inline-style';
    st.textContent = `
      .fe-wrap[data-mode="USER"] .fe-admin{display:none!important;}
      .fe-note{color:#6c757d;font-size:.875rem;}
      .fe-mini-btn{cursor:pointer;user-select:none}
      .fe-mini-btn:hover{opacity:.85}
      /* icon picker（極簡） */
      .fe-ip-wrap{position:relative;display:inline-block}
      .fe-ip-btn{display:inline-flex;align-items:center;gap:.4rem}
      .fe-ip-menu{position:absolute;z-index:1050;top:100%;left:0;background:#fff;border:1px solid #e9ecef;border-radius:10px;box-shadow:0 6px 18px rgba(0,0,0,.08);padding:10px;margin-top:6px;width:300px;max-height:260px;overflow:auto}
      .fe-ip-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:8px}
      .fe-ip-item{display:flex;justify-content:center;align-items:center;width:44px;height:40px;border:1px solid #eee;border-radius:8px;cursor:pointer;transition:.15s}
      .fe-ip-item:hover{transform:translateY(-1px);border-color:#ddd}
      .fe-ip-item.active{border-color:var(--main-red);box-shadow:0 0 0 2px rgba(234,112,102,.15)}
      .fe-ip-none{font-size:12px;color:#6c757d}
      /* 表格寬度輸入 */
      .fe-colw{width:90px}
    `;
    document.head.appendChild(st);
  }

  // ── 小工具 ────────────────────────────────────────────
  let INST = 0;
  const makeId = (p='fe') => `${p}-${++INST}-${Math.random().toString(36).slice(2,8)}`;
  const t  = (s)=> (s==null ? '' : String(s));
  const h  = (tag, cls, html)=>{ const el=document.createElement(tag); if(cls) el.className=cls; if(html!=null) el.innerHTML=html; return el; };
  const esc= (str)=> String(str||'').replace(/[&<>"']/g, s=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[s]));

  function resolveMode(host, opts, g){
    const explicit = (opts && opts.mode) || (host && host.dataset && host.dataset.mode);
    if (explicit){ const v=String(explicit).toUpperCase(); if(v==='ADMIN'||v==='USER') return v; }
    if (typeof g.TAP_DETECT_MODE==='function'){ const v=String(g.TAP_DETECT_MODE()||'').toUpperCase(); if(v==='ADMIN'||v==='USER') return v; }
    if (g.XOOPS_IS_ADMIN===true) return 'ADMIN';
    if (typeof g.MODE==='string'){ const v=g.MODE.toUpperCase(); if(v==='ADMIN'||v==='USER') return v; }
    return 'USER';
  }

  function normalizeColumns(cols){
    if (!Array.isArray(cols)||cols.length!==2){
      return [{label:'欄位1',width:50},{label:'欄位2',width:50}];
    }
    let a=Number(cols[0].width)||50, b=Number(cols[1].width)||50;
    if (a<5) a=5; if (b<5) b=5;
    const sum=a+b; a=Math.round(100*a/sum); b=100-a;
    return [{label:t(cols[0].label||'欄位1'),width:a},{label:t(cols[1].label||'欄位2'),width:b}];
  }

  function applyColgroup(table, columns){
    const cols=normalizeColumns(columns);
    let cg=table.querySelector('colgroup'); if(!cg){ cg=document.createElement('colgroup'); table.insertBefore(cg, table.firstChild); }
    cg.innerHTML='';
    cols.forEach(c=>{ const col=document.createElement('col'); col.style.width=(c.width||0)+'%'; cg.appendChild(col); });
  }

  // ── Icon Picker ───────────────────────────────────────
  function createIconPicker({ faClass=DEFAULT_FA, value='' } = {}) {
    const wrap = h('div','fe-ip-wrap');
    const btn  = h('button','btn btn-outline-secondary btn-sm fe-ip-btn'); btn.type='button';
    btn.innerHTML = value ? `<i class="${faClass} ${value}" style="color:${THEME_COLOR};"></i><span>更換圖示</span>` : `<span class="fe-ip-none">選擇圖示（可不選）</span>`;
    const menu = h('div','fe-ip-menu d-none'); const grid = h('div','fe-ip-grid');
    ICON_SET.forEach(ic=>{
      const cell = h('div','fe-ip-item'+(ic===value?' active':''), ic?`<i class="${faClass} ${ic}" style="color:${THEME_COLOR};"></i>`:`<span class="fe-ip-none">無</span>`);
      cell.dataset.icon = ic; grid.appendChild(cell);
    });
    menu.appendChild(grid); wrap.appendChild(btn); wrap.appendChild(menu);
    const open=()=>{menu.classList.remove('d-none');document.addEventListener('click',onDoc)}; const close=()=>{menu.classList.add('d-none');document.removeEventListener('click',onDoc)}; const onDoc=e=>{if(!wrap.contains(e.target)) close()};
    let current=value||''; btn.addEventListener('click',e=>{e.stopPropagation(); menu.classList.contains('d-none')?open():close()});
    grid.addEventListener('click',e=>{
      const cell=e.target.closest('.fe-ip-item'); if(!cell) return;
      current=cell.dataset.icon||''; grid.querySelectorAll('.fe-ip-item').forEach(i=>i.classList.toggle('active',i===cell));
      btn.innerHTML = current?`<i class="${faClass} ${current}" style="color:${THEME_COLOR};"></i><span>更換圖示</span>`:`<span class="fe-ip-none">選擇圖示（可不選）</span>`; close();
      wrap.dispatchEvent(new CustomEvent('icon:change',{detail:{icon:current}}));
    });
    return { root:wrap, get:()=>current, set:(v='')=>{ current=v||''; grid.querySelectorAll('.fe-ip-item').forEach(i=>i.classList.toggle('active',i.dataset.icon===current)); btn.innerHTML=current?`<i class="${faClass} ${current}" style="color:${THEME_COLOR};"></i><span>更換圖示</span>`:`<span class="fe-ip-none">選擇圖示（可不選）</span>`; } };
  }

  // ── 主程式 ───────────────────────────────────────────
  function mount(target, opts={}){
    const host=(typeof target==='string')?document.querySelector(target):target; if(!host) return null;
    if (host._free_elig) return host._free_elig;

    const mode   = resolveMode(host, opts, global);
    const faClass= host.dataset.fa || opts.faClass || DEFAULT_FA;

    const state = {
      id: makeId('elig'),
      mode,
      title: '',
      icon : '',
      groups: [] // [{id, title, blocks:[...], table:{columns,rows,head}, note}]
    };

    // 容器
    host.classList.add('fe-wrap');
    host.setAttribute('data-mode', mode);
    host.innerHTML='';

    // 1) 新增類別區塊（大標題 + ICON）
    let cfgCategory=null;
    if (mode==='ADMIN'){
      cfgCategory=h('div','card mb-3 fe-admin','');
      const cid=state.id+'-cat';
      cfgCategory.innerHTML=`
        <div class="card-header bg-white border-bottom border-danger fw-bold">新增類別區塊</div>
        <div class="card-body">
          <div class="row g-2 align-items-end">
            <div class="col-md-6">
              <label class="form-label small mb-1">標題</label>
              <input type="text" class="form-control form-control-sm" id="${cid}-title" placeholder="例如：報考資格 & 類科條件">
            </div>
            <div class="col-md-3">
              <label class="form-label small mb-1">圖示（可不選）</label>
              <div id="${cid}-iconpicker"></div>
            </div>
            <div class="col-md-3">
              <button class="btn btn-danger btn-sm" id="${cid}-apply">插入</button>
            </div>
          </div>
        </div>`;
      host.appendChild(cfgCategory);

      const ip = createIconPicker({ faClass });
      cfgCategory.querySelector(`#${cid}-iconpicker`).appendChild(ip.root);
      cfgCategory.querySelector(`#${cid}-apply`).addEventListener('click', ()=>{
        state.title = cfgCategory.querySelector(`#${cid}-title`).value.trim();
        state.icon  = ip.get() || '';
        renderHeader();
        areaAfterCategory.style.display='';
      });
    }

    // 2) 類別標題顯示區（使用者也看得到）
    const header = h('div','d-flex align-items-center gap-2 mb-2','');
    host.appendChild(header);
    function renderHeader(){
      if (!state.title && !state.icon){ header.style.display='none'; header.innerHTML=''; return; }
      header.style.display='';
      header.innerHTML = `
        ${state.icon?`<i class="${faClass} ${state.icon}" style="color:${THEME_COLOR};"></i>`:''}
        <div class="fw-bold fs-5">${esc(state.title||'')}</div>`;
    }

    // 3) 新增手風琴區塊（只有 Admin 看得到）
    const areaAfterCategory=h('div','fe-admin',''); areaAfterCategory.style.display=(mode==='ADMIN'?'':'none');
    const accCtl=h('div','card mb-3',''); const aid=state.id+'-acc';
    accCtl.innerHTML=`
      <div class="card-header bg-white border-bottom border-danger fw-bold">新增手風琴區塊</div>
      <div class="card-body">
        <div class="row g-2 align-items-end">
          <div class="col-md-8">
            <label class="form-label small mb-1">手風琴標題</label>
            <input type="text" class="form-control form-control-sm" id="${aid}-title" placeholder="例如：高等考試三級">
          </div>
          <div class="col-md-4">
            <button class="btn btn-danger btn-sm" id="${aid}-add">增加手風琴</button>
          </div>
        </div>
      </div>`;
    areaAfterCategory.appendChild(accCtl);
    host.appendChild(areaAfterCategory);

    // 4) 手風琴容器
    const accWrap=h('div','accordion',''); accWrap.id=state.id+'-accordion';
    host.appendChild(accWrap);

    // 5) 事件：增加手風琴
    if (mode==='ADMIN'){
      accCtl.querySelector(`#${aid}-add`).addEventListener('click', ()=>{
        const title=(accCtl.querySelector(`#${aid}-title`).value||'').trim() || '未命名';
        createAccordion(title);
        accCtl.querySelector(`#${aid}-title`).value='';
      });
    }

    // ── 建立手風琴項目 ──────────────────────────────────
    function createAccordion(title){
      const gid=makeId('g'), hId=gid+'-h', cId=gid+'-c';
      const item=h('div','accordion-item mb-2','');
      item.innerHTML=`
        <h2 class="accordion-header" id="${hId}">
          <button class="accordion-button bg-danger text-white fw-bold rounded collapsed px-3 py-2" type="button" data-bs-toggle="collapse" data-bs-target="#${cId}" aria-expanded="false" aria-controls="${cId}">
            <span class="fe-acc-title">${esc(title)}</span>
          </button>
        </h2>
        <div id="${cId}" class="accordion-collapse collapse" aria-labelledby="${hId}" data-bs-parent="#${accWrap.id}">
          <div class="accordion-body bg-light pt-3 pb-3 px-3">
            <!-- 新增手風琴內容區塊（Admin 專用） -->
            <div class="fe-admin d-flex flex-wrap gap-2 mb-2">
              <button type="button" class="btn btn-outline-danger btn-sm fe-btn-title">插入標題</button>
              <button type="button" class="btn btn-outline-danger btn-sm fe-btn-item">插入項目</button>
              <button type="button" class="btn btn-outline-danger btn-sm fe-btn-table">插入表格</button>
            </div>
            <div class="fe-flow"></div>
            <div class="mt-2">
              <div class="fe-admin">
                <label class="form-label small mb-1">※ 備註（不填則不顯示）</label>
                <input type="text" class="form-control form-control-sm fe-note-input" placeholder="請輸入備註 如無填入則不顯示備註">
              </div>
              <div class="fe-note d-none"></div>
            </div>
          </div>
        </div>`;
      accWrap.appendChild(item);

      const flow = item.querySelector('.fe-flow');
      const noteInp = item.querySelector('.fe-note-input');
      const noteOut = item.querySelector('.fe-note');

      // 備註顯示控制
      const syncNote = ()=> {
        const v=(noteInp.value||'').trim();
        if(!v){ noteOut.classList.add('d-none'); noteOut.textContent=''; }
        else { noteOut.classList.remove('d-none'); noteOut.textContent='※ ' + v; }
      };
      if (mode==='ADMIN') noteInp.addEventListener('input', syncNote);

      // Admin 操作：插入副標題 / 項目 / 表格
      if (mode==='ADMIN'){
        item.querySelector('.fe-btn-title').addEventListener('click', ()=> addSubtitle(flow));
        item.querySelector('.fe-btn-item').addEventListener('click', ()=> addListItem(flow));
        item.querySelector('.fe-btn-table').addEventListener('click', ()=> ensureTable(flow));
      }

      // 初次展開
      if (typeof bootstrap!=='undefined'){
        new bootstrap.Collapse(item.querySelector('.accordion-collapse'), { toggle: true });
      }

      // group 狀態
      state.groups.push({ id: gid, title, blocks: [], table:null, note:'' });
      return item;
    }

    // ── Blocks：副標題 / 項目清單 / 表格 ──────────────────
    function addSubtitle(flow, text=''){
      // 顯示成紅色粗體（對齊你的版），下方是輸入框
      const box=h('div','mb-2','');
      const title=h('div','fw-bold text-danger', esc(text||''));
      const ctrls=h('div','fe-admin mt-1 d-flex align-items-center gap-2','');
      const inp=h('input','form-control form-control-sm', ''); inp.type='text'; inp.placeholder='請輸入副標';
      if (text) inp.value=text;
      const del=h('button','btn btn-outline-secondary btn-sm','刪除');
      ctrls.appendChild(inp); ctrls.appendChild(del);
      box.appendChild(title); box.appendChild(ctrls);
      flow.appendChild(box);
      inp.addEventListener('input',()=>{ title.textContent=inp.value; });
      del.addEventListener('click',()=> box.remove());
      return box;
    }

    function ensureList(flow){
      // 取最後一個 UL；沒有就新建
      const nodes=[...flow.children].reverse();
      let ul=nodes.find(n=>n.tagName==='UL' && n.classList.contains('fe-list'));
      if (!ul){ ul=h('ul','fe-list',''); flow.appendChild(ul); }
      return ul;
    }

    function addListItem(flow, text=''){
      const ul=ensureList(flow);
      const li=h('li','d-flex align-items-start gap-2','');
      const view=h('span','', esc(text||''));   // 真正顯示的內容（保留 ::marker）
      const admin=h('div','fe-admin d-flex align-items-center gap-2','');
      const inp=h('input','form-control form-control-sm',''); inp.type='text'; inp.placeholder='請輸入項目'; if(text) inp.value=text;
      const del=h('button','btn btn-outline-secondary btn-sm','刪除');
      admin.appendChild(inp); admin.appendChild(del);
      li.appendChild(view); li.appendChild(admin); ul.appendChild(li);
      inp.addEventListener('input', ()=>{ view.textContent=inp.value; });
      del.addEventListener('click', ()=> li.remove());
      return li;
    }

    function ensureTable(flow){
      // 每個手風琴僅 1 張表；固定 2 欄，可調寬/加刪列
      let wrap=flow.querySelector('.fe-table-wrap');
      if (wrap) return wrap;
      wrap=h('div','fe-table-wrap card mb-2','');
      wrap.innerHTML=`
        <div class="card-header bg-white border-bottom border-danger fw-bold d-flex align-items-center justify-content-between">
          <span class="fe-tbl-title">表格</span>
          <div class="fe-admin d-flex align-items-center gap-2">
            <div class="input-group input-group-sm fe-colw">
              <span class="input-group-text">欄1</span>
              <input type="number" class="form-control fe-w1" min="5" max="95" step="5" value="50">
              <span class="input-group-text">%</span>
            </div>
            <div class="input-group input-group-sm fe-colw">
              <span class="input-group-text">欄2</span>
              <input type="number" class="form-control fe-w2" min="5" max="95" step="5" value="50">
              <span class="input-group-text">%</span>
            </div>
            <button type="button" class="btn btn-danger btn-sm fe-add-row">新增列</button>
            <button type="button" class="btn btn-danger btn-sm fe-del-row">刪除列</button>
          </div>
        </div>
        <div class="card-body p-0">
          <table class="table table-bordered mb-0 align-middle fe-table">
            <colgroup></colgroup>
            <thead><tr>
              <th contenteditable="true" spellcheck="false">類科</th>
              <th contenteditable="true" spellcheck="false">特殊限制</th>
            </tr></thead>
            <tbody></tbody>
          </table>
        </div>`;
      flow.appendChild(wrap);

      const tbl=wrap.querySelector('.fe-table');
      const w1=wrap.querySelector('.fe-w1'), w2=wrap.querySelector('.fe-w2');
      const syncWidth=()=>{
        let a=Number(w1.value)||50, b=Number(w2.value)||50;
        if (a<5) a=5; if (b<5) b=5; const sum=a+b; a=Math.round(100*a/sum); b=100-a;
        w1.value=a; w2.value=b;
        applyColgroup(tbl, [{label:'',width:a},{label:'',width:b}]);
      };
      w1.addEventListener('input', syncWidth);
      w2.addEventListener('input', syncWidth);
      syncWidth();

      wrap.querySelector('.fe-add-row').addEventListener('click', ()=>{
        const tr=document.createElement('tr');
        tr.innerHTML=`<td contenteditable="true" spellcheck="false"></td><td contenteditable="true" spellcheck="false"></td>`;
        tbl.querySelector('tbody').appendChild(tr);
      });
      wrap.querySelector('.fe-del-row').addEventListener('click', ()=>{
        const rows=tbl.querySelectorAll('tbody tr'); if(rows.length) rows[rows.length-1].remove();
      });

      if (state.mode==='USER'){
        // 鎖定編輯
        wrap.querySelectorAll('[contenteditable="true"]').forEach(n=> n.setAttribute('contenteditable','false'));
        wrap.querySelectorAll('.fe-admin').forEach(n=> n.style.display='none');
      }
      return wrap;
    }

    // 初始標題（若外部有傳）
    if (opts.title || opts.icon){
      state.title=opts.title||''; state.icon=opts.icon||''; renderHeader();
      if (areaAfterCategory) areaAfterCategory.style.display='';
    }

    // API（若之後要存取）
    const api={
      setMode(next){
        const v=String(next||'USER').toUpperCase()==='ADMIN'?'ADMIN':'USER';
        state.mode=v; host.setAttribute('data-mode',v);
        if (v==='USER'){
          host.querySelectorAll('.fe-admin').forEach(n=> n.style.display='none');
          host.querySelectorAll('[contenteditable="true"]').forEach(n=> n.setAttribute('contenteditable','false'));
        }else{
          host.querySelectorAll('.fe-admin').forEach(n=> n.style.display='');
        }
      }
    };

    host._free_elig = api;
    return api;
  }

  // 自動掛載
  function autoload(){
    document.querySelectorAll('[data-tap-plugin="eligibility"]').forEach(node=>{
      if (node._free_elig) return;
      mount(node, { mode: node.dataset.mode });
    });
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',autoload);
  else autoload();

  // 對外
  global.TAPEligibilityKit = { mount };

})(window);
