import re,io,subprocess,sys
f=sys.argv[1]
s=io.open(f+'.html',encoding='utf-8').read()
js=re.findall(r'<script>(.*?)</script>',s,re.S)[0]
core=js.split('/* ═══════ РЕНДЕР')[0]
has_lum='lumOf' in core
core+="""
function A(t){const o={};[...t.matchAll(/([a-z-]+)="([^"]*)"/g)].forEach(m=>o[m[1]]=m[2]);return o;}
function bb(g,a){
  if(g==='rect')return[+a.x,+a.y,+a.x+ +a.width,+a.y+ +a.height];
  if(g==='circle')return[+a.cx-+a.r,+a.cy-+a.r,+a.cx+ +a.r,+a.cy+ +a.r];
  if(g==='ellipse')return[+a.cx-+a.rx,+a.cy-+a.ry,+a.cx+ +a.rx,+a.cy+ +a.ry];
  if(g==='polygon'){const n=a.points.trim().split(/\\s+/).map(p=>p.split(',').map(Number));
    if(n.some(q=>q.some(isNaN)))return null;
    return[Math.min(...n.map(q=>q[0])),Math.min(...n.map(q=>q[1])),Math.max(...n.map(q=>q[0])),Math.max(...n.map(q=>q[1]))];}
  return null;}
const deco=k=>['glass','aurora','memphis','brutal'].includes(k);
const geo=[],tight=[],ov=[],con=[];let n=0;
Object.entries(ST).forEach(([k,st])=>ELS.filter(([id])=>ALLOW[id].includes(k)).forEach(([id,l,fn])=>{n++;
  let v;try{v=fn(st);}catch(e){geo.push(k+'/'+id+' ИСКЛЮЧЕНИЕ: '+e.message);return;}
  if(!/<text/.test(v))geo.push(k+'/'+id+' нет текста');
  if(/NaN|undefined/.test(v))geo.push(k+'/'+id+' NaN');
  const nd=[...v.matchAll(/<(rect|circle|ellipse|polygon|text)[^>]*>/g)].map(m=>({g:m[1],a:A(m[0]),i:m.index}));
  if(!deco(k)){let w=99;
    nd.filter(q=>q.g!=='text'&&!q.a.filter).forEach(q=>{const b=bb(q.g,q.a);if(!b)return;
      if(b[2]-b[0]>250&&b[3]-b[1]>150)return;
      w=Math.min(w,b[0]-14,b[1]-14,286-b[2],176-b[3]);});
    if(w<6)tight.push(k+'/'+id+'('+w.toFixed(0)+')');}
  // сравниваем реальные полосы строк, а не расстояние между базовыми линиями
  const T=nd.filter(q=>q.g==='text').map(q=>{const f=+(q.a['font-size']||10);
    return {x:+q.a.x, top:+q.a.y-f*0.72, bot:+q.a.y+f*0.22};});
  T.forEach((a,i)=>T.slice(i+1).forEach(b=>{
    const overlap=Math.min(a.bot,b.bot)-Math.max(a.top,b.top);
    if(overlap>1&&Math.abs(a.x-b.x)<24)ov.push(k+'/'+id);}));
  // у стилей без панели текст ложится прямо на поле — тёмный там не читается
  if(st.surf===null){
    nd.filter(q=>q.g==='text').forEach(t2=>{
      const tx=+t2.a.x,ty=+t2.a.y;let on=false;
      nd.filter(q=>q.g!=='text'&&q.i<t2.i).forEach(rr=>{const a=rr.a;
        if(!a.fill||a.fill==='none'||a.filter)return;
        const b=bb(rr.g,a);if(!b)return;
        if(b[2]-b[0]>250&&b[3]-b[1]>150)return;
        if(tx>=b[0]-2&&tx<=b[2]+2&&ty>=b[1]-2&&ty<=b[3]+4)on=true;});
      if(on)return;
      const L=lumOf(st,t2.a.fill);
      if(L!==null&&L<0.6)con.push(k+'/'+id+' тёмный на поле «'+t2.a.fill+'»');});
  }
  LUMCHECK
}));
console.log(f_name+' — пар '+n);
if(geo.length)console.log('  ГЕОМЕТРИЯ: '+[...new Set(geo)].join(', '));
if(tight.length)console.log('  КРОМКА: '+[...new Set(tight)].join(', '));
if(ov.length)console.log('  НАЛОЖЕНИЯ: '+[...new Set(ov)].join(', '));
if(con.length)console.log('  КОНТРАСТ: '+[...new Set(con)].join(', '));
if(!geo.length&&!tight.length&&!ov.length&&!con.length)console.log('  чисто');
"""
lum = """
  nd.filter(q=>q.g==='text').forEach(t2=>{const tx=+t2.a.x,ty=+t2.a.y;let u=null;
    nd.filter(q=>q.g!=='text'&&q.i<t2.i).forEach(rr=>{const a=rr.a;
      if(!a.fill||a.fill==='none'||a.filter)return;
      if(a['fill-opacity']!==undefined&&+a['fill-opacity']<=0.5)return;
      const b=bb(rr.g,a);if(!b)return;
      if(b[2]-b[0]>250&&b[3]-b[1]>150)return;
      if(tx>=b[0]-2&&tx<=b[2]+2&&ty>=b[1]-2&&ty<=b[3]+4)u=a.fill;});
    if(!u)return;const lu=lumOf(st,u),lt=lumOf(st,t2.a.fill);
    if(lu===null||lt===null)return;
    if(Math.abs(lu-lt)<0.2)con.push(k+'/'+id);});
""" if has_lum else ""
core=core.replace('LUMCHECK',lum).replace('f_name',repr(f))
io.open(f'/tmp/v_{f}.js','w',encoding='utf-8').write(core)
r=subprocess.run(['node',f'/tmp/v_{f}.js'],capture_output=True,text=True)
print(r.stdout or ('ОШИБКА: '+r.stderr[:300]))
