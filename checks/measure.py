import re,io,subprocess,sys
f=sys.argv[1]
s=io.open(f+'.html',encoding='utf-8').read()
core=re.findall(r'<script>(.*?)</script>',s,re.S)[0].split('/* ═══════ РЕНДЕР')[0]
core+="""
function A(t){const o={};[...t.matchAll(/([a-z-]+)="([^"]*)"/g)].forEach(m=>o[m[1]]=m[2]);return o;}
function low(g,a){                       // нижняя визуальная граница фигуры или текста
  if(g==='text')return +a.y + (+(a['font-size']||10))*0.22;
  if(g==='rect')return +a.y+ +a.height;
  if(g==='circle')return +a.cy+ +a.r;
  if(g==='ellipse')return +a.cy+ +a.ry;
  if(g==='line')return Math.max(+a.y1,+a.y2);
  if(g==='polygon'){const n=a.points.trim().split(/\\s+/).map(p=>p.split(',').map(Number));
    if(n.some(q=>q.some(isNaN)))return null; return Math.max(...n.map(q=>q[1]));}
  return null;}
const CARD_BOTTOM=176;
const per={};
Object.entries(ST).forEach(([k,st])=>{
  if(['glass','aurora','memphis','brutal'].includes(k))return;   // декор выходит за кромку намеренно
  ELS.filter(([id])=>ALLOW[id].includes(k)).forEach(([id,l,fn])=>{
    let v;try{v=fn(st);}catch(e){return;}
    let mx=-999;
    [...v.matchAll(/<(rect|circle|ellipse|polygon|line|text)[^>]*>/g)].forEach(m=>{
      const a=A(m[0]); if(a.filter)return;
      const b=low(m[1],a); if(b===null)return;
      if(m[1]==='rect'&&+a.width>250&&+a.height>150)return;       // подложка
      if(b>mx)mx=b;});
    if(mx>-999){const gap=CARD_BOTTOM-mx;
      (per[id]=per[id]||[]).push(gap);}
  });
});
const rows=Object.entries(per).map(([id,g])=>{
  const nm=ELS.find(e=>e[0]===id)[1];
  return [nm, Math.min(...g), Math.max(...g)];
});
rows.sort((a,b)=>a[1]-b[1]);
rows.forEach(([nm,mn,mx])=>console.log('  '+nm.padEnd(24)+'от '+mn.toFixed(0).padStart(3)+' до '+mx.toFixed(0).padStart(3)+'px'));
"""
io.open(f'/tmp/m_{f}.js','w',encoding='utf-8').write(core)
r=subprocess.run(['node',f'/tmp/m_{f}.js'],capture_output=True,text=True)
print(f); print(r.stdout.rstrip() or r.stderr[:300])
