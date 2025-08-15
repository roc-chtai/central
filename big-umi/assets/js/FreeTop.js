/*! FreeTop.js — TAP 套件共用核心（FA5 版）
 * 功能：
 * 1) XOOPS/Admin 模式判定（統一 true/1/'1'/'true'）
 * 2) 取得 Font Awesome 類別（預設 FA5：'fas'）
 * 3) 通用 Icon Picker（prefix/主題色/icons 可自訂）
 * 4) 小工具：t / h / $all / uid / getByPath / setByPath
 * 5) JSON/JS 資料橋接：
 *    - serializeJSON(data,{minify})
 *    - exportAsJSVar(varPath,data)
 *    - attachJSVar(varPath,data)
 *    - insertJSONScript(id,data) / readJSONScript(id)
 *    - saveLocal(key,data) / loadLocal(key)
 *    - applyInitialJSON(host, api)  // data-json-var / data-json-script / data-json-local
 *
 */
(function (global) {
  'use strict';

  // ---------- 小工具 ----------
  function t(s){ return s==null ? '' : String(s); }
  function h(tag, cls, html){ const el=document.createElement(tag); if(cls) el.className=cls; if(html!=null) el.innerHTML=html; return el; }
  function $all(root, sel){ return Array.from((root instanceof Element?root:document).querySelectorAll(sel)); }
  function uid(prefix='tap'){ return `${prefix}-${Math.random().toString(36).slice(2,8)}-${Date.now().toString(36).slice(-3)}`; }
  function getByPath(obj, path){ if(!path) return; const segs=String(path).split('.'); let cur=obj; for(const k of segs){ if(cur==null) return; cur=cur[k]; } return cur; }
  function setByPath(obj, path, value){ const segs=String(path).split('.'); let cur=obj; for(let i=0;i<segs.length-1;i++){ const k=segs[i]; if(cur[k]==null||typeof cur[k]!=='object') cur[k]={}; cur=cur[k]; } cur[segs[segs.length-1]]=value; return obj; }

  // ---------- XOOPS / 模式判定 ----------
  function boolishTrue(v){ if(v===true||v===1) return true; if(typeof v==='string') return v==='1'||v.toLowerCase()==='true'; return false; }
  function isXoopsAdmin(g){ g=g||global; return boolishTrue(g.XOOPS_IS_ADMIN); }
  function resolveMode(host, opts={}, g){
    g=g||global;
    const pick=v=>{ const s=String(v||'').toUpperCase(); return (s==='ADMIN'||s==='USER')?s:null; };
    const explicit=pick(opts.mode||(host&&host.dataset&&host.dataset.mode)); if(explicit) return explicit;
    if(typeof g.TAP_DETECT_MODE==='function'){ const d=pick(g.TAP_DETECT_MODE()); if(d) return d; }
    if(isXoopsAdmin(g)) return 'ADMIN';
    const m=pick(g.MODE); if(m) return m;
    const def=pick(g.TAP_SUBJECTS_DEFAULT_MODE); if(def) return def;
    return 'USER';
  }
  // FA5：預設 'fas'（Solid）
  function getFaClass(host, opts={}, g){ g=g||global; return (host&&host.dataset&&host.dataset.fa)||opts.faClass||g.TAP_SUBJECTS_FA_CLASS||'fas'; }

  // ---------- Icon Picker ----------
  function ensureIconPickerStyle(prefix='tap', themeVar='--main-red', fallback='#ea7066'){
    const id=`freetop-ip-style-${prefix}`; if(document.getElementById(id)) return;
    const st=document.createElement('style'); st.id=id;
    st.textContent = `
      .${prefix}-ip-wrap{position:relative; display:inline-block;}
      .${prefix}-ip-btn{display:inline-flex; align-items:center; gap:.4rem;}
      .${prefix}-ip-menu{
        position:absolute; z-index:1050; top:100%; left:0; background:#fff;
        border:1px solid #e9ecef; border-radius:10px; box-shadow:0 6px 18px rgba(0,0,0,.08);
        padding:10px; margin-top:6px; width:300px; max-height:260px; overflow:auto;
      }
      .${prefix}-ip-grid{display:grid; grid-template-columns:repeat(6,1fr); gap:8px;}
      .${prefix}-ip-item{
        display:flex; justify-content:center; align-items:center;
        width:44px; height:40px; border:1px solid #eee; border-radius:8px;
        cursor:pointer; transition:.15s;
      }
      .${prefix}-ip-item:hover{transform:translateY(-1px); border-color:#ddd;}
      .${prefix}-ip-item.active{border-color:var(${themeVar}, ${fallback}); box-shadow:0 0 0 2px rgba(234,112,102,.15);}
      .${prefix}-ip-none{font-size:12px; color:#6c757d;}
    `;
    document.head.appendChild(st);
  }
  function iconPicker({ faClass='fas', value='', icons=[''], prefix='tap', themeVar='--main-red', fallback='#ea7066' } = {}){
    ensureIconPickerStyle(prefix, themeVar, fallback);
    const wrap=h('div',`${prefix}-ip-wrap`);
    const btn =h('button',`btn btn-outline-secondary btn-sm ${prefix}-ip-btn`);
    btn.type='button';
    const colorCss=`style="color:var(${themeVar}, ${fallback});"`;
    const btnHtml=v=> v ? `<i class="${faClass} ${v}" ${colorCss}></i><span>更換圖示</span>` : `<span class="${prefix}-ip-none">選擇圖示（可不選）</span>`;
    btn.innerHTML=btnHtml(value);
    const menu=h('div',`${prefix}-ip-menu d-none`);
    const grid=h('div',`${prefix}-ip-grid`);
    (icons&&icons.length?icons:['']).forEach(ic=>{
      const cell=h('div',`${prefix}-ip-item${ic===value?' active':''}`, ic?`<i class="${faClass} ${ic}" ${colorCss}></i>`:`<span class="${prefix}-ip-none">無</span>`);
      cell.dataset.icon=ic; grid.appendChild(cell);
    });
    menu.appendChild(grid); wrap.appendChild(btn); wrap.appendChild(menu);
    const open =()=>{ menu.classList.remove('d-none'); document.addEventListener('click', onDoc); };
    const close=()=>{ menu.classList.add('d-none');   document.removeEventListener('click', onDoc); };
    const onDoc=e=>{ if(!wrap.contains(e.target)) close(); };
    let current=value||'';
    btn.addEventListener('click', e=>{ e.stopPropagation(); menu.classList.contains('d-none')?open():close(); });
    grid.addEventListener('click', e=>{
      const cell=e.target.closest(`.${prefix}-ip-item`); if(!cell) return;
      current=cell.dataset.icon||'';
      grid.querySelectorAll(`.${prefix}-ip-item`).forEach(i=>i.classList.toggle('active', i===cell));
      btn.innerHTML=btnHtml(current); close();
      wrap.dispatchEvent(new CustomEvent('icon:change',{ detail:{ icon: current }}));
    });
    return { root:wrap, get:()=>current, set:(v='')=>{ current=v||''; grid.querySelectorAll(`.${prefix}-ip-item`).forEach(i=>i.classList.toggle('active', i.dataset.icon===current)); btn.innerHTML=btnHtml(current); } };
  }

  // ---------- 單一 ICON 清單（FA5） ----------
  const ICON_LIST = [
    '', // 代表「無」
    'fa-book','fa-users','fa-gavel','fa-briefcase','fa-stethoscope',
    'fa-flask','fa-cog','fa-chart-line','fa-university','fa-user-graduate',
    'fa-balance-scale','fa-id-card-alt','fa-star','fa-check','fa-info-circle',
    'fa-exclamation-circle','fa-list','fa-table','fa-clipboard','fa-search','fa-link'
  ];
  function getIconSet(){ return ICON_LIST.slice(); }

  // ---------- JSON / JS 資料橋接 ----------
  function serializeJSON(data, { minify=true } = {}){ return minify ? JSON.stringify(data) : JSON.stringify(data, null, 2); }
  function exportAsJSVar(varPath, data, { minify=true } = {}){
    const segs=String(varPath).split('.'); const root=segs.shift();
    let pre=`window.${root} = window.${root} || {};\n`; let curPath=`window.${root}`;
    for(const s of segs){ pre+=`${curPath}.${s} = ${curPath}.${s} || {};\n`; curPath+=`.${s}`; }
    const json=serializeJSON(data, {minify}); return `${pre}${curPath} = ${json};\n`;
  }
  function attachJSVar(varPath, data){ setByPath(global, varPath, data); return getByPath(global, varPath); }
  function insertJSONScript(id, data, { minify=true } = {}){ const el=document.getElementById(id)||document.createElement('script'); el.type='application/json'; el.id=id; el.textContent=serializeJSON(data,{minify}); document.head.appendChild(el); return el; }
  function readJSONScript(id){ const el=document.getElementById(id); if(!el||el.type!=='application/json') return null; try{ return JSON.parse(el.textContent||'{}'); }catch(e){ console.warn('[FreeTop] JSON parse failed:', e); return null; } }
  function saveLocal(key, data){ try{ localStorage.setItem(key, serializeJSON(data,{minify:true})); }catch(e){} }
  function loadLocal(key){ try{ const s=localStorage.getItem(key); return s?JSON.parse(s):null; }catch(e){ return null; } }
  function applyInitialJSON(host, api){
    if(!host||!api||typeof api.setJSON!=='function') return;
    const varPath=host.dataset.jsonVar; const scriptId=host.dataset.jsonScript; const localKey=host.dataset.jsonLocal;
    let data=null;
    if(varPath) data=getByPath(global,varPath);
    else if(scriptId) data=readJSONScript(scriptId);
    else if(localKey) data=loadLocal(localKey);
    if(data) api.setJSON(data);
  }

  // ---------- 對外 ----------
  const FreeTop = {
    version:'1.0.0-fa5-no-compat',
    // 判定
    resolveMode, isXoopsAdmin, getFaClass,
    // 工具
    t, h, $all, uid, getByPath, setByPath,
    // Icon
    iconPicker, getIconSet,
    // 資料橋接
    serializeJSON, exportAsJSVar, attachJSVar,
    insertJSONScript, readJSONScript, saveLocal, loadLocal, applyInitialJSON
  };
  global.FreeTop = FreeTop;
})(window);
