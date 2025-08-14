/*!
 * TAPAccordionKit v1.1  (Eligibility / Q&A + table + notes)
 * 需求重點：
 * - 不改頁面既有 CSS（列表維持黑點）
 * - 多手風琴
 * - 表格置底可調欄寬/加欄/加刪列
 * - 備註純文字、無連結
 * - Q&A：只允許插入一個「A：」回答區塊，手風琴按鈕外觀不變
 */

(function (global) {
  'use strict';

  const DEFAULT_FA  = global.TAP_SUBJECTS_FA_CLASS || 'fa-solid';
  const THEME_COLOR = 'var(--main-red)';
  const ICON_SET = ['', 'fa-book','fa-users','fa-gavel','fa-briefcase','fa-stethoscope','fa-flask','fa-cog','fa-chart-line','fa-university','fa-user-graduate','fa-scale-balanced'];

  // 只放極少數必要樣式，不碰列表樣式
  if (!document.getElementById('tap-acc-inline-style')) {
    const st = document.createElement('style');
    st.id = 'tap-acc-inline-style';
    st.textContent = `
      .tap-eligibility[data-mode="USER"] .acc-admin{display:none!important;}
      .ta-del{cursor:pointer;user-select:none}
      .ta-del:hover{opacity:.85}
      .ta-answer .ta-a-prefix{font-weight:700;margin-right:.4rem;color:#000;}
      .ta-answer .ta-a-text{color:#000;}
      /* 極簡 icon picker */
      .ts-ip-wrap{position:relative;display:inline-block}
      .ts-ip-btn{display:inline-flex;align-items:center;gap:.4rem}
      .ts-ip-menu{position:absolute;z-index:1050;top:100%;left:0;background:#fff;border:1px solid #e9ecef;border-radius:10px;box-shadow:0 6px 18px rgba(0,0,0,.08);padding:10px;margin-top:6px;width:300px;max-height:260px;overflow:auto}
      .ts-ip-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:8px}
      .ts-ip-item{display:flex;justify-content:center;align-items:center;width:44px;height:40px;border:1px solid #eee;border-radius:8px;cursor:pointer;transition:.15s}
      .ts-ip-item:hover{transform:translateY(-1px);border-color:#ddd}
      .ts-ip-item.active{border-color:var(--main-red);box-shadow:0 0 0 2px rgba(234,112,102,.15)}
      .ts-ip-none{font-size:12px;color:#6c757d}
    `;
    document.head.appendChild(st);
  }

  let INST = 0;
  const makeId = (p='ta') => `${p}-${++INST}-${Math.random().toString(36).slice(2,8)}`;
  const t  = (s)=> (s==null ? '' : String(s));
  const h  = (tag, cls, html)=>{ const el=document.createElement(tag); if(cls) el.className=cls; if(html!=null) el.innerHTML=html; return el; };

  function escapeHtml(str){ return String(str||'').replace(/[&<>"']/g, s=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[s])); }

  function resolveMode(host, opts, global){
    const explicit = (opts && opts.mode) || (host && host.dataset && host.dataset.mode);
    if (explicit){ const v=String(explicit).toUpperCase(); if(v==='ADMIN'||v==='USER') return v; }
    if (typeof global.TAP_DETECT_MODE==='function'){ const v=String(global.TAP_DETECT_MODE()||'').toUpperCase(); if(v==='ADMIN'||v==='USER') return v; }
    if (global.XOOPS_IS_ADMIN===true) return 'ADMIN';
    if (typeof global.MODE==='string'){ const v=global.MODE.toUpperCase(); if(v==='ADMIN'||v==='USER') return v; }
    return 'USER';
  }

  function createIconPicker({ faClass=DEFAULT_FA, value='' } = {}) {
    const wrap = h('div','ts-ip-wrap');
    const btn  = h('button','btn btn-outline-secondary btn-sm ts-ip-btn'); btn.type='button';
    btn.innerHTML = value ? `<i class="${faClass} ${value}" style="color:${THEME_COLOR};"></i><span>更換圖示</span>` : `<span class="ts-ip-none">選擇圖示（可不選）</span>`;
    const menu = h('div','ts-ip-menu d-none'); const grid = h('div','ts-ip-grid');
    ICON_SET.forEach(ic=>{
      const cell = h('div','ts-ip-item'+(ic===value?' active':''), ic?`<i class="${faClass} ${ic}" style="color:${THEME_COLOR};"></i>`:`<span class="ts-ip-none">無</span>`);
      cell.dataset.icon = ic; grid.appendChild(cell);
    });
    menu.appendChild(grid); wrap.appendChild(btn); wrap.appendChild(menu);
    const open=()=>{menu.classList.remove('d-none');document.addEventListener('click',onDoc)}; const close=()=>{menu.classList.add('d-none');document.removeEventListener('click',onDoc)}; const onDoc=e=>{if(!wrap.contains(e.target)) close()};
    let current=value||''; btn.addEventListener('click',e=>{e.stopPropagation(); menu.classList.contains('d-none')?open():close()});
    grid.addEventListener('click',e=>{
      const cell=e.target.closest('.ts-ip-item'); if(!cell) return;
      current=cell.dataset.icon||''; grid.querySelectorAll('.ts-ip-item').forEach(i=>i.classList.toggle('active',i===cell));
      btn.innerHTML = current?`<i class="${faClass} ${current}" style="color:${THEME_COLOR};"></i><span>更換圖示</span>`:`<span class="ts-ip-none">選擇圖示（可不選）</span>`; close();
      wrap.dispatchEvent(new CustomEvent('icon:change',{detail:{icon:current}}));
    });
    return { root:wrap, get:()=>current, set:(v='')=>{ current=v||''; grid.querySelectorAll('.ts-ip-item').forEach(i=>i.classList.toggle('active',i.dataset.icon===current)); btn.innerHTML=current?`<i class="${faClass} ${current}" style="color:${THEME_COLOR};"></i><span>更換圖示</span>`:`<span class="ts-ip-none">選擇圖示（可不選）</span>`; } };
  }

  function normalizeColumns(cols){
    if (!Array.isArray(cols)||!cols.length) return [];
    let out = cols.map(c => (typeof c==='string')?{label:c,width:0}:{label:String(c.label||''),width:Number(c.width)||0});
    if (!out.some(c=>c.width>0)){
      const per=Math.round(100/out.length);
      out=out.map((c,i)=>({label:c.label,width:i===out.length-1?(100-per*(out.length-1)):per}));
    }else{
      const sum=out.reduce((a,b)=>a+(b.width||0),0)||100;
      out=out.map(c=>({label:c.label,width:Math.max(5,Math.round(100*(c.width||0)/sum))}));
      let diff=100-out.reduce((a,b)=>a+b.width,0); if(diff!==0) out[out.length-1].width+=diff;
    }
    return out;
  }
  function applyColgroup(table, columns){
    const cols=normalizeColumns(columns||[]); let cg=table.querySelector('colgroup'); if(!cg){ cg=document.createElement('colgroup'); table.insertBefore(cg,table.firstChild); }
    cg.innerHTML=''; cols.forEach(c=>{ const col=document.createElement('col'); col.style.width=(c.width||0)+'%'; cg.appendChild(col); });
  }

  function mount(target, opts={}){
    const host=(typeof target==='string')?document.querySelector(target):target; if(!host) return null;
    if (host._tap_acc) return host._tap_acc;

    const mode   = resolveMode(host, opts, global);
    const faClass= host.dataset.fa || opts.faClass || DEFAULT_FA;

    const state = {
      id: makeId('acc'),
      mode,
      title: opts.title || '',
      titleIcon: opts.icon || '',
      groups: [],   // {id,title}
      table: null,  // {title,columns,rows}
      note: ''
    };

    host.classList.add('tap-eligibility');
    host.setAttribute('data-mode', mode);
    host.innerHTML='';

    // 頂部標題
    const header=h('div','d-flex align-items-center gap-2 mb-2'); const iconSpan=h('span',''); const titleSpan=h('div','fw-bold fs-5',''); header.appendChild(iconSpan); header.appendChild(titleSpan); host.appendChild(header);
    function renderTopTitle(){ iconSpan.innerHTML=state.titleIcon?`<i class="${faClass} ${state.titleIcon}" style="color:${THEME_COLOR};"></i>`:''; titleSpan.textContent=t(state.title||''); header.style.display=(state.title||state.titleIcon)?'':'none'; }

    // 管理設定卡
    let cfg=null;
    if (mode==='ADMIN'){
      cfg=h('div','card mb-3 acc-admin'); const cid=state.id;
      cfg.innerHTML=`
        <div class="card-header bg-white border-bottom border-danger fw-bold">報名資格／類科條件（管理）</div>
        <div class="card-body">
          <div class="row g-2 align-items-end">
            <div class="col-md-5">
              <label class="form-label small mb-1">大標題</label>
              <input type="text" class="form-control form-control-sm" id="${cid}-bigtitle" placeholder="例如：報考資格 & 類科條件 / Q&A">
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
              <span class="text-muted small ms-2">固定在最底、備註上方；預設 2 欄，可調寬/加欄。</span>
            </div>
          </div>

          <hr class="my-3">

          <div>
            <label class="form-label small mb-1">備註（空白則不顯示；不處理連結）</label>
            <textarea class="form-control form-control-sm" id="${cid}-note" rows="2" placeholder="※ 例如：詳細內容請參考考試簡章"></textarea>
          </div>
        </div>`;
      host.appendChild(cfg);

      const bigTitle=cfg.querySelector(`#${state.id}-bigtitle`);
      const noteInp =cfg.querySelector(`#${state.id}-note`);
      const tblTitle=cfg.querySelector(`#${state.id}-tblTitle`);
      const newAcc  =cfg.querySelector(`#${state.id}-newAccTitle`);
      const addAccBtn=cfg.querySelector(`#${state.id}-addAcc`);

      const iconPicker=createIconPicker({faClass,value:''});
      cfg.querySelector(`#${state.id}-iconpicker`).appendChild(iconPicker.root);

      bigTitle.addEventListener('input',()=>{ state.title=bigTitle.value; renderTopTitle(); });
      iconPicker.root.addEventListener('icon:change',e=>{ state.titleIcon=e.detail.icon||''; renderTopTitle(); });

      addAccBtn.addEventListener('click',()=>{
        const title=(newAcc.value||'').trim()||'未命名';
        createAccordionItem(title);
        // 自動展開
        const last=accWrap.lastElementChild;
        if (last && typeof bootstrap!=='undefined'){
          const c=last.querySelector('.accordion-collapse');
          new bootstrap.Collapse(c,{toggle:true});
        }
        newAcc.value='';
      });

      cfg.querySelector(`#${state.id}-insertTbl`).addEventListener('click',()=> ensureTable({ title: tblTitle.value||'' }));
      cfg.querySelector(`#${state.id}-removeTbl`).addEventListener('click',()=> removeTable());
      noteInp.addEventListener('input',()=>{ state.note=noteInp.value||''; renderNote(); });
    }

    const accWrap=h('div','accordion mb-3'); accWrap.id=state.id+'-accordion'; host.appendChild(accWrap);

    const tableMount=h('div',''); host.appendChild(tableMount);

    const noteBox=h('div','small text-muted',''); host.appendChild(noteBox);
    function renderNote(){ const text=t(state.note||'').trim(); if(!text){ noteBox.style.display='none'; noteBox.innerHTML=''; return; } noteBox.style.display=''; noteBox.innerHTML=`※ ${escapeHtml(text)}`; }

    // 建立一個手風琴 block
    function createAccordionItem(title, presetBlocks){
      const gid=makeId('g');
      const hId=gid+'-h', cId=gid+'-c';
      const item=h('div','accordion-item mb-2','');
      item.innerHTML=`
        <h2 class="accordion-header" id="${hId}">
          <button class="accordion-button bg-danger text-white fw-bold rounded collapsed px-3 py-2" type="button" data-bs-toggle="collapse" data-bs-target="#${cId}" aria-expanded="false" aria-controls="${cId}">
            <span class="acc-title-text">${escapeHtml(title)}</span>
          </button>
        </h2>
        <div id="${cId}" class="accordion-collapse collapse" aria-labelledby="${hId}" data-bs-parent="#${accWrap.id}">
          <div class="accordion-body bg-light pt-3 pb-3 px-3">
            <div class="d-flex flex-wrap gap-2 mb-2 acc-admin">
              <button type="button" class="btn btn-outline-danger btn-sm ta-insert-title">插入標題</button>
              <button type="button" class="btn btn-outline-danger btn-sm ta-insert-item">插入項目</button>
              <button type="button" class="btn btn-outline-secondary btn-sm ta-insert-answer">插入 A（Q&A）</button>
            </div>
            <div class="ta-flow"></div>
          </div>
        </div>`;
      accWrap.appendChild(item);

      state.groups.push({ id: gid, title });
      item._meta = { id: gid, title, hasAnswer:false };

      const flow=item.querySelector('.ta-flow');

      if (Array.isArray(presetBlocks)){
        presetBlocks.forEach(b=>{
          if (b.type==='title') appendSubtitle(flow,b.text||'');
          if (b.type==='list')  appendList(flow, Array.isArray(b.items)?b.items:[]);
          if (b.type==='answer') appendAnswer(flow, b.text||'');
        });
      }

      // admin actions
      item.querySelector('.ta-insert-title').addEventListener('click',()=> appendSubtitle(flow,''));
      item.querySelector('.ta-insert-item').addEventListener('click',()=> appendListItem(flow,''));
      const btnAns=item.querySelector('.ta-insert-answer');
      btnAns.addEventListener('click',()=>{
        if (flow.querySelector('.ta-answer')) return; // 僅一個
        appendAnswer(flow,'');
      });

      if (state.mode==='USER'){ item.querySelectorAll('.acc-admin').forEach(n=> n.style.display='none'); }

      return item;
    }

    // blocks
    function appendSubtitle(flow,text){
      const wrap=h('div','ta-subtitle d-flex align-items-center gap-2','');
      const span=h('div','', escapeHtml(text||'副標題'));
      span.contentEditable=(state.mode==='ADMIN'); span.spellcheck=false;
      const del=h('span','text-danger ta-del','刪'); del.addEventListener('click',()=> wrap.remove());
      wrap.appendChild(span); if(state.mode==='ADMIN') wrap.appendChild(del);
      flow.appendChild(wrap); return wrap;
    }
    function ensureLastList(flow){
      const rev=[...flow.children].reverse(); let ul=rev.find(x=>x.tagName==='UL'&&x.classList.contains('ta-list'));
      if(!ul){ ul=h('ul','ta-list',''); flow.appendChild(ul); }
      return ul;
    }
    function appendList(flow, items){
      const ul=h('ul','ta-list','');
      (items||[]).forEach(txt=>{
        const li=h('li','d-flex align-items-start gap-2','');
        const span=h('div','', escapeHtml(txt||'')); span.contentEditable=(state.mode==='ADMIN'); span.spellcheck=false;
        const del=h('span','text-danger ta-del small','刪'); del.addEventListener('click',()=> li.remove());
        li.appendChild(span); if(state.mode==='ADMIN') li.appendChild(del);
        ul.appendChild(li);
      });
      flow.appendChild(ul); return ul;
    }
    function appendListItem(flow,text){
      const ul=ensureLastList(flow);
      const li=h('li','d-flex align-items-start gap-2','');
      const span=h('div','', escapeHtml(text||'')); span.contentEditable=(state.mode==='ADMIN'); span.spellcheck=false;
      const del=h('span','text-danger ta-del small','刪'); del.addEventListener('click',()=> li.remove());
      li.appendChild(span); if(state.mode==='ADMIN') li.appendChild(del);
      ul.appendChild(li); return li;
    }
    function appendAnswer(flow,text){
      if (flow.querySelector('.ta-answer')) return null; // 僅一個
      const wrap=h('div','ta-answer d-flex align-items-start gap-1','');
      const pre =h('span','ta-a-prefix','A：');
      const cnt =h('div','ta-a-text', escapeHtml(text||'')); cnt.contentEditable=(state.mode==='ADMIN'); cnt.spellcheck=false;
      const del =h('span','text-danger ta-del small','刪'); del.addEventListener('click',()=> wrap.remove());
      wrap.appendChild(pre); wrap.appendChild(cnt); if(state.mode==='ADMIN') wrap.appendChild(del);
      flow.appendChild(wrap); return wrap;
    }

    // 表格
    function ensureTable({ title='' } = {}){
      if (!state.table){
        state.table={ title:title||'', columns:normalizeColumns([{label:'欄位1',width:50},{label:'欄位2',width:50}]), rows:[] };
      }else{ state.table.title=title; }
      renderTable();
    }
    function removeTable(){ state.table=null; tableMount.innerHTML=''; }
    function renderTable(){
      tableMount.innerHTML=''; if(!state.table) return;
      const card=h('div','card mb-3','');
      const head=h('div','card-header bg-white border-bottom border-danger fw-bold d-flex align-items-center justify-content-between','');
      head.innerHTML=`<span class="tbl-title">${escapeHtml(state.table.title||'')}</span>
      <div class="acc-admin d-flex align-items-center gap-2">
        <button class="btn btn-sm btn-danger ta-tbl-add-row">新增列</button>
        <button class="btn btn-sm btn-danger ta-tbl-del-row">刪除列</button>
      </div>`;
      const body=h('div','card-body p-0','');
      const tbl=h('table','table table-bordered mb-0 align-middle ta-table','<thead><tr></tr></thead><tbody></tbody>');
      const trh=tbl.querySelector('thead tr'); trh.innerHTML='';
      state.table.columns.forEach(c=>{ const th=document.createElement('th'); th.textContent=t(c.label||''); th.contentEditable=(state.mode==='ADMIN'); th.spellcheck=false; trh.appendChild(th); });
      const tb=tbl.querySelector('tbody'); tb.innerHTML='';
      state.table.rows.forEach(arr=>{
        const tr=document.createElement('tr');
        state.table.columns.forEach((c,i)=>{ const td=document.createElement('td'); td.textContent=t(arr?.[i]||''); td.contentEditable=(state.mode==='ADMIN'); td.spellcheck=false; tr.appendChild(td); });
        tb.appendChild(tr);
      });
      applyColgroup(tbl, state.table.columns);
      body.appendChild(tbl); card.appendChild(head); card.appendChild(body);

      const editor=h('div','acc-admin p-2 border-top',''); const wrap=h('div','d-flex flex-wrap align-items-center gap-2','');
      state.table.columns.forEach((c,idx)=>{
        const box=h('div','input-group input-group-sm',''); box.style.width='150px';
        box.innerHTML=`<span class="input-group-text">${escapeHtml(c.label)}</span>
        <input type="number" class="form-control ta-colw" data-idx="${idx}" min="5" max="100" step="5" value="${c.width}">
        <span class="input-group-text">%</span>`;
        wrap.appendChild(box);
      });
      const addColBtn=h('button','btn btn-outline-danger btn-sm','新增欄位'); wrap.appendChild(addColBtn);
      editor.appendChild(wrap); card.appendChild(editor);

      head.querySelector('.ta-tbl-add-row').addEventListener('click',()=>{ const arr=new Array(state.table.columns.length).fill(''); state.table.rows.push(arr); renderTable(); });
      head.querySelector('.ta-tbl-del-row').addEventListener('click',()=>{ state.table.rows.pop(); renderTable(); });

      wrap.querySelectorAll('.ta-colw').forEach(inp=>{
        inp.addEventListener('input',()=>{
          const i=Number(inp.dataset.idx)||0; state.table.columns[i].width=Number(inp.value)||0;
          state.table.columns=normalizeColumns(state.table.columns); renderTable();
        });
      });
      addColBtn.addEventListener('click',()=>{
        state.table.columns.push({label:`欄位${state.table.columns.length+1}`,width:0});
        state.table.rows=state.table.rows.map(r=>(r||[]).concat(['']));
        state.table.columns=normalizeColumns(state.table.columns); renderTable();
      });

      if (state.mode==='ADMIN'){
        tbl.addEventListener('input',()=>{
          const labels=[...tbl.querySelectorAll('thead th')].map(th=>th.textContent.trim());
          state.table.columns=normalizeColumns(labels.map((lab,i)=>({label:lab,width:state.table.columns[i]?.width||0})));
          state.table.rows=[...tbl.querySelectorAll('tbody tr')].map(tr=>[...tr.children].map(td=>td.textContent.trim()));
        });
      }
      tableMount.appendChild(card);
    }

    // API
    function getJSON(){
      const groupsData=state.groups.map(g=>{
        const item=[...accWrap.children].find(x=>x._meta && x._meta.id===g.id);
        const flow=item?item.querySelector('.ta-flow'):null; const blocks=[];
        if (flow){
          [...flow.children].forEach(node=>{
            if (node.classList.contains('ta-subtitle')) blocks.push({type:'title',text: node.querySelector('div')?.textContent.trim()||''});
            else if (node.tagName==='UL') blocks.push({type:'list',items:[...node.querySelectorAll('li div')].map(d=>d.textContent.trim())});
            else if (node.classList.contains('ta-answer')) blocks.push({type:'answer',text: node.querySelector('.ta-a-text')?.textContent.trim()||''});
          });
        }
        return { title:g.title, blocks };
      });
      return { schemaVersion:2, updatedAt:Date.now(), title:state.title, titleIcon:state.titleIcon, groups:groupsData, table:state.table, note:state.note };
    }
    function setJSON(data={}){
      state.title=data.title||''; state.titleIcon=data.titleIcon||''; renderTopTitle();
      accWrap.innerHTML=''; state.groups=[];
      (data.groups||[]).forEach(g=> createAccordionItem(g.title||'未命名', g.blocks||[]));
      state.table = data.table ? { title:t(data.table.title||''), columns:normalizeColumns(data.table.columns||[]), rows:Array.isArray(data.table.rows)?data.table.rows:[] } : null;
      renderTable();
      state.note=data.note||''; renderNote();
      if (cfg){ cfg.querySelector(`#${state.id}-bigtitle`).value=state.title||''; cfg.querySelector(`#${state.id}-tblTitle`).value=state.table?(state.table.title||''):''; cfg.querySelector(`#${state.id}-note`).value=state.note||''; }
    }
    function setMode(next){ const v=String(next||'USER').toUpperCase()==='ADMIN'?'ADMIN':'USER'; state.mode=v; host.setAttribute('data-mode',v); renderTable(); if(v==='USER'){ host.querySelectorAll('.acc-admin').forEach(n=>n.style.display='none'); host.querySelectorAll('[contenteditable="true"]').forEach(el=>el.setAttribute('contenteditable','false')); }else{ host.querySelectorAll('.acc-admin').forEach(n=>n.style.display=''); host.querySelectorAll('.ta-subtitle div,.ta-list li div,.ta-table th,.ta-table td,.ta-a-text').forEach(el=>el.setAttribute('contenteditable','true')); } }

    renderTopTitle(); renderNote();
    const api={ getJSON,setJSON,setMode,ensureTable,removeTable };
    host._tap_acc=api; return api;
  }

  function autoload(){
    document.querySelectorAll('[data-tap-plugin="eligibility"]').forEach(node=>{ if(node._tap_acc) return; mount(node,{}); });
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',autoload); else autoload();

  global.TAPAccordionKit = { mount };
})(window);
