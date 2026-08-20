import re,io,subprocess,sys
f=sys.argv[1]
s=io.open(f+'.html',encoding='utf-8').read()
core=re.findall(r'<script>(.*?)</script>',s,re.S)[0].split('/* ═══════ РЕНДЕР')[0]
core+="""
function A(t){const o={};[...t.matchAll(/([a-z-]+)="([^"]*)"/g)].forEach(m=>o[m[1]]=m[2]);return o;}
function box(g,a){
  if(g==='rect')return[+a.x,+a.y,+a.x+ +a.width,+a.y+ +a.height];
  if(g==='circle')return[+a.cx-+a.r,+a.cy-+a.r,+a.cx+ +a.r,+a.cy+ +a.r];
  if(g==='ellipse')return[+a.cx-+a.rx,+a.cy-+a.ry,+a.cx+ +a.rx,+a.cy+ +a.ry];
  if(g==='polygon'){const n=a.points.trim().split(/\\s+/).map(p=>p.split(',').map(Number));
    if(n.some(q=>q.some(isNaN)))return null;
    return[Math.min(...n.map(q=>q[0])),Math.min(...n.map(q=>q[1])),Math.max(...n.map(q=>q[0])),Math.max(...n.map(q=>q[1]))];}
  return null;}
const MIN=10, bad=[];
Object.entries(ST).forEach(([k,st])=>{
  if(k==='memphis')return;                        // конфетти лежит поверх намеренно
  ELS.filter(([id])=>ALLOW[id].includes(k)).forEach(([id,l,fn])=>{
    let v;try{v=fn(st);}catch(e){return;}
    const nd=[...v.matchAll(/<(rect|circle|ellipse|polygon|text)[^>]*>([^<]*)/g)].map(m=>({g:m[1],a:A(m[0]),s:m[2]||''}));
    // фигура считается, если видна заливкой ИЛИ обводкой
    const shapes=nd.filter(q=>q.g!=="text" && !/url\(#(f-gb|f-ab|gl-blur|au-blur)\)/.test(q.a.filter||"") && (
        (q.a.fill && q.a.fill!=="none" && !(q.a["fill-opacity"] && +q.a["fill-opacity"]<0.45))
        || (q.a.stroke && q.a.stroke!=="none")))
      .map(q=>({b:box(q.g,q.a), hollow:!q.a.fill||q.a.fill==="none"||(q.a["fill-opacity"]&&+q.a["fill-opacity"]<0.45)}))
      .filter(o=>o.b && o.b[2]-o.b[0]<=230);
    const figs=shapes.map(o=>o.b);
    nd.filter(q=>q.g==='text').forEach(t=>{
      const tx=+t.a.x,ty=+t.a.y,fs=+(t.a['font-size']||10),top=ty-fs*0.72;
      // реальная протяжённость строки, а не одна точка привязки
      const wdt=(t.s||'').length*fs*0.55;
      const an=/text-anchor="middle"/.test(t.a['text-anchor']||'')||t.a['text-anchor']==='middle';
      const en=t.a['text-anchor']==='end';
      const x1=an?tx-wdt/2:en?tx-wdt:tx, x2=an?tx+wdt/2:en?tx:tx+wdt;
      // подпись внутри фигуры — это её собственная надпись, зазор считать не нужно
      const inside=figs.some(b=>x1>=b[0]-4&&x2<=b[2]+4&&ty>=b[1]&&ty<=b[3]+3);
      if(inside)return;
      const inHollow=shapes.some(o=>o.hollow && x1>=o.b[0]-2 && x2<=o.b[2]+2 && ty>=o.b[1] && ty<=o.b[3]);
      if(inHollow)return;
      let best=999;
      figs.forEach(b=>{ if(x2<b[0]-2||x1>b[2]+2)return;
        const gap=top-b[3]; if(gap>=0&&gap<best)best=gap;});
      if(best<MIN)bad.push([ELS.find(e=>e[0]===id)[1],best,k]);
    });
  });
});
const agg={};
bad.forEach(([nm,g,k])=>{if(!agg[nm]||g<agg[nm][0])agg[nm]=[g,k];});
const rows=Object.entries(agg).sort((a,b)=>a[1][0]-b[1][0]);
if(!rows.length)console.log('  отдельные подписи: зазор ≥ '+MIN+'px');
rows.forEach(([nm,[g,k]])=>console.log('  '+nm.padEnd(24)+g.toFixed(1).padStart(5)+'px  ('+k+')'));
"""
io.open(f'/tmp/g2_{f}.js','w',encoding='utf-8').write(core)
r=subprocess.run(['node',f'/tmp/g2_{f}.js'],capture_output=True,text=True)
print(f); print(r.stdout.rstrip() or ('ошибка: '+r.stderr[:200]))
