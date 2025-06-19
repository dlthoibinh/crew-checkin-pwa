/**************************************************************
 *  dash.js – Giám sát vị trí thời gian thực
 **************************************************************/
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxNwP7WG77tFYs8CRz6-e9-HwueWDo3m62BgWnSiHju/exec';  // ← thay
const REFRESH_MS = 15_000;
const $=id=>document.getElementById(id);
const qs=o=>new URLSearchParams(o).toString();
const api=a=>fetch(SCRIPT_URL+'?action='+a).then(r=>r.json());

let map=L.map('map').setView([16,106],6);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  { attribution:'© OpenStreetMap'}).addTo(map);
let cluster=L.markerClusterGroup(); map.addLayer(cluster);

function fill(sel,list){ list.filter(Boolean).sort().forEach(v=>{
  const o=document.createElement('option');o.value=o.textContent=v;sel.appendChild(o);
});}

let all=[];
async function load(){
  const rs=await api('getPositions'); if(rs.status!=='ok')return;
  all=rs.positions;                   // backup để export CSV
  /* fill filter dropdowns lần đầu */
  if($('#selComp').length===1){       // chỉ chạy 1 lần
    fill(selComp,[...new Set(all.map(p=>p.comp))]);
    fill(selUnit,[...new Set(all.map(p=>p.unit))]);
    fill(selCa  ,[...new Set(all.map(p=>p.ca  ))]);
  }
  draw();
}
function draw(){
  const comp=$('#selComp').value,unit=$('#selUnit').value,ca=$('#selCa').value,
        kw=$('#txtKw').value.toLowerCase(),act=$('#ckActive').checked;
  const now=Date.now();
  cluster.clearLayers();
  let count=0;
  all.filter(p=>
    (comp==='*'||p.comp===comp) &&
    (unit==='*'||p.unit===unit) &&
    (ca==='*'||p.ca===ca) &&
    (!act || now-new Date(p.time) < 3600e3) &&
    (kw===''||p.name.toLowerCase().includes(kw)||p.email.toLowerCase().includes(kw))
  ).forEach(p=>{
    const m=L.marker([p.lat,p.lng])
      .bindTooltip(`${p.name}<br>${p.unit}<br>${p.ca}<br>${timeAgo(p.time)} trước`);
    cluster.addLayer(m); count++;
  });
  if(count) map.fitBounds(cluster.getBounds(),{padding:[16,16]});
}
$('#btnLoad').onclick=draw;

/* Export CSV */
$('#btnCSV').onclick=()=>{
  if(!all.length){alert('Chưa có dữ liệu');return;}
  const rows=[["email","name","unit","comp","ca","lat","lng","time"],
    ...all.map(p=>[p.email,p.name,p.unit,p.comp,p.ca,p.lat,p.lng,p.time])];
  const blob=new Blob([rows.map(r=>r.join(',')).join('\n')],{type:'text/csv'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');
  a.href=url;a.download='positions.csv';a.click();URL.revokeObjectURL(url);
};

setInterval(load,REFRESH_MS); load();
