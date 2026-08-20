import re,io,subprocess,sys
f=sys.argv[1]
s=io.open(f+'.html',encoding='utf-8').read()
core=re.findall(r'<script>(.*?)</script>',s,re.S)[0].split('/* ═══════ РЕНДЕР')[0]
core+="""
function A(t){const o={};[...t.matchAll(/([a-z-]+)="([^"]*)"/g)].forEach(m=>o[m[1]]=m[2]);return o;}
const bad={};
Object.entries(ST).forEach(([k,st])=>ELS.filter(([id])=>ALLOW[id].includes(k)).forEach(([id,l,fn])=>{
  let v;try{v=fn(st);}catch(e){return;}
  const nd=[...v.matchAll(/<(rect|text)[^>]*>([^<]*)/g)].map(m=>({g:m[1],a:A(m[0]),s:m[2]||''}));
  // только блоки-строки: там центровка по вертикали и ожидается.
  // подложка карточки и широкие блики исключены, brutal — из-за смещённой тени
  if(k==='brutal')return;
  const boxes=nd.filter(q=>q.g==='rect'&&q.a.fill&&q.a.fill!=='none'
    &&+q.a.width>40&&+q.a.width<=230&&+q.a.height>=16&&+q.a.height<=34);
  nd.filter(q=>q.g==='text').forEach(t=>{
    const tx=+t.a.x,ty=+t.a.y,fs=+(t.a['font-size']||10);
    const top=ty-fs*0.72, bot=ty+fs*0.22;
    boxes.forEach(b=>{const x1=+b.a.x,y1=+b.a.y,x2=x1+ +b.a.width,y2=y1+ +b.a.height;
      if(tx<x1||tx>x2)return;
      const inBox=nd.filter(q=>q.g==='text'&&+q.a.x>=x1&&+q.a.x<=x2
        &&+q.a.y-(+(q.a['font-size']||10))*0.72>=y1&&+q.a.y<=y2).length;
      if(inBox>1)return;                        // многострочный блок центруется как целое
      if(bot<y1||top>y2)return;                     // не в этом блоке
      const padT=top-y1, padB=y2-bot;
      const m=Math.min(padT,padB), off=Math.abs(padT-padB);   // перекос вверх-вниз
      if(m<4||off>3){const key=ELS.find(e=>e[0]===id)[1];
        const sc=Math.min(m, 4-off/2);
        if(!bad[key]||sc<bad[key][0])bad[key]=[sc,k,t.s,padT.toFixed(1)+'/'+padB.toFixed(1)];}});});
}));
const rows=Object.entries(bad).sort((a,b)=>a[1][0]-b[1][0]);
if(!rows.length)console.log('  текст в фигурах: центрирован, отступ ≥ 4px');
rows.forEach(([nm,[m,k,txt,pp]])=>console.log('  '+nm.padEnd(24)+'сверху/снизу '+pp.padEnd(11)+'«'+txt+'» ('+k+')'));
"""
io.open(f'/tmp/i_{f}.js','w',encoding='utf-8').write(core)
r=subprocess.run(['node',f'/tmp/i_{f}.js'],capture_output=True,text=True)
print(f); print(r.stdout.rstrip() or ('ошибка '+r.stderr[:200]))
