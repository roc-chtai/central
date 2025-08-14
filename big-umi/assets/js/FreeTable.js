// 全域切換 XOOPS/測試用
// const MODE = 'ADMIN';
const MODE = 'USER';

document.addEventListener('DOMContentLoaded', function(){
  const api = TAPSubjectsKit.mount('#subjectsPlugin', {
    mode: MODE,
    columns: [
      { label:'考科',        width:30 },
      { label:'科目名稱',    width:54 },
      { label:'錄取(備取)',  width:16 }
    ]
  });

  // 第一張：共同科目（不可刪列、不可刪整表；且一開始就用自己的欄位）
  api.addGroup(
    '共同科目',
    { sizeClass:'fs-5', locks:{ deleteRows:false, deleteGroup:false } },
    [[]],
    [ { label:'項目', width:30 }, { label:'科目名稱', width:70 } ] // 帶 columns => 這張表「已鎖定」
  );

  // 其他表：不帶 columns → 先跟全域欄位走；需要自訂時，按抬頭「鎖定欄位」再調
  // api.addGroup('文組', { sizeClass:'fs-5' }, [[]]);
});
