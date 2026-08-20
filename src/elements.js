import * as ENG from './engine.js';
// вытаскиваем всё, что экспортирует движок, чтобы не следить за списком вручную
const { ST, W, H, PAD, t, esc, txt, surface, shape, chip, track, frame, wrapSvg,
  chev, node, conn, lumOf, nodeTx, bgTx, onNode, wrap, fitLines, txtLines,
  wrapSvgH, frameH, s_glass_a, s_glass_b } = ENG;

/* ══════ ПОДГОНКА ПОД ПЕРЕДАННЫЙ ТЕКСТ ══════
   Элементы принимают вторым аргументом данные по договору из spec/elements.json.
   Без него рисуется прежний образец — разметка при этом совпадает побайтово,
   поэтому гарантия «676 пар, сбоев 0» держится.

   Русские подписи длиннее английских, и переданные длиннее образцовых.
   Порядок подгонки взят из spec/rules.json: сперва уменьшить кегль
   до нижней границы, затем обрезать с многоточием. */

const ШИР = 0.55;                                  // средняя ширина знака, spec/tokens.json
const мера = (str, fs) => String(str).length * fs * ШИР;

/* Одна строка в заданную ширину: [текст, кегль] */
function ужать(str, maxW, fs, minFs) {
  str = String(str ?? ''); minFs = minFs || fs * 0.72;
  let f = fs;
  while (мера(str, f) > maxW && f > minFs) f -= 0.5;
  if (мера(str, f) <= maxW) return [str, f];
  let о = str;
  while (о.length > 1 && мера(о + '…', f) > maxW) о = о.slice(0, -1);
  return [о + '…', f];
}

/* Общий кегль на набор строк — чтобы подписи в ряду не разъезжались по размеру */
function ужатьНабор(список, maxW, fs, minFs) {
  const f = список.reduce((м, с) => Math.min(м, ужать(с, maxW, fs, minFs)[1]), fs);
  return [список.map(с => ужать(с, maxW, f, f)[0]), f];
}

/* Нижний отступ из spec/rules.json: не менее 16px от визуального низа
   содержимого до нижней кромки карточки. Холст растёт с учётом этого запаса,
   иначе прибавка строк упирает содержимое в край */
const НИЗ = 16;
const рост = визуальныйНиз => Math.max(H, визуальныйНиз + НИЗ + PAD);

/* Данные с подстановкой образца: пустое или неполное поле не должно ронять отрисовку */
const ряды = (д, образец, макс) => (Array.isArray(д) && д.length ? д : образец).slice(0, макс || 99);
const строка = (д, образец) => (д === undefined || д === null || д === '') ? образец : String(д);

/* ══════ Диаграммы и данные ══════ */

// 1 ── KPI карточка
function elKpi(s){
  const x=PAD,y=PAD,w=W-PAD*2,h=H-PAD*2;
  const iso=s.mode==='iso',cx=x+22,base=iso?y+34:y+22;
  let o=frame(s)+surface(s,x,y,iso?w-s.dx:w,iso?h+s.dy:h);
  o+=txt(s,cx,base+22,t(s,'Выручка'),13,s.wl,s.ts,s.ls);
  o+=txt(s,cx,base+76,'₸2.4B',38,s.wv,s.mode==='neon'||s.mode==='retro'?s.ac:s.tp,-1);
  o+=chip(s,cx,base+92,'▲ 23% г/г');
  return wrapSvg(s,o);
}

// 2 ── Прогресс-бары
function elBars(s,дан){
  const пал=[s.ac,s.ac3,s.ac2,s.pos,s.tm];
  const rows=ряды(дан&&дан.rows,[{label:'Внедрение',v:78},{label:'Автоматизация',v:55},{label:'Оцифровка',v:91}],5);
  const заг=дан&&дан.title?String(дан.title):null;
  const x=PAD,y=PAD,w=W-PAD*2,iso=s.mode==='iso';
  const top=(iso?y+40:y+30)+(заг?20:0);
  const bh=s.mode==='clay'?12:s.mode==='retro'?10:9;
  /* Шаг ряда сперва ужимается по доступной высоте и только упёршись в нижнюю
     границу поднимает холст (spec/rules.json, «распределение_строк»).
     Нижняя граница считается от геометрии: низ шкалы плюс обязательные 10px
     зазора плюс верхний выносной следующей подписи */
  const минШаг=8+bh+10.5+12*0.72;   // полпикселя запаса: иначе зазор ложится ровно на порог
  const доступно=(H-PAD-НИЗ)-top-(8+bh);
  const шаг=rows.length>1?Math.max(минШаг,Math.min(44,доступно/(rows.length-1))):44;
  const hh=рост(top+(rows.length-1)*шаг+8+bh);          // холст растёт под число рядов
  const h=hh-PAD*2;
  let o=frameH(s,hh)+surface(s,x,y,iso?w-s.dx:w,iso?h+s.dy:h);
  const cx=x+20,bw=w-52;
  if(заг)o+=txt(s,cx,y+24,t(s,ужать(заг,bw,12,9)[0]),12,s.wl,s.ts,s.ls);
  // подпись слева не должна доехать до значения справа
  const [подписи,fs]=ужатьНабор(rows.map(р=>t(s,String(р.label==null?'':р.label))),bw-44,12,8.5);
  rows.forEach((р,i)=>{
    const v=Math.max(0,Math.min(100,Number(р.v)||0)),c=пал[i%пал.length],by=top+i*шаг;
    o+=txt(s,cx,by,подписи[i],fs,s.wl,s.ts,s.ls);
    o+=txt(s,cx+bw,by,v+'%',12,700,s.mode==='duotone'||s.mode==='gradient'?s.tp:c,null).replace('<text ','<text text-anchor="end" ');
    o+=track(s,cx,by+8,bw,bh);
    o+=shape(s,cx,by+8,bw*v/100,bh,c,1);
  });
  return wrapSvgH(s,o,hh);
}

// 3 ── Столбчатый график
function elColumn(s){
  const x=PAD,y=PAD,w=W-PAD*2,h=H-PAD*2;
  const iso=s.mode==='iso';
  let o=frame(s)+surface(s,x,y,iso?w-s.dx:w,iso?h+s.dy:h);
  const ox=x+26,oy=y+22,pw=w-58,ph=h-98;
  o+=txt(s,ox,oy+12,t(s,'Выручка по кварталам'),12,s.wl,s.ts,s.ls);
  const vals=[52,71,45,88,63],labs=['Q1','Q2','Q3','Q4','Q5'];
  const bw=Math.floor(pw/vals.length)-10,baseY=oy+28+ph;
  // ось
  if(s.mode==='line'||s.mode==='flat'||s.mode==='glass'||s.mode==='aurora')
    o+=`<line x1="${ox}" y1="${baseY}" x2="${ox+pw}" y2="${baseY}" stroke="${s.ln}" stroke-width="1"/>`;
  if(s.mode==='brutal'||s.mode==='retro')
    o+=`<rect x="${ox}" y="${baseY}" width="${pw}" height="${s.mode==='brutal'?3:2}" fill="${s.mode==='brutal'?'#000':s.track}"/>`;
  vals.forEach((v,i)=>{
    const bh=Math.round(ph*v/100),bx=ox+i*(bw+10);
    const col=i===3?s.ac:(s.mode==='duotone'||s.mode==='gradient'?s.ac2:s.mode==='memphis'?[s.ac,s.ts,s.ac3,s.ac,s.pos][i]:s.ac3);
    o+=shape(s,bx,baseY-bh,bw,bh,col,0);
    o+=txt(s,bx+bw/2,baseY+21,labs[i],11,s.wl,i===3?(s.mode==='brutal'?s.tp:s.ac):s.tm,null).replace('<text ','<text text-anchor="middle" ');
  });
  return wrapSvg(s,o);
}

// 4 ── Кольцевая диаграмма
function elDonut(s,дан){
  const x=PAD,y=PAD,w=W-PAD*2,h=H-PAD*2;
  let o=frame(s)+surface(s,x,y,w,h);
  const cx=x+64,cy=y+h/2,R=48,SW=s.mode==='clay'?20:s.mode==='line'?2:15;
  const пал=[s.ac,s.ac3,s.ac2,s.tm,s.pos];
  const доли=ряды(дан&&дан.segments,
    [{label:'ИТ-услуги',v:46},{label:'Лицензии',v:27},{label:'Поддержка',v:17},{label:'',v:10}],5);
  const segs=доли.map((г,i)=>[Math.max(0,Number(г.v)||0),пал[i%пал.length]]);
  const центр=строка(дан&&дан.center,'46%');
  const C=2*Math.PI*R;let off=0;
  const gl=s.glow?` filter="${s.glow}"`:'';
  if(s.mode!=='line') o+=`<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${s.ln}" stroke-width="${SW}"/>`;
  segs.forEach(([v,c])=>{
    const len=C*v/100;
    const cap=(s.mode==='clay')?'round':'butt';
    o+=`<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${c}" stroke-width="${SW}" stroke-linecap="${cap}" stroke-dasharray="${len-2} ${C-len+2}" stroke-dashoffset="${-off}" transform="rotate(-90 ${cx} ${cy})"${gl}/>`;
    off+=len;
  });
  if(s.mode==='brutal') o+=`<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${s.hard}" stroke-width="2"/><circle cx="${cx}" cy="${cy}" r="${R-SW}" fill="none" stroke="${s.hard}" stroke-width="2"/>`;
  const [ц,цfs]=ужать(центр,R*1.4,20,13);
  o+=txt(s,cx,cy+6,ц,цfs,s.wv,s.mode==='neon'||s.mode==='retro'?s.ac:s.tp,null).replace('<text ','<text text-anchor="middle" ');
  // легенда: доли без подписи в неё не идут, блок центрируется по кольцу
  const lx=cx+R+22;
  const легенда=доли.map((г,i)=>[String(г.label==null?'':г.label),пал[i%пал.length]]).filter(п=>п[0]);
  const [имена,лfs]=ужатьНабор(легенда.map(п=>t(s,п[0])),x+w-20-(lx+15),11,8.5);
  легенда.forEach((п,i)=>{
    const ly=cy-(легенда.length-1)*11+i*22;
    o+=s.mode==='line'?`<rect x="${lx}" y="${ly-7}" width="9" height="9" fill="none" stroke="${п[1]}" stroke-width="1.5"/>`
                      :`<rect x="${lx}" y="${ly-7}" width="9" height="9" rx="${s.mode==='clay'?4.5:2}" fill="${п[1]}"/>`;
    o+=txt(s,lx+15,ly,имена[i],лfs,s.wl,s.ts,null);
  });
  return wrapSvg(s,o);
}


/* ── точка на луче радара ── */
function radPt(cx,cy,R,i,n,v){const a=-Math.PI/2+i*2*Math.PI/n;const r=R*v/100;
  return [+(cx+r*Math.cos(a)).toFixed(1),+(cy+r*Math.sin(a)).toFixed(1)];}

// 5 ── Радар
function elRadar(s){
  const x=PAD,y=PAD,w=W-PAD*2,h=H-PAD*2;
  let o=frame(s)+surface(s,x,y,w,h);
  const cx=x+w/2,cy=y+h/2,R=40,N=6;
  const vals=[86,62,92,56,76,68],labs=['Скорость','Качество','Цена','Охват','Сервис','Риск'];
  o+=txt(s,x+20,y+24,t(s,'Профиль решения'),12,s.wl,s.ts,s.ls);
  const dash=s.mode==='line'?' stroke-dasharray="3 3"':'';
  [100,66,33].forEach(k=>{
    const pts=[...Array(N)].map((_,i)=>radPt(cx,cy,R,i,N,k).join(',')).join(' ');
    o+=`<polygon points="${pts}" fill="none" stroke="${s.ln}" stroke-width="1"${dash}/>`;});
  for(let i=0;i<N;i++){const p=radPt(cx,cy,R,i,N,100);
    o+=`<line x1="${cx}" y1="${cy}" x2="${p[0]}" y2="${p[1]}" stroke="${s.ln}" stroke-width="1"/>`;}
  const dp=vals.map((v,i)=>radPt(cx,cy,R,i,N,v).join(',')).join(' ');
  const gl=s.glow?` filter="${s.glow}"`:'';
  let fillOp='.28',sw=2,extra='';
  if(s.mode==='line'){fillOp='0';sw=1.8;}
  else if(s.mode==='neon'){fillOp='.18';sw=1.5;}
  else if(s.mode==='clay'){fillOp='.32';sw=5;extra=' stroke-linejoin="round"';}
  else if(s.mode==='retro'){fillOp='.35';sw=2;}
  else if(s.mode==='memphis'){fillOp='.3';sw=2.5;}
  else if(s.mode==='glass'||s.mode==='aurora'){fillOp='.24';sw=1.6;}
  o+=`<polygon points="${dp}" fill="${s.ac}" fill-opacity="${fillOp}" stroke="${s.ac}" stroke-width="${sw}"${extra}${gl}/>`;
  if(s.mode!=='line'&&s.mode!=='retro')
    vals.forEach((v,i)=>{const p=radPt(cx,cy,R,i,N,v);
      o+=`<circle cx="${p[0]}" cy="${p[1]}" r="${s.mode==='clay'?4:3}" fill="${s.ac}"${gl}/>`;});
  labs.forEach((l,i)=>{const p=radPt(cx,cy,R+17,i,N,100);
    const an=p[0]>cx+3?'start':p[0]<cx-3?'end':'middle';
    o+=txt(s,p[0],p[1]+3,t(s,l),9,s.wl,s.tm,null).replace('<text ',`<text text-anchor="${an}" `);});
  return wrapSvg(s,o);
}

// 6 ── Спидометр
function elGauge(s){
  const x=PAD,y=PAD,w=W-PAD*2,h=H-PAD*2,iso=s.mode==='iso';
  let o=frame(s)+surface(s,x,y,iso?w-s.dx:w,iso?h+s.dy:h);
  const cx=x+w/2,cy=y+h-46,R=52,V=73;
  const SW=s.mode==='line'?2.5:s.mode==='clay'?20:s.mode==='retro'?0:15;
  const L=Math.PI*R;
  const arc=`M ${cx-R} ${cy} A ${R} ${R} 0 0 1 ${cx+R} ${cy}`;
  const cap=s.mode==='clay'?'round':'butt';
  const gl=s.glow?` filter="${s.glow}"`:'';
  o+=txt(s,x+20,y+24,t(s,'Готовность'),12,s.wl,s.ts,s.ls);
  if(s.mode==='retro'){ // дуга набрана отдельными сегментами
    const N=16;
    for(let i=0;i<N;i++){const a=Math.PI*(1-i/(N-1));
      const px=cx+(R-7)*Math.cos(a),py=cy-(R-7)*Math.sin(a);
      const on=i/(N-1)<=V/100;
      o+=`<rect x="${(px-5).toFixed(1)}" y="${(py-5).toFixed(1)}" width="10" height="10" fill="${on?s.ac:s.track}"/>`;}
  }else{
    o+=`<path d="${arc}" fill="none" stroke="${s.ln}" stroke-width="${SW}" stroke-linecap="${cap}"/>`;
    o+=`<path d="${arc}" fill="none" stroke="${s.ac}" stroke-width="${SW}" stroke-linecap="${cap}" stroke-dasharray="${(L*V/100).toFixed(1)} ${L.toFixed(1)}"${gl}/>`;
    if(s.mode==='brutal'){
      o+=`<path d="${arc}" fill="none" stroke="${s.hard}" stroke-width="2"/>`;
      const ir=`M ${cx-R+SW} ${cy} A ${R-SW} ${R-SW} 0 0 1 ${cx+R-SW} ${cy}`;
      o+=`<path d="${ir}" fill="none" stroke="${s.hard}" stroke-width="2"/>`;}
  }
  o+=txt(s,cx,cy-8,V+'%',26,s.wv,s.mode==='neon'||s.mode==='retro'?s.ac:s.tp,-.5).replace('<text ','<text text-anchor="middle" ');
  o+=txt(s,cx,cy+20,t(s,'план на квартал'),10,s.wl,s.tm,null).replace('<text ','<text text-anchor="middle" ');
  return wrapSvg(s,o);
}

// 7 ── Area chart
function elArea(s){
  const x=PAD,y=PAD,w=W-PAD*2,h=H-PAD*2;
  let o=frame(s)+surface(s,x,y,w,h);
  const ox=x+24,oy=y+40,pw=w-48,ph=h-78;
  o+=txt(s,x+20,y+24,t(s,'Динамика за 7 месяцев'),12,s.wl,s.ts,s.ls);
  const vals=[42,55,48,68,60,82,76],n=vals.length;
  const px=i=>+(ox+i*pw/(n-1)).toFixed(1), py=v=>+(oy+ph-ph*v/100).toFixed(1);
  const gl=s.glow?` filter="${s.glow}"`:'';
  const base=oy+ph;
  o+=`<line x1="${ox}" y1="${base}" x2="${ox+pw}" y2="${base}" stroke="${s.ln}" stroke-width="${s.mode==='brutal'?3:1}"/>`;
  let line,area;
  if(s.mode==='retro'){ // ступенчатая линия
    let d=`M ${px(0)} ${py(vals[0])}`;
    for(let i=1;i<n;i++) d+=` L ${px(i)} ${py(vals[i-1])} L ${px(i)} ${py(vals[i])}`;
    line=d; area=d+` L ${px(n-1)} ${base} L ${px(0)} ${base} Z`;
  }else{
    let d=`M ${px(0)} ${py(vals[0])}`;
    for(let i=1;i<n;i++) d+=` L ${px(i)} ${py(vals[i])}`;
    line=d; area=d+` L ${px(n-1)} ${base} L ${px(0)} ${base} Z`;
  }
  if(s.mode!=='line'){
    const op=s.mode==='neon'?'.16':s.mode==='brutal'?'.14':s.mode==='glass'?'.26':'.28';
    o+=`<path d="${area}" fill="${s.ac}" fill-opacity="${op}"/>`;}
  const lw=s.mode==='brutal'?4:s.mode==='clay'?5:s.mode==='line'?1.8:2.2;
  o+=`<path d="${line}" fill="none" stroke="${s.ac}" stroke-width="${lw}" stroke-linejoin="round" stroke-linecap="round"${gl}/>`;
  if(s.mode!=='retro'&&s.mode!=='line')
    o+=`<circle cx="${px(n-1)}" cy="${py(vals[n-1])}" r="${s.mode==='clay'?5:4}" fill="${s.ac}"${gl}/>`;
  o+=txt(s,ox+pw,py(vals[n-1])-12,'+34%',12,700,s.ac,null).replace('<text ','<text text-anchor="end" ');
  ['Янв','Мар','Май','Июл'].forEach((m,i)=>
    o+=txt(s,px(i*2),base+18,t(s,m),9,s.wl,s.tm,null).replace('<text ','<text text-anchor="middle" '));
  return wrapSvg(s,o);
}

// 8 ── Waterfall
function elWaterfall(s){
  const x=PAD,y=PAD,w=W-PAD*2,h=H-PAD*2,iso=s.mode==='iso';
  let o=frame(s)+surface(s,x,y,iso?w-s.dx:w,iso?h+s.dy:h);
  const ox=x+24,oy=y+42,pw=w-56-(iso?s.dx:0),ph=h-80;
  o+=txt(s,x+20,y+24,t(s,'Прибыль по этапам'),12,s.wl,s.ts,s.ls);
  const steps=[{l:'База',v:100,type:'t'},{l:'Услуги',v:42,type:'p'},{l:'Затраты',v:-30,type:'n'},{l:'Лицензии',v:26,type:'p'},{l:'Итог',v:138,type:'t'}];
  const max=150,bw=Math.floor(pw/steps.length)-9,base=oy+ph;
  const hOf=v=>Math.round(ph*Math.abs(v)/max);
  const negCol=s.mode==='brutal'||s.mode==='line'||s.mode==='duotone'||s.mode==='aurora'?s.ac3:s.neg;
  const posCol=s.mode==='duotone'||s.mode==='aurora'?s.ac2:s.pos;
  let cum=0,prevTop=null;
  o+=`<line x1="${ox}" y1="${base}" x2="${ox+pw}" y2="${base}" stroke="${s.ln}" stroke-width="${s.mode==='brutal'?3:1}"/>`;
  steps.forEach((st,i)=>{
    const bx=ox+i*(bw+9);
    let top,bh;
    if(st.type==='t'){bh=hOf(st.v);top=base-bh;cum=st.v;}
    else{bh=hOf(st.v);cum+= st.v;top=st.v>0?base-hOf(cum):base-hOf(cum)-bh;}
    const col=st.type==='t'?s.ac:st.v>0?posCol:negCol;
    if(prevTop!==null&&s.mode!=='retro')
      o+=`<line x1="${bx-9}" y1="${prevTop}" x2="${bx}" y2="${prevTop}" stroke="${s.ln}" stroke-width="1" stroke-dasharray="3 2"/>`;
    o+=shape(s,bx,top,bw,bh,col,0);
    prevTop=st.v>0||st.type==='t'?top:top+bh;
    o+=txt(s,bx+bw/2,base+18,t(s,st.l),9,s.wl,st.type==='t'?s.ts:s.tm,null).replace('<text ','<text text-anchor="middle" ');
    const vl=st.type==='t'?String(st.v):(st.v>0?'+':'')+st.v;
    o+=txt(s,bx+bw/2,top-6,vl,10,700,col,null).replace('<text ','<text text-anchor="middle" ');
  });
  return wrapSvg(s,o);
}

// 9 ── Heatmap
function elHeat(s,дан){
  const x=PAD,y=PAD,w=W-PAD*2,h=H-PAD*2;
  let o=frame(s)+surface(s,x,y,w,h);
  const заг=строка(дан&&дан.title,'Активность по дням');
  o+=txt(s,x+20,y+24,t(s,ужать(заг,w-40,12,9)[0]),12,s.wl,s.ts,s.ls);
  const M=(Array.isArray(дан&&дан.matrix)&&дан.matrix.length?дан.matrix:[[2,6,9,4,7],[8,3,5,9,6],[4,9,3,7,8],[6,5,8,2,9]])
    .slice(0,5).map(р=>(Array.isArray(р)?р:[]).slice(0,6).map(v=>Number(v)||0));
  const нc=Math.max(...M.map(р=>р.length),1),нr=M.length;
  const g=3,ox=x+38,oy=y+34;
  // ячейка ужимается под число столбцов, а не наоборот
  const cw=Math.min(40,((x+w-14)-ox-(нc-1)*g)/нc),ch=Math.min(20,(h-34-22-(нr-1)*g)/нr);
  const макс=Math.max(...M.flat(),1);               // интенсивность считается от максимума
  const [days]=ужатьНабор(ряды(дан&&дан.cols,['Пн','Вт','Ср','Чт','Пт'],нc).map(String),cw,9,7);
  const [wks]=ужатьНабор(ряды(дан&&дан.rows,['н1','н2','н3','н4'],нr).map(String),ox-x-24,9,7);
  M.forEach((row,r)=>row.forEach((v,c)=>{
    const cx=ox+c*(cw+g),cy=oy+r*(ch+g),k=v/макс;
    let cf=null;                                   // фактическая заливка ячейки — от неё считаем подпись
    if(s.mode==='line'){ // интенсивность штриховкой, а не заливкой
      o+=`<rect x="${cx}" y="${cy}" width="${cw}" height="${ch}" fill="none" stroke="${s.ln}" stroke-width="1"/>`;
      const n=Math.round(k*7);
      for(let i=0;i<n;i++){const dx=cx+2+i*(cw-4)/7;
        o+=`<line x1="${dx.toFixed(1)}" y1="${cy+ch-2}" x2="${(dx+ch-4).toFixed(1)}" y2="${cy+2}" stroke="${s.ac}" stroke-width="1" opacity=".85"/>`;}
    }else if(s.mode==='retro'){
      cf=v>макс*.7?s.ac:v>макс*.35?s.ac3:s.track;
      o+=`<rect x="${cx}" y="${cy}" width="${cw}" height="${ch}" fill="${cf}"/>`;
    }else if(s.mode==='brutal'){
      o+=`<rect x="${cx}" y="${cy}" width="${cw}" height="${ch}" fill="${s.hard}" fill-opacity="${(k*.9).toFixed(2)}" stroke="${s.hard}" stroke-width="2"/>`;
    }else if(s.mode==='memphis'){
      const cols=[s.ac,s.ts,s.ac3,s.pos];
      cf=cols[(r+c)%4];
      o+=`<rect x="${cx}" y="${cy}" width="${cw}" height="${ch}" rx="3" fill="${cf}" fill-opacity="${(.25+k*.7).toFixed(2)}" stroke="${s.hard}" stroke-width="1"/>`;
    }else{
      const r2=s.mode==='clay'?8:s.mode==='glass'||s.mode==='aurora'?4:3;
      cf=s.ac;
      o+=`<rect x="${cx}" y="${cy}" width="${cw}" height="${ch}" rx="${r2}" fill="${cf}" fill-opacity="${(.1+k*.85).toFixed(2)}"${s.glow&&v>макс*.7?` filter="${s.glow}"`:''}/>`;
    }
    if(v>макс*.7&&s.mode!=='line')
      o+=txt(s,cx+cw/2,cy+ch/2+4,String(v),10,700,s.mode==='brutal'?'#fff':(cf?nodeTx(s,cf):'#fff'),null).replace('<text ','<text text-anchor="middle" ');
  }));
  days.forEach((d,c)=>o+=txt(s,ox+c*(cw+g)+cw/2,oy+нr*(ch+g)+16,t(s,d),9,s.wl,s.tm,null).replace('<text ','<text text-anchor="middle" '));
  wks.forEach((k2,r)=>o+=txt(s,ox-8,oy+r*(ch+g)+ch/2+3,k2,9,s.wl,s.tm,null).replace('<text ','<text text-anchor="end" '));
  return wrapSvg(s,o);
}

// 10 ── Treemap
function elTree(s){
  const x=PAD,y=PAD,w=W-PAD*2,h=H-PAD*2;
  let o=frame(s)+surface(s,x,y,w,h);
  o+=txt(s,x+20,y+24,t(s,'Структура выручки'),12,s.wl,s.ts,s.ls);
  const ox=x+18,oy=y+38,pw=w-36,ph=h-56,g=3;
  const B=[
    {l:'Интеграция',v:'38%',x:0,y:0,w:.54,h:.58,c:s.ac},
    {l:'Лицензии',v:'24%',x:.54,y:0,w:.46,h:.58,c:s.ac3},
    {l:'Поддержка',v:'17%',x:0,y:.58,w:.36,h:.42,c:s.ac2},
    {l:'Обучение',v:'12%',x:.36,y:.58,w:.32,h:.42,c:s.pos},
    {l:'Прочее',v:'9%',x:.68,y:.58,w:.32,h:.42,c:s.track}];
  B.forEach((b,i)=>{
    const bx=ox+b.x*pw,by=oy+b.y*ph,bw=b.w*pw-g,bh=b.h*ph-g;
    const rr=s.mode==='clay'?12:s.mode==='retro'||s.mode==='brutal'?0:4;
    if(s.mode==='line'){
      o+=`<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="${rr}" fill="none" stroke="${b.c}" stroke-width="${i===0?2:1.3}"/>`;
    }else if(s.mode==='brutal'){
      o+=`<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" fill="${s.hard}" fill-opacity="${(.88-i*.18).toFixed(2)}" stroke="${s.hard}" stroke-width="2"/>`;
    }else{
      const op=s.mode==='glass'||s.mode==='aurora'?'.45':s.mode==='neon'?'.18':'1';
      o+=`<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="${rr}" fill="${b.c}" fill-opacity="${op}"${s.mode==='neon'?` stroke="${b.c}" stroke-width="1.3" filter="${s.glow}"`:''}${s.mode==='memphis'?' stroke="${s.hard}" stroke-width="1.5"':''}/>`;
    }
    const tc=nodeTx(s,b.c);
    if(bw>52){
      o+=txt(s,bx+9,by+17,t(s,b.l),9.5,s.wl,tc,null);
      o+=txt(s,bx+9,by+33,b.v,i===0?15:11,700,tc,null);}
  });
  return wrapSvg(s,o);
}

// 11 ── Scatter
function elScatter(s,дан){
  const x=PAD,y=PAD,w=W-PAD*2,h=H-PAD*2,iso=s.mode==='iso';
  let o=frame(s)+surface(s,x,y,iso?w-s.dx:w,iso?h+s.dy:h);
  const заг=строка(дан&&дан.title,'Проекты · цена и срок');
  o+=txt(s,x+20,y+24,t(s,ужать(заг,w-40,12,9)[0]),12,s.wl,s.ts,s.ls);
  const ox=x+26,oy=iso?y+46:y+38,pw=w-52-(iso?s.dx:0),ph=h-74;
  const P=ряды(дан&&дан.points,
    [[12,72,1],[24,55,0],[35,80,0],[42,38,1],[51,62,0],[58,25,0],[64,70,1],[72,44,0],[79,58,0],[86,30,1],[30,35,0],[68,86,0]],16)
    .map(п=>Array.isArray(п)?п:[Number(п.x)||0,Number(п.y)||0,п.hi?1:0]);
  o+=`<line x1="${ox}" y1="${oy+ph}" x2="${ox+pw}" y2="${oy+ph}" stroke="${s.ln}" stroke-width="${s.mode==='brutal'?3:1}"/>`;
  o+=`<line x1="${ox}" y1="${oy}" x2="${ox}" y2="${oy+ph}" stroke="${s.ln}" stroke-width="${s.mode==='brutal'?3:1}"/>`;
  const gl=s.glow?` filter="${s.glow}"`:'';
  P.forEach(([a,b,hi])=>{
    const px=+(ox+pw*a/100).toFixed(1),py=+(oy+ph-ph*b/100).toFixed(1);
    const c=hi?s.ac:s.ac3,r=hi?6:4.5;
    if(s.mode==='line')      o+=`<circle cx="${px}" cy="${py}" r="${r}" fill="none" stroke="${c}" stroke-width="1.5"/>`;
    else if(s.mode==='retro')o+=`<rect x="${px-r}" y="${py-r}" width="${r*2}" height="${r*2}" fill="${c}"/>`;
    else if(s.mode==='brutal')o+=`<circle cx="${px}" cy="${py}" r="${r}" fill="${hi?'#000':'#fff'}" stroke="${s.hard}" stroke-width="2"/>`;
    else if(iso)             o+=`<polygon points="${px},${py-r} ${px+r},${py} ${px},${py+r} ${px-r},${py}" fill="${c}"/>`;
    else if(s.mode==='memphis')o+=`<circle cx="${px}" cy="${py}" r="${r}" fill="${c}" stroke="${s.hard}" stroke-width="1.2"/>`;
    else                     o+=`<circle cx="${px}" cy="${py}" r="${r}" fill="${c}" fill-opacity="${s.mode==='neon'?.35:.85}"${s.mode==='neon'?` stroke="${c}" stroke-width="1.2"`:''}${hi?gl:''}/>`;
  });
  o+=txt(s,ox+pw,oy+ph+15,t(s,ужать(строка(дан&&дан.axis,'срок →'),pw*.6,9,7)[0]),9,s.wl,s.tm,null).replace('<text ','<text text-anchor="end" ');
  return wrapSvg(s,o);
}

// 12 ── Sparklines
function elSpark(s){
  const x=PAD,y=PAD,w=W-PAD*2,h=H-PAD*2;
  let o=frame(s)+surface(s,x,y,w,h);
  o+=txt(s,x+20,y+24,t(s,'Метрики за неделю'),12,s.wl,s.ts,s.ls);
  const D=[{l:'Выручка',d:[30,42,38,55,50,66,72],c:s.ac,v:'+18%'},
           {l:'Клиенты',d:[20,24,33,29,41,46,58],c:s.ac3,v:'+27%'},
           {l:'Отказы', d:[62,55,58,44,40,32,26],c:s.pos,v:'−41%'}];
  const lx=x+20,sx=x+96,sw2=w-172,rx=x+w-20;
  const gl=s.glow?` filter="${s.glow}"`:'';
  D.forEach((d,i)=>{
    const ty=y+48+i*36,sh=20,mn=Math.min(...d.d),mx=Math.max(...d.d);
    o+=txt(s,lx,ty+14,t(s,d.l),10.5,s.wl,s.ts,null);
    const pts=d.d.map((v,j)=>[+(sx+j*sw2/(d.d.length-1)).toFixed(1),+(ty+sh-(v-mn)/(mx-mn)*sh).toFixed(1)]);
    let path;
    if(s.mode==='retro'){path=`M ${pts[0][0]} ${pts[0][1]}`;
      for(let j=1;j<pts.length;j++)path+=` L ${pts[j][0]} ${pts[j-1][1]} L ${pts[j][0]} ${pts[j][1]}`;}
    else path='M '+pts.map(p=>p.join(' ')).join(' L ');
    o+=`<path d="${path}" fill="none" stroke="${d.c}" stroke-width="${s.mode==='brutal'?3:s.mode==='clay'?3.5:1.8}" stroke-linejoin="round" stroke-linecap="round"${gl}/>`;
    const last=pts[pts.length-1];
    if(s.mode!=='line')o+=`<circle cx="${last[0]}" cy="${last[1]}" r="3" fill="${d.c}"${gl}/>`;
    o+=txt(s,rx,ty+14,d.v,10.5,700,d.c,null).replace('<text ','<text text-anchor="end" ');
    if(i<2)o+=`<line x1="${lx}" y1="${ty+28}" x2="${rx}" y2="${ty+28}" stroke="${s.ln}" stroke-width="${s.mode==='brutal'?2:.7}"/>`;
  });
  return wrapSvg(s,o);
}

// 13 ── Bubble
function elBubble(s){
  const x=PAD,y=PAD,w=W-PAD*2,h=H-PAD*2;
  let o=frame(s)+surface(s,x,y,w,h);
  o+=txt(s,x+20,y+24,t(s,'Портфель направлений'),12,s.wl,s.ts,s.ls);
  const B=[{cx:.26,cy:.44,r:30,l:'AI',c:s.ac},{cx:.56,cy:.3,r:22,l:'Инт.',c:s.ac3},
           {cx:.78,cy:.52,r:17,l:'API',c:s.ac2},{cx:.44,cy:.72,r:24,l:'Гос',c:s.pos},
           {cx:.72,cy:.85,r:13,l:'SMB',c:s.ac3},{cx:.16,cy:.82,r:11,l:'IoT',c:s.ac2}];
  const ox=x+16,oy=y+42,pw=w-32,ph=h-58;
  const gl=s.glow?` filter="${s.glow}"`:'';
  B.forEach(b=>{
    const bx=+(ox+b.cx*pw).toFixed(1),by=+(oy+b.cy*ph).toFixed(1);
    if(s.mode==='line')       o+=`<circle cx="${bx}" cy="${by}" r="${b.r}" fill="none" stroke="${b.c}" stroke-width="1.5"/>`;
    else if(s.mode==='brutal')o+=`<circle cx="${bx}" cy="${by}" r="${b.r}" fill="${s.hard}" stroke="${s.hard}" stroke-width="3"/>`;
    else if(s.mode==='retro') o+=`<rect x="${bx-b.r}" y="${by-b.r}" width="${b.r*2}" height="${b.r*2}" fill="${b.c}" fill-opacity=".7"/>`;
    else if(s.mode==='memphis')o+=`<circle cx="${bx}" cy="${by}" r="${b.r}" fill="${b.c}" stroke="${s.hard}" stroke-width="1.5"/>`;
    else if(s.mode==='neon')  o+=`<circle cx="${bx}" cy="${by}" r="${b.r}" fill="${b.c}" fill-opacity=".14" stroke="${b.c}" stroke-width="1.3"${gl}/>`;
    else{o+=`<circle cx="${bx}" cy="${by}" r="${b.r}" fill="${b.c}" fill-opacity="${s.mode==='glass'||s.mode==='aurora'?.5:.8}"/>`;
      if(s.mode==='clay')o+=`<ellipse cx="${bx}" cy="${(by-b.r*.42).toFixed(1)}" rx="${(b.r*.5).toFixed(1)}" ry="${(b.r*.24).toFixed(1)}" fill="${s.hi}" fill-opacity=".32"/>`;}
    if(b.r>14){const tc=nodeTx(s,b.c);
      o+=txt(s,bx,by+4,t(s,b.l),b.r>24?12:10,700,tc,null).replace('<text ','<text text-anchor="middle" ');}
  });
  return wrapSvg(s,o);
}

// 14 ── Dumbbell
function elDumb(s){
  const x=PAD,y=PAD,w=W-PAD*2,h=H-PAD*2;
  let o=frame(s)+surface(s,x,y,w,h);
  o+=txt(s,x+20,y+24,t(s,'До и после внедрения'),12,s.wl,s.ts,s.ls);
  const D=[{l:'Скорость',a:24,b:81},{l:'Точность',a:52,b:94},{l:'Затраты',a:70,b:38},{l:'NPS',a:41,b:76}];
  const lx=x+20,tx=x+92,tw=w-140,gl=s.glow?` filter="${s.glow}"`:'';
  D.forEach((d,i)=>{
    const ty=y+42+i*23;
    o+=txt(s,lx,ty+4,t(s,d.l),10,s.wl,s.ts,null);
    const ax=+(tx+tw*d.a/100).toFixed(1),bx=+(tx+tw*d.b/100).toFixed(1);
    o+=`<line x1="${tx}" y1="${ty}" x2="${tx+tw}" y2="${ty}" stroke="${s.ln}" stroke-width="${s.mode==='brutal'?2:1}"/>`;
    o+=`<line x1="${ax}" y1="${ty}" x2="${bx}" y2="${ty}" stroke="${s.ac}" stroke-width="${s.mode==='brutal'?5:s.mode==='clay'?6:3}" stroke-linecap="${s.mode==='retro'||s.mode==='brutal'?'butt':'round'}" opacity="${s.mode==='line'?.4:.55}"/>`;
    const dot=(px,c,r)=>s.mode==='retro'?`<rect x="${px-r}" y="${ty-r}" width="${r*2}" height="${r*2}" fill="${c}"/>`
      :s.mode==='line'?`<circle cx="${px}" cy="${ty}" r="${r}" fill="${s.bg}" stroke="${c}" stroke-width="1.6"/>`
      :s.mode==='brutal'?`<circle cx="${px}" cy="${ty}" r="${r}" fill="${c}" stroke="${s.hard}" stroke-width="2"/>`
      :`<circle cx="${px}" cy="${ty}" r="${r}" fill="${c}"${gl}/>`;
    o+=dot(ax,s.tm,4.5)+dot(bx,s.mode==='brutal'?'#000':s.ac,6);
    o+=txt(s,x+w-20,ty+4,d.b+'%',10,700,s.ac,null).replace('<text ','<text text-anchor="end" ');
  });
  o+=txt(s,tx,y+h-18,t(s,'○ до    ● после'),9,s.wl,s.tm,null);
  return wrapSvg(s,o);
}


/* ══════ Шаги и процессы ══════ */

// 1 ── Стрелки-шаги
function elArrows(s,дан){
  const x=PAD,y=PAD,w=W-PAD*2,h=H-PAD*2,iso=s.mode==='iso';
  let o=frame(s)+surface(s,x,y,iso?w-s.dx:w,iso?h+s.dy:h);
  const заг=строка(дан&&дан.title,'Этапы внедрения');
  o+=txt(s,x+20,y+26,t(s,ужать(заг,w-40,12,9)[0]),12,s.wl,s.ts,s.ls);
  const пал=[s.ac,s.ac3,s.ac2,s.pos,s.tm];
  const шаги=ряды(дан&&дан.steps,[{n:'01',label:'Аудит'},{n:'02',label:'Пилот'},{n:'03',label:'Запуск'}],5);
  const L=шаги.map((ш,i)=>[String(ш.n==null?String(i+1).padStart(2,'0'):ш.n),String(ш.label==null?'':ш.label),пал[i%пал.length]]);
  const aw=(w-46-(iso?s.dx:0))/L.length, ah=44, ay=y+h/2-6;
  // подпись обязана уместиться в шеврон: чем больше шагов, тем мельче кегль
  const [имена,лfs]=ужатьНабор(L.map(п=>t(s,п[1])),aw-14,9.5,7);
  L.forEach(([n2,l,c],i)=>{
    const ax=x+20+i*(aw+1);
    o+=chev(s,ax,ay,aw,ah,c,i===0);
    const tc=nodeTx(s,c);
    o+=txt(s,ax+aw/2,ay+19,n2,13,800,tc,null).replace('<text ','<text text-anchor="middle" ');
    o+=txt(s,ax+aw/2,ay+34,имена[i],лfs,s.wl,tc,null).replace('<text ','<text text-anchor="middle" ');
  });
  return wrapSvg(s,o);
}

// 2 ── Воронка
function elFunnel(s,дан){
  const x=PAD,y=PAD,w=W-PAD*2,iso=s.mode==='iso';
  const пал=[s.ac,s.ac3,s.ac2,s.pos,s.tm];
  const ур=ряды(дан&&дан.levels,
    [{label:'Лиды',value:'4 200',k:1},{label:'Квалиф.',value:'1 840',k:.76},
     {label:'Оффер',value:'720',k:.52},{label:'Сделка',value:'310',k:.3}],5);
  const L=ур.map((у,i)=>[String(у.label==null?'':у.label),String(у.value==null?'':у.value),
    Math.max(.08,Math.min(1,Number(у.k)||0)),пал[i%пал.length]]);
  const top=y+38, lh=22, g=5;
  const hh=рост(top+(L.length-1)*(lh+g)+lh);        // ступеней больше четырёх — холст растёт
  const h=hh-PAD*2;
  let o=frameH(s,hh)+surface(s,x,y,iso?w-s.dx:w,iso?h+s.dy:h);
  const заг=строка(дан&&дан.title,'Путь сделки');
  o+=txt(s,x+20,y+26,t(s,ужать(заг,w-40,12,9)[0]),12,s.wl,s.ts,s.ls);
  // метки слева отдельной колонкой — так они не сходятся со значением на сужении
  const labR=x+70-(iso?s.dx:0), fw=w-92-(iso?s.dx:0), cx=x+78+fw/2-(iso?s.dx:0);
  const gl=s.glow?` filter="${s.glow}"`:'';
  const [метки,мfs]=ужатьНабор(L.map(п=>t(s,п[0])),labR-x-18,9.5,7);
  L.forEach(([l,v,k,c],i)=>{
    const bw=fw*k, by=top+i*(lh+g);
    const nk=i<L.length-1?L[i+1][2]:k*.8, nb=fw*nk;
    if(s.mode==='retro'||s.mode==='brutal'){
      o+=`<rect x="${(cx-bw/2).toFixed(1)}" y="${by}" width="${bw.toFixed(1)}" height="${lh}" fill="${c}"${s.mode==='brutal'?' stroke="${s.hard}" stroke-width="2.5"':''}/>`;
    }else if(s.mode==='clay'){
      o+=`<rect x="${(cx-bw/2).toFixed(1)}" y="${by}" width="${bw.toFixed(1)}" height="${lh}" rx="${lh/2}" fill="${c}"/>`+
         `<rect x="${(cx-bw/2+7).toFixed(1)}" y="${by+3}" width="${Math.max(bw-14,4).toFixed(1)}" height="6" rx="3" fill="${s.hi}" fill-opacity=".3"/>`;
    }else{
      const pts=`${(cx-bw/2).toFixed(1)},${by} ${(cx+bw/2).toFixed(1)},${by} ${(cx+nb/2).toFixed(1)},${by+lh} ${(cx-nb/2).toFixed(1)},${by+lh}`;
      if(s.mode==='line')        o+=`<polygon points="${pts}" fill="none" stroke="${c}" stroke-width="1.5"/>`;
      else if(s.mode==='neon')   o+=`<polygon points="${pts}" fill="${c}" fill-opacity=".15" stroke="${c}" stroke-width="1.3"${gl}/>`;
      else if(s.mode==='memphis')o+=`<polygon points="${pts}" fill="${c}" stroke="${s.hard}" stroke-width="1.4"/>`;
      else o+=`<polygon points="${pts}" fill="${c}" fill-opacity="${(s.mode==='glass'||s.mode==='aurora')?.5:1}"/>`;
    }
    o+=txt(s,labR,by+14,метки[i],мfs,s.wl,s.ts,null).replace('<text ','<text text-anchor="end" ');
    o+=txt(s,cx,by+14,ужать(v,Math.max(nb,24),11,8)[0],11,700,nodeTx(s,c),null).replace('<text ','<text text-anchor="middle" ');
  });
  return wrapSvgH(s,o,hh);
}

// 3 ── Таймлайн
function elTimeline(s,дан){
  const x=PAD,y=PAD,w=W-PAD*2,h=H-PAD*2,iso=s.mode==='iso';
  let o=frame(s)+surface(s,x,y,iso?w-s.dx:w,iso?h+s.dy:h);
  const заг=строка(дан&&дан.title,'План на год');
  o+=txt(s,x+20,y+26,t(s,ужать(заг,w-40,12,9)[0]),12,s.wl,s.ts,s.ls);
  const P=ряды(дан&&дан.points,[{period:'Q1',label:'Аудит',done:1},{period:'Q2',label:'Пилот',done:1},
      {period:'Q3',label:'Тираж',done:1},{period:'Q4',label:'Итоги',done:0}],5)
    .map(п=>[String(п.period==null?'':п.period),String(п.label==null?'':п.label),п.done?1:0]);
  const lx=x+30, lw=w-60-(iso?s.dx:0), ly=y+h/2+6, шаг=P.length>1?lw/(P.length-1):0;
  const gl=s.glow?` filter="${s.glow}"`:'';
  /* Доля пройденного считается по последней отмеченной точке.
     У образца она подобрана на глаз, поэтому без данных берётся прежняя */
  const посл=P.reduce((м,п,i)=>п[2]?i:м,-1);
  const доля=(дан&&дан.points)?(P.length>1?Math.max(0,посл)/(P.length-1):0):.66;
  const [пер]=ужатьНабор(P.map(п=>п[0]),шаг-6,11,8);
  const [подп,пfs]=ужатьНабор(P.map(п=>t(s,п[1])),шаг-6,9.5,7);
  o+=`<line x1="${lx}" y1="${ly}" x2="${lx+lw}" y2="${ly}" stroke="${s.ln}" stroke-width="${s.mode==='brutal'?3:2}"/>`;
  o+=`<line x1="${lx}" y1="${ly}" x2="${(lx+lw*доля).toFixed(1)}" y2="${ly}" stroke="${bgTx(s,s.ac)}" stroke-width="${s.mode==='brutal'?3:2}"${gl}/>`;
  P.forEach(([q,l,done],i)=>{
    const px=lx+i*шаг, c=done?s.ac:s.tm, r=done?8:6;
    if(s.mode==='retro')      o+=`<rect x="${px-r}" y="${ly-r}" width="${r*2}" height="${r*2}" fill="${c}"/>`;
    else if(s.mode==='line')  o+=`<circle cx="${px}" cy="${ly}" r="${r}" fill="${s.bg}" stroke="${done?s.ac:s.track}" stroke-width="1.6"/>`;
    else if(s.mode==='brutal')o+=`<circle cx="${px}" cy="${ly}" r="${r}" fill="${done?'#000':'#fff'}" stroke="${s.hard}" stroke-width="2.5"/>`;
    else o+=`<circle cx="${px}" cy="${ly}" r="${r}" fill="${c}"${done?gl:''}/>`;
    o+=txt(s,px,ly-18,пер[i],11,700,done?bgTx(s,s.ac):s.tm,null).replace('<text ','<text text-anchor="middle" ');
    o+=txt(s,px,ly+25,подп[i],пfs,s.wl,s.tm,null).replace('<text ','<text text-anchor="middle" ');
  });
  return wrapSvg(s,o);
}

// 4 ── Цикл PDCA
function elCycle(s,дан){
  const x=PAD,y=PAD,w=W-PAD*2,h=H-PAD*2;
  let o=frame(s)+surface(s,x,y,w,h);
  const заг=строка(дан&&дан.title,'Цикл улучшений');
  o+=txt(s,x+20,y+26,t(s,ужать(заг,w-40,12,9)[0]),12,s.wl,s.ts,s.ls);
  const cx=x+w/2,cy=y+h/2+6,R=44,SW=s.mode==='clay'?22:s.mode==='line'?2.5:17;
  const пал=[s.ac,s.ac3,s.ac2,s.pos];
  /* четвертей ровно четыре: геометрия кольца делится на четыре,
     недостающие берутся из образца, лишние отбрасываются */
  const обр=['Plan','Do','Check','Act'];
  const чет=ряды(дан&&дан.quadrants,обр.map(л=>({label:л})),4);
  const Q=обр.map((об,i)=>[String(чет[i]&&чет[i].label!=null?чет[i].label:об),пал[i]]);
  const [ярл,яfs]=ужатьНабор(Q.map(п=>t(s,п[0])),46,9.5,7);
  const C=2*Math.PI*R, seg=C/4-4, gl=s.glow?` filter="${s.glow}"`:'';
  Q.forEach(([l,c],i)=>{
    if(s.mode==='retro'){
      const a0=-Math.PI/2+i*Math.PI/2;
      for(let k=0;k<5;k++){const a=a0+k*(Math.PI/2)/5+.16;
        const px=cx+R*Math.cos(a),py=cy+R*Math.sin(a);
        o+=`<rect x="${(px-5).toFixed(1)}" y="${(py-5).toFixed(1)}" width="10" height="10" fill="${c}"/>`;}
    }else{
      o+=`<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${c}" stroke-width="${SW}" stroke-linecap="${s.mode==='clay'?'round':'butt'}" stroke-dasharray="${seg.toFixed(1)} ${(C-seg).toFixed(1)}" stroke-dashoffset="${(-i*C/4).toFixed(1)}" transform="rotate(-90 ${cx} ${cy})"${gl}/>`;
    }
    const a=-Math.PI/2+(i+.5)*Math.PI/2;
    const lo=s.mode==='line'?17:s.mode==='retro'?22:2;
    const lxp=cx+(R+lo)*Math.cos(a), lyp=cy+(R+lo)*Math.sin(a);
    const tc=nodeTx(s,c);
    o+=txt(s,lxp,lyp+3,ярл[i],яfs,700,tc,null).replace('<text ','<text text-anchor="middle" ');
  });
  const [ц,цfs]=ужать(t(s,строка(дан&&дан.center,'PDCA')),R*1.3,13,9);
  o+=txt(s,cx,cy+5,ц,цfs,s.wv,s.mode==='neon'||s.mode==='retro'?s.ac:s.tp,null).replace('<text ','<text text-anchor="middle" ');
  return wrapSvg(s,o);
}

// 5 ── Дорожная карта
function elRoadmap(s,дан){
  const x=PAD,y=PAD,w=W-PAD*2,h=H-PAD*2;
  let o=frame(s)+surface(s,x,y,w,h);
  const заг=строка(дан&&дан.title,'Дорожная карта');
  o+=txt(s,x+20,y+26,t(s,ужать(заг,w-40,12,9)[0]),12,s.wl,s.ts,s.ls);
  const пал=[s.ac,s.ac3,s.ac2,s.pos,s.tm];
  const R=ряды(дан&&дан.rows,[{label:'Исследование',start:0,len:.34},{label:'Прототип',start:.22,len:.36},
      {label:'Разработка',start:.4,len:.44},{label:'Внедрение',start:.72,len:.28}],5)
    .map((р,i)=>[String(р.label==null?'':р.label),Math.max(0,Math.min(1,Number(р.start)||0)),
      Math.max(.04,Math.min(1,Number(р.len)||0)),пал[i%пал.length]]);
  const cols=ряды(дан&&дан.cols,['Q1','Q2','Q3','Q4'],6).map(String);
  const ox=x+22,pw=w-44,top=y+48,bh=18,g=7;
  cols.forEach((q,i)=>{
    const qx=ox+pw*i/cols.length;
    o+=`<line x1="${qx.toFixed(1)}" y1="${top-6}" x2="${qx.toFixed(1)}" y2="${top+R.length*(bh+g)}" stroke="${s.ln}" stroke-width="1"${s.mode==='retro'?'':' stroke-dasharray="2 3"'}/>`;
    o+=txt(s,qx+4,top-12,ужать(q,pw/cols.length-6,9,7)[0],9,s.wl,s.tm,null);
  });
  R.forEach(([l,st,len,c],i)=>{
    const bx=ox+pw*st, bw=pw*len, by=top+i*(bh+g);
    o+=shape(s,bx,by,bw,bh,c,1);
    const tc=nodeTx(s,c);
    // подпись живёт внутри своей полосы: короткая полоса — мелкий кегль
    const [лп,лfs]=ужать(t(s,l),bw-14,9.5,6.5);
    o+=txt(s,bx+8,by+11,лп,лfs,s.wl,tc,null);
  });
  return wrapSvg(s,o);
}

// 6 ── Swimlane
function elSwim(s,дан){
  const x=PAD,y=PAD,w=W-PAD*2,h=H-PAD*2;
  let o=frame(s)+surface(s,x,y,w,h);
  const заг=строка(дан&&дан.title,'Процесс по ролям');
  o+=txt(s,x+20,y+24,t(s,ужать(заг,w-40,12,9)[0]),12,s.wl,s.ts,s.ls);
  const пал=[s.ac,s.ac3,s.ac2,s.pos];
  const L=ряды(дан&&дан.lanes,[{role:'Клиент',steps:[{col:0,label:'Заявка'}]},
      {role:'Менеджер',steps:[{col:1,label:'Оценка'},{col:3,label:'Договор'}]},
      {role:'Разработка',steps:[{col:2,label:'Анализ'},{col:4,label:'Сдача'}]}],4)
    .map((п,i)=>[String(п.role==null?'':п.role),
      (Array.isArray(п.steps)?п.steps:[]).map(ш=>[Math.max(0,Math.min(4,Number(ш.col)||0)),String(ш.label==null?'':ш.label)]),
      пал[i%пал.length]]);
  const ox=x+62,pw=w-84,top=y+40,lh=34,sw2=pw/5-6;
  // имя роли доходит до первого узла — дальше ужимается
  const [роли,рfs]=ужатьНабор(L.map(п=>t(s,п[0])),ox-x-12,9,6.5);
  L.forEach(([role,steps,c],i)=>{
    const ly=top+i*lh;
    o+=`<line x1="${x+16}" y1="${ly+lh-2}" x2="${x+w-16}" y2="${ly+lh-2}" stroke="${s.ln}" stroke-width="${s.mode==='brutal'?2:1}"/>`;
    o+=txt(s,x+16,ly+lh/2+3,роли[i],рfs,s.wl,s.ts,null);
    steps.forEach(([col,lab])=>{
      const sx=ox+col*pw/5;
      o+=node(s,sx,ly+lh/2-11,sw2,21,c,ужать(lab,sw2+4,8.5,6.5)[0],8.5);
    });
  });
  return wrapSvg(s,o);
}

// 7 ── Дерево решений
function elTree2(s){
  const x=PAD,y=PAD,w=W-PAD*2,h=H-PAD*2,iso=s.mode==='iso';
  let o=frame(s)+surface(s,x,y,iso?w-s.dx:w,iso?h+s.dy:h);
  o+=txt(s,x+20,y+24,t(s,'Логика выбора'),12,s.wl,s.ts,s.ls);
  const cx=x+w/2-(iso?s.dx/2:0);
  const nh=22, rw=74, cw=64, gw=56;
  const yR=y+30, yC=y+80, yG=y+122;          // три яруса, нижний кончается на y+148 < y+h
  const cL=cx-54, cR=cx+54;                   // дети
  const gL=cR-32, gR=cR+32;                   // внуки — строго под правым ребёнком
  o+=conn(s,cx,yR+nh,cL,yC);
  o+=conn(s,cx,yR+nh,cR,yC);
  o+=conn(s,cR,yC+nh,gL,yG);
  o+=conn(s,cR,yC+nh,gR,yG);
  o+=node(s,cx-rw/2,yR,rw,nh,s.ac,'Нужен AI?',9);
  o+=node(s,cL-cw/2,yC,cw,nh,s.tm,'Ручной',9);
  o+=node(s,cR-cw/2,yC,cw,nh,s.ac3,'Модель',9);
  o+=node(s,gL-gw/2,yG,gw,nh,s.ac2,'Своя',8.5);
  o+=node(s,gR-gw/2,yG,gw,nh,s.pos,'API',8.5);
  o+=txt(s,(cx+cL)/2-4,yC-8,t(s,'нет'),8,s.wl,s.tm,null).replace('<text ','<text text-anchor="middle" ');
  o+=txt(s,(cx+cR)/2+4,yC-8,t(s,'да'),8,s.wl,s.tm,null).replace('<text ','<text text-anchor="middle" ');
  return wrapSvg(s,o);
}

// 8 ── Бесконечный цикл
function elLoop(s,дан){
  const x=PAD,y=PAD,w=W-PAD*2,h=H-PAD*2;
  let o=frame(s)+surface(s,x,y,w,h);
  const заг=строка(дан&&дан.title,'Непрерывный цикл');
  o+=txt(s,x+20,y+24,t(s,ужать(заг,w-40,12,9)[0]),12,s.wl,s.ts,s.ls);
  const cx=x+w/2,cy=y+h/2+6,rx=86,ry=38;
  const gl=s.glow?` filter="${s.glow}"`:'';
  if(s.mode==='retro'){
    for(let i=0;i<20;i++){const a=i*2*Math.PI/20;
      o+=`<rect x="${(cx+rx*Math.cos(a)-4).toFixed(1)}" y="${(cy+ry*Math.sin(a)-4).toFixed(1)}" width="8" height="8" fill="${s.track}"/>`;}
  }else o+=`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="${s.ln}" stroke-width="${s.mode==='brutal'?3:s.mode==='clay'?6:2}"${s.mode==='line'?' stroke-dasharray="4 4"':''}/>`;
  // узлов ровно четыре: они стоят по четырём точкам эллипса
  const обрN=['Plan','Build','Run','Learn'];
  const уз=ряды(дан&&дан.nodes,обрN.map(л=>({label:л})),4);
  const N=обрN.map((об,i)=>[String(уз[i]&&уз[i].label!=null?уз[i].label:об),i]);
  const [ярлN,яfsN]=ужатьНабор(N.map(п=>t(s,п[0])),30,8.5,6);
  N.forEach(([l,i])=>{
    const a=-Math.PI/2+i*Math.PI/2;
    const px=cx+rx*Math.cos(a), py=cy+ry*Math.sin(a);
    const c=[s.ac,s.ac3,s.ac2,s.pos][i], r=17;
    if(s.mode==='retro')      o+=`<rect x="${(px-r).toFixed(1)}" y="${(py-r).toFixed(1)}" width="${r*2}" height="${r*2}" fill="${c}"/>`;
    else if(s.mode==='line')  o+=`<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${r}" fill="${s.bg}" stroke="${c}" stroke-width="1.6"/>`;
    else if(s.mode==='brutal')o+=`<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${r}" fill="${c}" stroke="${s.hard}" stroke-width="3"/>`;
    else if(s.mode==='neon')  o+=`<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${r}" fill="${c}" fill-opacity=".16" stroke="${c}" stroke-width="1.4"${gl}/>`;
    else{o+=`<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${r}" fill="${c}" fill-opacity="${(s.mode==='glass'||s.mode==='aurora')?.55:1}"/>`;
      if(s.mode==='clay')o+=`<ellipse cx="${px.toFixed(1)}" cy="${(py-6).toFixed(1)}" rx="8" ry="4" fill="${s.hi}" fill-opacity=".3"/>`;}
    const tc=(s.mode==='brutal')?'#fff':nodeTx(s,c);
    o+=txt(s,px,py+3,ярлN[i],яfsN,700,tc,null).replace('<text ','<text text-anchor="middle" ');
  });
  return wrapSvg(s,o);
}

// 9 ── Путь клиента
function elJourney(s){
  const x=PAD,y=PAD,w=W-PAD*2,h=H-PAD*2;
  let o=frame(s)+surface(s,x,y,w,h);
  o+=txt(s,x+20,y+24,t(s,'Путь клиента'),12,s.wl,s.ts,s.ls);
  const ST2=[['Узнал',3],['Изучил',4],['Пробовал',2],['Купил',4],['Советует',5]];
  const ox=x+28,pw=w-56,base=y+h-34,unit=15;
  const pts=ST2.map(([l,e],i)=>[+(ox+i*pw/4).toFixed(1),+(base-(e-1)*unit).toFixed(1)]);
  const gl=s.glow?` filter="${s.glow}"`:'';
  let d;
  if(s.mode==='retro'){d=`M ${pts[0][0]} ${pts[0][1]}`;
    for(let i=1;i<pts.length;i++)d+=` L ${pts[i][0]} ${pts[i-1][1]} L ${pts[i][0]} ${pts[i][1]}`;}
  else d='M '+pts.map(p=>p.join(' ')).join(' L ');
  o+=`<line x1="${ox}" y1="${base}" x2="${ox+pw}" y2="${base}" stroke="${s.ln}" stroke-width="1"/>`;
  o+=`<path d="${d}" fill="none" stroke="${s.ac}" stroke-width="${s.mode==='brutal'?3.5:s.mode==='clay'?4:2}" stroke-linejoin="round" stroke-linecap="round"${gl}/>`;
  pts.forEach((p,i)=>{
    const good=ST2[i][1]>=4, c=good?s.pos:ST2[i][1]<=2?s.ac2:s.ac;
    if(s.mode==='retro')     o+=`<rect x="${p[0]-5}" y="${p[1]-5}" width="10" height="10" fill="${c}"/>`;
    else if(s.mode==='line') o+=`<circle cx="${p[0]}" cy="${p[1]}" r="5" fill="${s.bg}" stroke="${c}" stroke-width="1.6"/>`;
    else o+=`<circle cx="${p[0]}" cy="${p[1]}" r="5.5" fill="${c}"${gl}/>`;
    o+=txt(s,p[0],base+15,t(s,ST2[i][0]),8.5,s.wl,s.tm,null).replace('<text ','<text text-anchor="middle" ');
  });
  return wrapSvg(s,o);
}

// 10 ── Таймлайн карточками
function elTCards(s,дан){
  const x=PAD,y=PAD,w=W-PAD*2;
  const пал=[s.ac,s.ac3,s.pos,s.ac2];
  const C=ряды(дан&&дан.cards,[{date:'Янв',text:'Старт'},{date:'Апр',text:'Пилот в 3 филиалах'},
      {date:'Сен',text:'Тираж на 40 точек'}],4)
    .map((к,i)=>[String(к.date==null?'':к.date),String(к.text==null?'':к.text),пал[i%пал.length]]);
  const lx=x+30,top=y+34,ch2=36,g=4,cw=w-72;
  const hh=рост(top+(C.length-1)*(ch2+g)+ch2-6);   // карточек больше трёх — холст растёт
  const h=hh-PAD*2;
  let o=frameH(s,hh)+surface(s,x,y,w,h);
  const заг=строка(дан&&дан.title,'Хронология проекта');
  o+=txt(s,x+20,y+24,t(s,ужать(заг,w-40,12,9)[0]),12,s.wl,s.ts,s.ls);
  const gl=s.glow?` filter="${s.glow}"`:'';
  const [тексты,тfs]=ужатьНабор(C.map(п=>t(s,п[1])),cw-22,9,7);
  o+=`<line x1="${lx}" y1="${top+6}" x2="${lx}" y2="${top+C.length*(ch2+g)-14}" stroke="${s.ln}" stroke-width="${s.mode==='brutal'?3:1.6}"/>`;
  C.forEach(([d,l,c],i)=>{
    const cy=top+i*(ch2+g);
    if(s.mode==='retro')      o+=`<rect x="${lx-6}" y="${cy+2}" width="10" height="10" fill="${c}"/>`;
    else if(s.mode==='line')  o+=`<circle cx="${lx}" cy="${cy+8}" r="5.5" fill="${s.bg}" stroke="${c}" stroke-width="1.6"/>`;
    else if(s.mode==='brutal')o+=`<circle cx="${lx}" cy="${cy+8}" r="6" fill="${c}" stroke="${s.hard}" stroke-width="2.5"/>`;
    else o+=`<circle cx="${lx}" cy="${cy+8}" r="6" fill="${c}"${gl}/>`;
    const bx=lx+16;
    if(s.mode==='line')       o+=`<rect x="${bx}" y="${cy-4}" width="${cw}" height="${ch2-2}" rx="4" fill="none" stroke="${s.ln}" stroke-width="1.2"/>`;
    else if(s.mode==='brutal')o+=`<rect x="${bx}" y="${cy-4}" width="${cw}" height="${ch2-2}" fill="#fff" stroke="${s.hard}" stroke-width="2.5"/>`;
    else if(s.mode==='retro') o+=`<rect x="${bx}" y="${cy-4}" width="${cw}" height="${ch2-2}" fill="${s.track}"/>`;
    else o+=`<rect x="${bx}" y="${cy-4}" width="${cw}" height="${ch2-2}" rx="${s.mode==='clay'?12:6}" fill="${c}" fill-opacity="${s.mode==='glass'||s.mode==='aurora'?.22:.16}"/>`;
    o+=txt(s,bx+11,cy+9,ужать(d,60,9,7)[0],9,700,bgTx(s,c),null);
    o+=txt(s,bx+11,cy+22,тексты[i],тfs,s.wl,s.mode==='brutal'?'#000':s.ts,null);
  });
  return wrapSvgH(s,o,hh);
}


/* ══════ Матрицы и пирамиды ══════ */

// 1 ── Пирамида
function elPyramid(s){
  const x=PAD,y=PAD,w=W-PAD*2,h=H-PAD*2,iso=s.mode==='iso';
  let o=frame(s)+surface(s,x,y,iso?w-s.dx:w,iso?h+s.dy:h);
  o+=txt(s,x+20,y+26,t(s,'Уровни зрелости'),12,s.wl,s.ts,s.ls);
  const cx=x+w/2-(iso?s.dx/2:0), L=[['Стратегия',s.ac],['Процессы',s.ac2],['Данные',s.ac3],['Инфраструктура',s.pos]];
  const top=y+44, lh=23, g=3, maxW=196;
  const gl=s.glow?` filter="${s.glow}"`:'';
  L.forEach(([l,c],i)=>{
    const tw=maxW*(i+1)/4.6, bw=maxW*(i+2)/4.6, by=top+i*(lh+g);
    if(s.mode==='retro'||s.mode==='brutal'){
      const mw=(tw+bw)/2;
      o+=`<rect x="${(cx-mw/2).toFixed(1)}" y="${by}" width="${mw.toFixed(1)}" height="${lh}" fill="${c}"${s.mode==='brutal'?' stroke="${s.hard}" stroke-width="2.5"':''}/>`;
    }else if(s.mode==='clay'){
      const mw=(tw+bw)/2;
      o+=`<rect x="${(cx-mw/2).toFixed(1)}" y="${by}" width="${mw.toFixed(1)}" height="${lh}" rx="${lh/2}" fill="${c}"/>`+
         `<rect x="${(cx-mw/2+8).toFixed(1)}" y="${by+3}" width="${Math.max(mw-16,4).toFixed(1)}" height="6" rx="3" fill="${s.hi}" fill-opacity=".3"/>`;
    }else if(iso){
      const d=7,e=-5, pts=`${(cx-tw/2).toFixed(1)},${by} ${(cx+tw/2).toFixed(1)},${by} ${(cx+bw/2).toFixed(1)},${by+lh} ${(cx-bw/2).toFixed(1)},${by+lh}`;
      o+=`<polygon points="${(cx-tw/2).toFixed(1)},${by} ${(cx+tw/2).toFixed(1)},${by} ${(cx+tw/2+d).toFixed(1)},${by+e} ${(cx-tw/2+d).toFixed(1)},${by+e}" fill="${c}" opacity=".72"/>`;
      o+=`<polygon points="${pts}" fill="${c}"/>`;
    }else{
      const pts=`${(cx-tw/2).toFixed(1)},${by} ${(cx+tw/2).toFixed(1)},${by} ${(cx+bw/2).toFixed(1)},${by+lh} ${(cx-bw/2).toFixed(1)},${by+lh}`;
      if(s.mode==='line')        o+=`<polygon points="${pts}" fill="none" stroke="${c}" stroke-width="1.5"/>`;
      else if(s.mode==='neon')   o+=`<polygon points="${pts}" fill="${c}" fill-opacity=".15" stroke="${c}" stroke-width="1.3"${gl}/>`;
      else if(s.mode==='memphis')o+=`<polygon points="${pts}" fill="${c}" stroke="${s.hard}" stroke-width="1.4"/>`;
      else o+=`<polygon points="${pts}" fill="${c}" fill-opacity="${(s.mode==='glass'||s.mode==='aurora')?.5:1}"/>`;
    }
    o+=txt(s,cx,by+14,t(s,l),9.5,600,nodeTx(s,c),null).replace('<text ','<text text-anchor="middle" ');
  });
  return wrapSvg(s,o);
}

// 2 ── SWOT
function elSwot(s,дан){
  const x=PAD,y=PAD,w=W-PAD*2,h=H-PAD*2;
  let o=frame(s)+surface(s,x,y,w,h);
  const заг=строка(дан&&дан.title,'SWOT-анализ');
  o+=txt(s,x+20,y+26,t(s,ужать(заг,w-40,12,9)[0]),12,s.wl,s.ts,s.ls);
  const ox=x+20,oy=y+36,qw=(w-46)/2,qh=(h-62)/2,g=6;
  // четыре квадранта в порядке S, W, O, T — места закреплены за ролями
  const обрQ=[['S','Сильные',s.ac,0,0],['W','Слабые',s.ac3,1,0],['O','Возможности',s.pos,0,1],['T','Угрозы',s.ac2,1,1]];
  const кв=ряды(дан&&дан.quadrants,обрQ.map(([л,п])=>({letter:л,label:п})),4);
  const Q=обрQ.map(([л,п,c,cxi,cyi],i)=>[
    String(кв[i]&&кв[i].letter!=null?кв[i].letter:л),
    String(кв[i]&&кв[i].label!=null?кв[i].label:п),c,cxi,cyi]);
  const [ярлQ,яfsQ]=ужатьНабор(Q.map(п=>t(s,п[1])),qw-24,9,6.5);
  const gl=s.glow?` filter="${s.glow}"`:'';
  Q.forEach(([ltr,lab,c,cxi,cyi],qi)=>{
    const qx=ox+cxi*(qw+g), qy=oy+cyi*(qh+g);
    const rr=s.mode==='clay'?16:s.mode==='retro'||s.mode==='brutal'?0:7;
    if(s.mode==='line')        o+=`<rect x="${qx.toFixed(1)}" y="${qy.toFixed(1)}" width="${qw.toFixed(1)}" height="${qh.toFixed(1)}" rx="${rr}" fill="none" stroke="${c}" stroke-width="1.5"/>`;
    else if(s.mode==='neon')   o+=`<rect x="${qx.toFixed(1)}" y="${qy.toFixed(1)}" width="${qw.toFixed(1)}" height="${qh.toFixed(1)}" rx="${rr}" fill="${c}" fill-opacity=".13" stroke="${c}" stroke-width="1.3"${gl}/>`;
    else if(s.mode==='brutal') o+=`<rect x="${(qx+4).toFixed(1)}" y="${(qy+4).toFixed(1)}" width="${qw.toFixed(1)}" height="${qh.toFixed(1)}" fill="${s.hard}"/><rect x="${qx.toFixed(1)}" y="${qy.toFixed(1)}" width="${qw.toFixed(1)}" height="${qh.toFixed(1)}" fill="#fff" stroke="${s.hard}" stroke-width="3"/>`;
    else if(s.mode==='memphis')o+=`<rect x="${qx.toFixed(1)}" y="${qy.toFixed(1)}" width="${qw.toFixed(1)}" height="${qh.toFixed(1)}" rx="${rr}" fill="${c}" fill-opacity=".9" stroke="${s.hard}" stroke-width="1.5"/>`;
    else o+=`<rect x="${qx.toFixed(1)}" y="${qy.toFixed(1)}" width="${qw.toFixed(1)}" height="${qh.toFixed(1)}" rx="${rr}" fill="${c}" fill-opacity="${(s.mode==='glass'||s.mode==='aurora')?.42:s.mode==='shadow'||s.mode==='neuro'||s.mode==='clay'?.16:.9}"/>`;
    const solid=!['line','neon','brutal','shadow','neuro','clay','glass','aurora'].includes(s.mode);
    const tc=s.mode==='brutal'?'#000':solid?nodeTx(s,c):c;
    o+=txt(s,qx+12,qy+26,ужать(ltr,qw-24,19,12)[0],19,800,tc,null);
    o+=txt(s,qx+12,qy+42,ярлQ[qi],яfsQ,s.wl,s.mode==='brutal'?'#000':solid?nodeTx(s,c):s.ts,null);
  });
  return wrapSvg(s,o);
}

// 3 ── Матрица 2×2
function elM22(s,дан){
  const x=PAD,y=PAD,w=W-PAD*2,h=H-PAD*2;
  let o=frame(s)+surface(s,x,y,w,h);
  const заг=строка(дан&&дан.title,'Приоритеты');
  o+=txt(s,x+20,y+24,t(s,ужать(заг,w-40,12,9)[0]),12,s.wl,s.ts,s.ls);
  const ox=x+46,oy=y+34,pw=w-70,ph=h-72;
  const gl=s.glow?` filter="${s.glow}"`:'';
  o+=`<line x1="${ox}" y1="${oy}" x2="${ox}" y2="${oy+ph}" stroke="${s.ln}" stroke-width="${s.mode==='brutal'?3:1.4}"/>`;
  o+=`<line x1="${ox}" y1="${oy+ph}" x2="${ox+pw}" y2="${oy+ph}" stroke="${s.ln}" stroke-width="${s.mode==='brutal'?3:1.4}"/>`;
  o+=`<line x1="${ox}" y1="${oy+ph/2}" x2="${ox+pw}" y2="${oy+ph/2}" stroke="${s.ln}" stroke-width="1"${s.mode==='retro'?'':' stroke-dasharray="3 3"'}/>`;
  o+=`<line x1="${ox+pw/2}" y1="${oy}" x2="${ox+pw/2}" y2="${oy+ph}" stroke="${s.ln}" stroke-width="1"${s.mode==='retro'?'':' stroke-dasharray="3 3"'}/>`;
  // четыре клетки закреплены за местами: порядок в данных задаёт смысл
  const обрM=[['Сделать',s.pos,0,0],['Спланировать',s.ac,1,0],['Делегировать',s.ac3,0,1],['Убрать',s.tm,1,1]];
  const квM=ряды(дан&&дан.quadrants,обрM.map(([л])=>({label:л})),4);
  const Q=обрM.map(([л,c,cxi,cyi],i)=>[String(квM[i]&&квM[i].label!=null?квM[i].label:л),c,cxi,cyi]);
  const [ярлM,яfsM]=ужатьНабор(Q.map(п=>t(s,п[0])),pw/2-24,9,6.5);
  Q.forEach(([l,c,cxi,cyi],qi)=>{
    const qcx=ox+pw/4+cxi*pw/2, qcy=oy+ph/4+cyi*ph/2;
    const bw=pw/2-16,bh=22;
    if(s.mode!=='line'&&s.mode!=='retro')
      o+=`<rect x="${(qcx-bw/2).toFixed(1)}" y="${(qcy-bh/2).toFixed(1)}" width="${bw.toFixed(1)}" height="${bh}" rx="${s.mode==='clay'?11:s.mode==='brutal'?0:5}" fill="${c}" fill-opacity="${s.mode==='neon'?.14:s.mode==='glass'||s.mode==='aurora'?.42:.85}"${s.mode==='neon'?` stroke="${c}" stroke-width="1.2"${gl}`:''}${s.mode==='brutal'?' stroke="${s.hard}" stroke-width="2"':''}/>`;
    const on=s.mode==='line'||s.mode==='retro';
    o+=txt(s,qcx,qcy+2,ярлM[qi],яfsM,600,on?c:nodeTx(s,c),null).replace('<text ','<text text-anchor="middle" ');
  });
  o+=txt(s,x+22,oy+ph/2,t(s,ужать(строка(дан&&дан.axisY,'важно'),44,8.5,6.5)[0]),8.5,s.wl,s.tm,null).replace('<text ','<text text-anchor="middle" ');
  o+=txt(s,ox+pw/2,oy+ph+16,t(s,ужать(строка(дан&&дан.axisX,'срочно →'),pw,8.5,6.5)[0]),8.5,s.wl,s.tm,null).replace('<text ','<text text-anchor="middle" ');
  return wrapSvg(s,o);
}

// 4 ── Диаграмма Венна
function elVenn(s){
  const x=PAD,y=PAD,w=W-PAD*2,h=H-PAD*2;
  let o=frame(s)+surface(s,x,y,w,h);
  o+=txt(s,x+20,y+26,t(s,'Пересечение зон'),12,s.wl,s.ts,s.ls);
  const cx=x+w/2, cy=y+h/2+12, r=50, d=32;
  const gl=s.glow?` filter="${s.glow}"`:'';
  const draw=(ccx,c)=>{
    if(s.mode==='line')       return `<circle cx="${ccx}" cy="${cy}" r="${r}" fill="none" stroke="${c}" stroke-width="1.6"/>`;
    if(s.mode==='neon')       return `<circle cx="${ccx}" cy="${cy}" r="${r}" fill="${c}" fill-opacity=".13" stroke="${c}" stroke-width="1.3"${gl}/>`;
    if(s.mode==='brutal')     return `<circle cx="${ccx}" cy="${cy}" r="${r}" fill="${c}" fill-opacity=".22" stroke="${s.hard}" stroke-width="3"/>`;
    if(s.mode==='retro')      return `<rect x="${ccx-r}" y="${cy-r}" width="${r*2}" height="${r*2}" fill="${c}" fill-opacity=".55"/>`;
    if(s.mode==='memphis')    return `<circle cx="${ccx}" cy="${cy}" r="${r}" fill="${c}" fill-opacity=".7" stroke="${s.hard}" stroke-width="1.5"/>`;
    return `<circle cx="${ccx}" cy="${cy}" r="${r}" fill="${c}" fill-opacity="${s.mode==='glass'||s.mode==='aurora'?.4:.6}"/>`;
  };
  o+=draw(cx-d,s.ac)+draw(cx+d,s.ac3);
  // контурный только line; у brutal круги полупрозрачные и светлые — подпись тёмная
  const outline=s.mode==='line', pale=s.mode==='brutal';
  const lab=c=>pale?'#000':outline?c:nodeTx(s,c);
  o+=txt(s,cx-d-16,cy+4,t(s,'Бизнес'),9.5,600,lab(s.ac),null).replace('<text ','<text text-anchor="middle" ');
  o+=txt(s,cx+d+16,cy+4,t(s,'ИТ'),9.5,600,lab(s.ac3),null).replace('<text ','<text text-anchor="middle" ');
  // в зоне пересечения сверху лежит правый круг — от него и считаем
  const ctr=pale?'#000':outline?s.tp:nodeTx(s,s.ac3);
  o+=txt(s,cx,cy-8,t(s,'Цифровая'),8.5,700,ctr,null).replace('<text ','<text text-anchor="middle" ');
  o+=txt(s,cx,cy+4,t(s,'трансформация'),8.5,700,ctr,null).replace('<text ','<text text-anchor="middle" ');
  return wrapSvg(s,o);
}

// 5 ── Таблица сравнения
function elFMatrix(s,дан){
  const x=PAD,y=PAD,w=W-PAD*2,h=H-PAD*2;
  let o=frame(s)+surface(s,x,y,w,h);
  const заг=строка(дан&&дан.title,'Сравнение решений');
  o+=txt(s,x+20,y+24,t(s,ужать(заг,w-40,12,9)[0]),12,s.wl,s.ts,s.ls);
  const F=ряды(дан&&дан.features,[{label:'Интеграция',has:[1,1,0]},{label:'AI-модуль',has:[1,0,0]},
      {label:'Поддержка 24/7',has:[1,1,1]},{label:'Казахский язык',has:[1,0,1]},{label:'White-label',has:[1,0,0]}],6)
    .map(ф=>[String(ф.label==null?'':ф.label),...[0,1,2].map(i=>(Array.isArray(ф.has)?ф.has[i]:0)?1:0)]);
  const P=ряды(дан&&дан.products,['Наше','Конк. A','Конк. B'],3).map(String);
  const lx=x+20, colW=46, cx0=x+w-20-colW*2.5, rh=19, top=y+38;
  const [шапка]=ужатьНабор(P.map(п=>t(s,п)),colW,8.5,6.5);
  const [строки,сfs]=ужатьНабор(F.map(ф=>t(s,ф[0])),cx0-lx-colW/2-8,9,6.5);
  P.forEach((p,i)=>o+=txt(s,cx0+i*colW,top,шапка[i],8.5,i===0?700:s.wl,i===0?bgTx(s,s.ac):s.tm,null).replace('<text ','<text text-anchor="middle" '));
  F.forEach((f,r)=>{
    const ry=top+14+r*rh;
    if(r%2===0&&s.mode!=='line')
      o+=`<rect x="${lx-6}" y="${ry-1}" width="${w-28}" height="${rh}" rx="3" fill="${s.tp}" fill-opacity=".05"/>`;
    if(s.mode==='line'&&r>0)
      o+=`<line x1="${lx-6}" y1="${ry-1}" x2="${x+w-20}" y2="${ry-1}" stroke="${s.ln}" stroke-width=".8"/>`;
    o+=txt(s,lx,ry+13,строки[r],сfs,s.wl,s.ts,null);
    for(let i=0;i<P.length;i++){
      const ok=f[i+1], mx=cx0+i*colW;
      if(s.mode==='retro'){
        o+=`<rect x="${mx-5}" y="${ry+3}" width="10" height="10" fill="${ok?s.pos:s.track}"/>`;
      }else{
        o+=txt(s,mx,ry+13,ok?'✓':'✕',ok?12:10,700,ok?bgTx(s,s.pos):s.tm,null).replace('<text ','<text text-anchor="middle" ');
      }
    }
  });
  return wrapSvg(s,o);
}


/* ══════ AI и нейросети ══════ */

// 1 ── Нейронная сеть
function elNet(s,дан){
  const x=PAD,y=PAD,w=W-PAD*2,h=H-PAD*2,iso=s.mode==='iso';
  let o=frame(s)+surface(s,x,y,iso?w-s.dx:w,iso?h+s.dy:h);
  const заг=строка(дан&&дан.title,'Архитектура сети');
  o+=txt(s,x+20,y+24,t(s,ужать(заг,w-40,12,9)[0]),12,s.wl,s.ts,s.ls);
  const cxs=[x+46,x+w/2-(iso?s.dx/2:0),x+w-46-(iso?s.dx:0)];
  const cols=[[48,73,98,123],[60,86,112],[73,101]];
  const cc=[s.ac3,s.ac,s.ac2];
  const gl=s.glow?` filter="${s.glow}"`:'';
  const oy=iso?10:0;
  // связи рисуем первыми, чтобы узлы легли поверх
  for(let L=0;L<2;L++)cols[L].forEach(y1=>cols[L+1].forEach(y2=>
    o+=`<line x1="${cxs[L]+9}" y1="${y1+oy}" x2="${cxs[L+1]-9}" y2="${y2+oy}" stroke="${s.ac}" stroke-width=".7" opacity="${s.mode==='line'?.28:.34}"/>`));
  cols.forEach((col,L)=>col.forEach(cy=>{
    const c=cc[L], px=cxs[L], py=cy+oy, r=9;
    if(s.mode==='retro')      o+=`<rect x="${px-r}" y="${py-r}" width="${r*2}" height="${r*2}" fill="${c}"/>`;
    else if(s.mode==='line')  o+=`<circle cx="${px}" cy="${py}" r="${r}" fill="${s.bg}" stroke="${c}" stroke-width="1.5"/>`;
    else if(s.mode==='neon')  o+=`<circle cx="${px}" cy="${py}" r="${r}" fill="${c}" fill-opacity=".18" stroke="${c}" stroke-width="1.3"${gl}/>`;
    else if(iso)              o+=`<polygon points="${px},${py-r} ${px+r},${py} ${px},${py+r} ${px-r},${py}" fill="${c}"/>`;
    else o+=`<circle cx="${px}" cy="${py}" r="${r}" fill="${c}" fill-opacity="${s.mode==='glass'||s.mode==='aurora'?.55:1}"${gl}/>`;
  }));
  // слоёв ровно три: столбцы узлов расставлены под них
  const обрL=['вход','скрытый','выход'];
  const сл=ряды(дан&&дан.layers,обрL.map(л=>({label:л})),3);
  const [ярлL,яfsL]=ужатьНабор(обрL.map((об,i)=>t(s,String(сл[i]&&сл[i].label!=null?сл[i].label:об))),84,8.5,6.5);
  ярлL.forEach((l,i)=>
    o+=txt(s,cxs[i],y+h-18,l,яfsL,s.wl,s.tm,null).replace('<text ','<text text-anchor="middle" '));
  return wrapSvg(s,o);
}

// 2 ── Блок трансформера
function elTrans(s){
  const x=PAD,y=PAD,w=W-PAD*2,h=H-PAD*2,iso=s.mode==='iso';
  let o=frame(s)+surface(s,x,y,iso?w-s.dx:w,iso?h+s.dy:h);
  o+=txt(s,x+20,y+24,t(s,'Блок трансформера'),12,s.wl,s.ts,s.ls);
  const dxo=iso?-s.dx:0;
  // слева поле под остаточные связи, справа под скобку повторов
  const bx=x+46, bw=w-46-36+dxo, bh=17, g=5, top=y+40;
  // сверху вниз: выход → norm → ffn → norm → внимание → эмбеддинг
  const R=[['Add & Norm',s.tm],['Feed Forward',s.ac2],['Add & Norm',s.tm],['Multi-Head Attention',s.ac],['Input Embedding',s.ac3]];
  const rowY=i=>top+i*(bh+g);
  const sw=s.mode==='brutal'?2.2:s.mode==='clay'?2.6:1.3;
  // остаточная связь: от входа подслоя влево, вверх и в Add & Norm над ним
  const skip=(iFrom,iTo)=>{
    const yIn=rowY(iFrom)+bh, yAN=rowY(iTo)+bh/2, lx=bx-17;
    const corner=(s.mode==='retro'||s.mode==='brutal')?0:6;
    let d;
    if(corner) d=`M ${bx} ${yIn} H ${lx+corner} Q ${lx} ${yIn} ${lx} ${yIn-corner} V ${yAN+corner} Q ${lx} ${yAN} ${lx+corner} ${yAN} H ${bx-5}`;
    else       d=`M ${bx} ${yIn} H ${lx} V ${yAN} H ${bx-5}`;
    return `<path d="${d}" fill="none" stroke="${s.ac}" stroke-width="${sw}" opacity=".65"/>`+
           `<polygon points="${bx-5},${yAN-3.2} ${bx},${yAN} ${bx-5},${yAN+3.2}" fill="${s.ac}" opacity=".8"/>`;
  };
  o+=skip(3,2)+skip(1,0);
  R.forEach(([l,c],i)=>{
    o+=node(s,bx,rowY(i),bw,bh,c,l,8.5);
    if(i<4){ // поток снизу вверх — стрелка смотрит вверх
      const my=rowY(i)+bh, cxm=bx+bw/2;
      o+=`<line x1="${cxm}" y1="${my+g}" x2="${cxm}" y2="${my+1}" stroke="${s.ln}" stroke-width="${sw}"/>`;
    }
  });
  // скобка «повторить N раз»
  const brx=bx+bw+13, y0=rowY(0)+2, y1=rowY(3)+bh-2;
  o+=`<path d="M ${brx-4} ${y0} H ${brx} V ${y1} H ${brx-4}" fill="none" stroke="${s.tm}" stroke-width="1.2"/>`;
  o+=txt(s,brx+3,(y0+y1)/2+3,'×12',9,700,s.mode==='brutal'?s.ink:bgTx(s,s.ac),null);
  return wrapSvg(s,o);
}

// 3 ── Конвейер RAG
function elRag(s,дан){
  const x=PAD,y=PAD,w=W-PAD*2,h=H-PAD*2,iso=s.mode==='iso';
  let o=frame(s)+surface(s,x,y,iso?w-s.dx:w,iso?h+s.dy:h);
  const заг=строка(дан&&дан.title,'Конвейер RAG');
  o+=txt(s,x+20,y+24,t(s,ужать(заг,w-40,12,9)[0]),12,s.wl,s.ts,s.ls);
  const rowY=y+52, bh=24, aw=(w-70-(iso?s.dx:0))/3, bx=x+24;
  const обрR=[['Запрос',s.ac3],['Поиск',s.ac],['Ответ',s.pos]];
  const шг=ряды(дан&&дан.steps,обрR.map(([л])=>({label:л})),3);
  const R=обрR.map(([л,c],i)=>[String(шг[i]&&шг[i].label!=null?шг[i].label:л),c]);
  const [ярлR,яfsR]=ужатьНабор(R.map(п=>п[0]),aw-6,9,6.5);
  R.forEach(([l,c],i)=>{
    const px=bx+i*(aw+11);
    o+=node(s,px,rowY,aw,bh,c,ярлR[i],яfsR);
    if(i<2)o+=`<line x1="${px+aw}" y1="${rowY+bh/2}" x2="${px+aw+11}" y2="${rowY+bh/2}" stroke="${s.ln}" stroke-width="1.4"/>`;
  });
  // база векторов снизу, питает шаг поиска
  const vw=aw+20, vx=bx+aw+11-10, vy=rowY+bh+22;
  const [храп,хfs]=ужать(строка(дан&&дан.store,'Векторная база'),vw-8,8.5,6.5);
  o+=node(s,vx,vy,vw,bh,s.ac2,храп,хfs);
  o+=`<line x1="${vx+vw/2}" y1="${vy}" x2="${bx+aw+11+aw/2}" y2="${rowY+bh}" stroke="${s.ln}" stroke-width="1.2"${s.mode==='retro'?'':' stroke-dasharray="3 3"'}/>`;
  o+=txt(s,x+20,y+h-18,t(s,ужать(строка(дан&&дан.note,'контекст подмешивается перед генерацией'),w-40,8,6.5)[0]),8,s.wl,s.tm,null);
  return wrapSvg(s,o);
}

// 4 ── Сравнение моделей
function elLLM(s,дан){
  const x=PAD,y=PAD,w=W-PAD*2,h=H-PAD*2;
  let o=frame(s)+surface(s,x,y,w,h);
  const заг=строка(дан&&дан.title,'Сравнение моделей');
  o+=txt(s,x+20,y+24,t(s,ужать(заг,w-40,12,9)[0]),12,s.wl,s.ts,s.ls);
  const пал=[s.ac,s.ac3,s.ac2,s.pos,s.tm];
  const M=ряды(дан&&дан.models,[{name:'Claude',params:'200B',score:96},{name:'GPT-4o',params:'~200B',score:93},
      {name:'Gemini',params:'~540B',score:89},{name:'Llama 3',params:'70B',score:82}],5)
    .map((м,i)=>[String(м.name==null?'':м.name),String(м.params==null?'':м.params),
      Math.max(0,Math.min(100,Number(м.score)||0)),пал[i%пал.length]]);
  const lx=x+20, px=x+96, pw=w-160, rh=26, top=y+42;
  const [имена,иfs]=ужатьНабор(M.map(м=>t(s,м[0])),px-lx-8,10,7);
  const [пары,пfs]=ужатьНабор(M.map(м=>м[1]),px-lx-8,8,6.5);
  M.forEach(([n2,p,v,c],i)=>{
    const ry=top+i*rh;
    o+=txt(s,lx,ry+11,имена[i],иfs,i===0?700:s.wl,i===0?bgTx(s,c):s.ts,null);
    o+=txt(s,lx,ry+22,пары[i],пfs,s.wl,s.tm,null);
    o+=track(s,px,ry+6,pw,10);
    o+=shape(s,px,ry+6,pw*v/100,10,c,1);
    o+=txt(s,x+w-20,ry+15,String(v),10,700,bgTx(s,c),null).replace('<text ','<text text-anchor="end" ');
  });
  return wrapSvg(s,o);
}

// 5 ── Векторное пространство
function elVec(s){
  const x=PAD,y=PAD,w=W-PAD*2,h=H-PAD*2,iso=s.mode==='iso';
  let o=frame(s)+surface(s,x,y,iso?w-s.dx:w,iso?h+s.dy:h);
  o+=txt(s,x+20,y+24,t(s,'Поиск ближайших'),12,s.wl,s.ts,s.ls);
  const gl=s.glow?` filter="${s.glow}"`:'';
  const dx=iso?-s.dx/2:0;
  // три плотных кластера, координаты заданы явно — формула давала россыпь
  const CL=[
    {cx:x+72+dx, cy:y+70, c:s.ac3, p:[[-14,-8],[-3,6],[9,-13],[15,5],[-10,15],[3,-1]]},
    {cx:x+w-64+dx, cy:y+64, c:s.ac2, p:[[-13,-6],[2,-15],[13,3],[-6,11],[9,13],[-17,5]]},
    {cx:x+w/2+dx, cy:y+h-64, c:s.pos, p:[[-17,-5],[-3,-13],[11,-7],[17,7],[-9,9],[2,3]]}
  ];
  const Q={cx:x+w/2+dx, cy:y+h-66}, R=27;
  // радиус поиска — под точками, чтобы не перекрывал их
  o+=`<circle cx="${Q.cx.toFixed(1)}" cy="${Q.cy.toFixed(1)}" r="${R}" fill="${s.ac}" fill-opacity="${s.mode==='line'?0:.1}" stroke="${bgTx(s,s.ac)}" stroke-width="1.2" opacity=".65"${s.mode==='retro'?'':' stroke-dasharray="4 3"'}/>`;
  CL.forEach(cl=>cl.p.forEach(([ox2,oy2])=>{
    const px=cl.cx+ox2, py=cl.cy+oy2;
    const near=Math.hypot(px-Q.cx,py-Q.cy)<R;      // попал в радиус — подсвечиваем
    const r=near?4.5:3.4, c=cl.c;
    const X=px.toFixed(1),Y=py.toFixed(1);
    if(s.mode==='retro')     o+=`<rect x="${(px-r).toFixed(1)}" y="${(py-r).toFixed(1)}" width="${(r*2).toFixed(1)}" height="${(r*2).toFixed(1)}" fill="${c}"${near?'':' fill-opacity=".55"'}/>`;
    else if(s.mode==='line') o+=`<circle cx="${X}" cy="${Y}" r="${r}" fill="${near?c:'none'}" stroke="${c}" stroke-width="1.2"/>`;
    else if(iso)             o+=`<polygon points="${X},${(py-r).toFixed(1)} ${(px+r).toFixed(1)},${Y} ${X},${(py+r).toFixed(1)} ${(px-r).toFixed(1)},${Y}" fill="${c}"${near?'':' fill-opacity=".55"'}/>`;
    else o+=`<circle cx="${X}" cy="${Y}" r="${r}" fill="${c}" fill-opacity="${near?(s.mode==='glass'||s.mode==='aurora'?.85:1):.45}"${near?gl:''}/>`;
  }));
  if(s.mode==='retro')o+=`<rect x="${(Q.cx-5).toFixed(1)}" y="${(Q.cy-5).toFixed(1)}" width="10" height="10" fill="${s.ac}"/>`;
  else o+=`<circle cx="${Q.cx.toFixed(1)}" cy="${Q.cy.toFixed(1)}" r="5.5" fill="${s.ac}" stroke="${s.mode==='line'?s.ac:'none'}" stroke-width="1.4"${gl}/>`;
  o+=txt(s,Q.cx,Q.cy-R-8,t(s,'запрос'),8.5,600,bgTx(s,s.ac),null).replace('<text ','<text text-anchor="middle" ');
  o+=txt(s,x+20,y+h-18,t(s,'подсвечены соседи в радиусе'),8,s.wl,s.tm,null);
  return wrapSvg(s,o);
}


/* ══════ Архитектура и интеграции ══════ */

// 1 ── Микросервисы
function elMicro(s,дан){
  const x=PAD,y=PAD,w=W-PAD*2,h=H-PAD*2;
  let o=frame(s)+surface(s,x,y,w,h);
  const заг=строка(дан&&дан.title,'Микросервисы');
  o+=txt(s,x+20,y+24,t(s,ужать(заг,w-40,12,9)[0]),12,s.wl,s.ts,s.ls);
  const gw=110, gx=x+w/2-gw/2, gy=y+32, bh=21;
  const обрS=[['Auth',s.ac3],['Users',s.ac2],['Orders',s.pos]];
  const срв=ряды(дан&&дан.services,обрS.map(([л])=>({label:л})),3);
  const S=обрS.map(([л,c],i)=>[String(срв[i]&&срв[i].label!=null?срв[i].label:л),c]);
  const sw2=(w-52)/S.length-6, sy=gy+38;
  const [ярлS,яfsS]=ужатьНабор(S.map(п=>п[0]),sw2-6,8.5,6.5);
  const dy=sy+36;
  S.forEach((_,i)=>{const sx=x+26+i*(sw2+9);
    o+=conn(s,gx+gw/2,gy+bh,sx+sw2/2,sy);});
  const [шлз,шfs]=ужать(строка(дан&&дан.gateway,'API Gateway'),gw-10,9,7);
  o+=node(s,gx,gy,gw,bh,s.ac,шлз,шfs);
  S.forEach(([l,c],i)=>{
    const sx=x+26+i*(sw2+9);
    o+=node(s,sx,sy,sw2,bh,c,ярлS[i],яfsS);
    o+=`<line x1="${sx+sw2/2}" y1="${sy+bh}" x2="${sx+sw2/2}" y2="${dy}" stroke="${s.ln}" stroke-width="1.2"/>`;
    // цилиндр базы. У верхнего эллипса видны обе дуги — полость начинается от задней,
    // то есть от dy+9.5, а не от верха фигуры. Подпись центрируем по полости.
    const rx=(sw2-16)/2, cxm=sx+sw2/2, sc=s.tm;
    if(s.mode==='retro'||s.mode==='brutal'){
      o+=`<rect x="${sx+8}" y="${dy+1}" width="${sw2-16}" height="30" fill="none" stroke="${sc}" stroke-width="${s.mode==='brutal'?2.5:1.6}"/>`;
      o+=txt(s,cxm,dy+17,t(s,'БД'),8,600,s.ts,null).replace('<text ','<text text-anchor="middle" ');
    }else{
      o+=`<ellipse cx="${cxm}" cy="${dy+5}" rx="${rx}" ry="4.5" fill="none" stroke="${sc}" stroke-width="1.5"/>`;
      o+=`<path d="M ${sx+8} ${dy+5} V ${dy+28} A ${rx} 4.5 0 0 0 ${sx+sw2-8} ${dy+28} V ${dy+5}" fill="none" stroke="${sc}" stroke-width="1.5"/>`;
      o+=txt(s,cxm,dy+25,t(s,'БД'),8,600,s.ts,null).replace('<text ','<text text-anchor="middle" ');
    }
  });
  return wrapSvg(s,o);
}

// 2 ── Конвейер CI/CD
function elCicd(s,дан){
  const x=PAD,y=PAD,w=W-PAD*2,h=H-PAD*2;
  let o=frame(s)+surface(s,x,y,w,h);
  const заг=строка(дан&&дан.title,'Конвейер поставки');
  o+=txt(s,x+20,y+24,t(s,ужать(заг,w-40,12,9)[0]),12,s.wl,s.ts,s.ls);
  const пал=[s.ac3,s.ac,s.ac2,s.pos,s.tm];
  const P=ряды(дан&&дан.stages,[{label:'Код',done:1},{label:'Сборка',done:1},{label:'Тесты',done:1},
      {label:'Деплой',done:0},{label:'Монитор',done:0}],5)
    .map((э,i)=>[String(э.label==null?'':э.label),пал[i%пал.length],э.done?1:0]);
  const bw=(w-52)/P.length-5, top=y+52, bh=40;
  const [ярлP,яfsP]=ужатьНабор(P.map(п=>t(s,п[0])),bw-4,7.5,6);
  P.forEach(([l,c,done],i)=>{
    const px=x+26+i*(bw+5);
    o+=node(s,px,top,bw,bh,c,null);
    const tc=onNode(s,c);
    o+=txt(s,px+bw/2,top+17,done?'✓':'○',12,700,tc,null).replace('<text ','<text text-anchor="middle" ');
    o+=txt(s,px+bw/2,top+31,ярлP[i],яfsP,600,tc,null).replace('<text ','<text text-anchor="middle" ');
    if(i<P.length-1)o+=`<line x1="${px+bw}" y1="${top+bh/2}" x2="${px+bw+5}" y2="${top+bh/2}" stroke="${s.ln}" stroke-width="1.3"/>`;
  });
  // полоса прохождения под конвейером
  const py=top+bh+16, pw=w-52;
  const прог=Math.max(0,Math.min(1,дан&&дан.progress!=null?Number(дан.progress):0.6));
  o+=track(s,x+26,py,pw,7);
  o+=shape(s,x+26,py,pw*прог,7,s.pos,1);
  const прим=строка(дан&&дан.note,'3 из 5 этапов пройдено');
  o+=txt(s,x+26,py+24,t(s,ужать(прим,pw,8.5,7)[0]),8.5,s.wl,s.tm,null);
  return wrapSvg(s,o);
}

// 3 ── Межведомственная интеграция
function elEgov(s,дан){
  const x=PAD,y=PAD,w=W-PAD*2,h=H-PAD*2;
  let o=frame(s)+surface(s,x,y,w,h);
  const заг=строка(дан&&дан.title,'Межведомственный шлюз');
  o+=txt(s,x+20,y+24,t(s,ужать(заг,w-40,12,9)[0]),12,s.wl,s.ts,s.ls);
  const cw=88, cx=x+w/2, top=y+34, bh=19;
  const [акт,аfs]=ужать(строка(дан&&дан.actor,'Гражданин'),cw-8,8.5,6.5);
  o+=node(s,cx-cw/2,top,cw,bh,s.ac3,акт,аfs);
  o+=`<line x1="${cx}" y1="${top+bh}" x2="${cx}" y2="${top+bh+12}" stroke="${s.ln}" stroke-width="1.4"/>`;
  const hy=top+bh+12;
  const [шлюз,шfs]=ужать(строка(дан&&дан.hub,'Шлюз ШЭП'),w-70,9,7);
  o+=node(s,x+30,hy,w-60,bh,s.ac,шлюз,шfs);
  const обрM=[['МВД',s.ac2],['МЗ',s.pos],['МФ',s.ac2],['МОН',s.pos]];
  const вед=ряды(дан&&дан.agencies,обрM.map(([л])=>({label:л})),4);
  const M=вед.map((в,i)=>[String(в.label==null?(обрM[i]?обрM[i][0]:''):в.label),[s.ac2,s.pos][i%2]]);
  const mw=(w-52)/M.length-6, my=hy+bh+18;
  const [ярлM2,яfsM2]=ужатьНабор(M.map(п=>п[0]),mw-6,8.5,6.5);
  o+=`<line x1="${x+30+mw/2}" y1="${hy+bh+10}" x2="${x+w-30-mw/2}" y2="${hy+bh+10}" stroke="${s.ln}" stroke-width="1.2"/>`;
  M.forEach(([l,c],i)=>{
    const mx=x+26+i*(mw+6);
    o+=`<line x1="${mx+mw/2}" y1="${hy+bh}" x2="${mx+mw/2}" y2="${my}" stroke="${s.ln}" stroke-width="1.2"/>`;
    o+=node(s,mx,my,mw,bh,c,ярлM2[i],яfsM2);
  });
  const прим=строка(дан&&дан.note,'запрос идёт через шлюз, ведомства не связаны напрямую');
  o+=txt(s,x+20,y+h-18,t(s,ужать(прим,w-40,7.5,6.5)[0]),7.5,s.wl,s.tm,null);
  return wrapSvg(s,o);
}

// 4 ── Событийная шина
function elBus(s,дан){
  const x=PAD,y=PAD,w=W-PAD*2,h=H-PAD*2;
  let o=frame(s)+surface(s,x,y,w,h);
  const заг=строка(дан&&дан.title,'Событийная шина');
  o+=txt(s,x+20,y+24,t(s,ужать(заг,w-40,12,9)[0]),12,s.wl,s.ts,s.ls);
  const bw=(w-52)/3-8, byTop=y+42, byBot=y+h-58, bh=20;
  const busY=y+h/2+2, busH=s.mode==='clay'?18:14;
  // источников и подписчиков по три: под них расчерчены обе полки
  const обрPR=[['Заказы',s.ac3],['Платежи',s.ac2],['Склад',s.pos]];
  const обрCO=[['Аналитика',s.ac2],['Уведомл.',s.ac3],['Архив',s.pos]];
  const свести=(пришло,обр)=>{const д=ряды(пришло,обр.map(([л])=>({label:л})),3);
    return обр.map(([л,c],i)=>[String(д[i]&&д[i].label!=null?д[i].label:л),c]);};
  const PR=свести(дан&&дан.producers,обрPR), CO=свести(дан&&дан.consumers,обрCO);
  const [ярлPR,яfsPR]=ужатьНабор(PR.map(п=>п[0]),bw-6,8,6);
  const [ярлCO,яfsCO]=ужатьНабор(CO.map(п=>п[0]),bw-6,8,6);
  PR.forEach((_,i)=>{const px=x+26+i*(bw+12);
    o+=`<line x1="${px+bw/2}" y1="${byTop+bh}" x2="${px+bw/2}" y2="${busY}" stroke="${s.ln}" stroke-width="1.2"/>`;});
  CO.forEach((_,i)=>{const px=x+26+i*(bw+12);
    o+=`<line x1="${px+bw/2}" y1="${busY+busH}" x2="${px+bw/2}" y2="${byBot}" stroke="${s.ln}" stroke-width="1.2"/>`;});
  const [шина,шfs]=ужать(строка(дан&&дан.bus,'Kafka'),w-70,9,7);
  o+=node(s,x+26,busY,w-52,busH,s.ac,шина,шfs);
  PR.forEach(([l,c],i)=>o+=node(s,x+26+i*(bw+12),byTop,bw,bh,c,ярлPR[i],яfsPR));
  CO.forEach(([l,c],i)=>o+=node(s,x+26+i*(bw+12),byBot,bw,bh,c,ярлCO[i],яfsCO));
  o+=txt(s,x+20,byTop-9,t(s,'источники'),7.5,s.wl,s.tm,null);
  o+=txt(s,x+20,byBot+bh+19,t(s,'подписчики'),7.5,s.wl,s.tm,null);
  return wrapSvg(s,o);
}

// 5 ── Слои системы
function elLayers(s,дан){
  const x=PAD,y=PAD,w=W-PAD*2,h=H-PAD*2;
  let o=frame(s)+surface(s,x,y,w,h);
  const заг=строка(дан&&дан.title,'Слои системы');
  o+=txt(s,x+20,y+22,t(s,ужать(заг,w-40,12,9)[0]),12,s.wl,s.ts,s.ls);
  const пал=[s.ac3,s.ac,s.ac2,s.pos,s.tm];
  const L=ряды(дан&&дан.layers,[{label:'Интерфейс',tech:'React · мобильный клиент'},
      {label:'Прикладной',tech:'REST · GraphQL'},{label:'Домен',tech:'бизнес-правила'},
      {label:'Данные',tech:'PostgreSQL · S3'}],5)
    .map((сл,i)=>[String(сл.label==null?'':сл.label),String(сл.tech==null?'':сл.tech),пал[i%пал.length]]);
  const bx=x+26, bw=w-52, bh=21, g=4, top=y+30;
  // имя слоя и стек делят одну полосу: сперва ужимается стек, он второстепенный
  const [имена,иfs]=ужатьНабор(L.map(п=>t(s,п[0])),bw*.45,9.5,7);
  const [стеки,сfs]=ужатьНабор(L.map(п=>t(s,п[1])),bw*.52,8,6);
  L.forEach(([l,sub,c],i)=>{
    const by=top+i*(bh+g);
    o+=node(s,bx,by,bw,bh,c,null);
    const tc=onNode(s,c);
    o+=txt(s,bx+12,by+13,имена[i],иfs,700,tc,null);
    o+=txt(s,bx+bw-12,by+13,стеки[i],сfs,s.wl,tc,null).replace('<text ','<text text-anchor="end" ');
  });
  const прим=строка(дан&&дан.note,'обращение только к соседнему слою');
  o+=txt(s,x+26,y+h-18,t(s,ужать(прим,bw,7.5,6.5)[0]),7.5,s.wl,s.tm,null);
  return wrapSvg(s,o);
}


/* ══════ Числа и инфографика ══════ */

// 1 ── Большое число
function elBigNum(s){
  const x=PAD,y=PAD,w=W-PAD*2,h=H-PAD*2;
  let o=frame(s)+surface(s,x,y,w,h);
  const cx=x+w/2;
  o+=txt(s,cx,y+34,t(s,'удовлетворённость'),9.5,s.wl,s.tm,2.2).replace('<text ','<text text-anchor="middle" ');
  o+=txt(s,cx,y+88,'87%',52,s.wv,s.mode==='neon'||s.mode==='retro'?s.ac:s.tp,-2).replace('<text ','<text text-anchor="middle" ');
  o+=`<line x1="${cx-34}" y1="${y+100}" x2="${cx+34}" y2="${y+100}" stroke="${s.ac}" stroke-width="${s.mode==='brutal'?3:2}"/>`;
  o+=txt(s,cx,y+120,t(s,'клиентов рекомендуют'),11,s.wl,s.ts,null).replace('<text ','<text text-anchor="middle" ');
  o+=txt(s,cx,y+140,t(s,'▲ 12 пунктов за год'),9.5,600,bgTx(s,s.pos),null).replace('<text ','<text text-anchor="middle" ');
  return wrapSvg(s,o);
}

// 2 ── Три факта
function elFacts(s,дан){
  const x=PAD,y=PAD,w=W-PAD*2,h=H-PAD*2;
  let o=frame(s)+surface(s,x,y,w,h);
  const заг=строка(дан&&дан.title,'Проект в цифрах');
  o+=txt(s,x+20,y+26,t(s,ужать(заг,w-40,12,9)[0]),12,s.wl,s.ts,s.ls);
  const пал=[s.ac,s.ac3,s.pos,s.ac2];
  const F=ряды(дан&&дан.facts,[{value:'₸497M',label:'бюджет'},{value:'31',label:'специалист'},
      {value:'5 мес',label:'срок'}],4)
    .map((ф,i)=>[String(ф.value==null?'':ф.value),String(ф.label==null?'':ф.label),пал[i%пал.length]]);
  const cw=(w-40)/F.length, top=y+42, bh=94;
  const [подписи,пfs]=ужатьНабор(F.map(ф=>t(s,ф[1])),cw-16,9,6.5);
  F.forEach(([v,l,c],i)=>{
    const bx=x+20+i*cw, bw=cw-8;
    o+=node(s,bx,top,bw,bh,c,null);
    const tc=onNode(s,c);
    // крупное число само выбирает кегль по своей длине, затем ужимается под колонку
    const [зн,зfs]=ужать(v,bw-10,v.length>4?17:24,11);
    o+=txt(s,bx+bw/2,top+42,зн,зfs,s.wv,tc,-.5).replace('<text ','<text text-anchor="middle" ');
    o+=`<line x1="${bx+bw/2-16}" y1="${top+54}" x2="${bx+bw/2+16}" y2="${top+54}" stroke="${tc}" stroke-width="1" opacity=".4"/>`;
    o+=txt(s,bx+bw/2,top+72,подписи[i],пfs,s.wl,tc,null).replace('<text ','<text text-anchor="middle" ');
  });
  return wrapSvg(s,o);
}

// 3 ── Карточка показателя с трендом
function elStatCard(s){
  const x=PAD,y=PAD,w=W-PAD*2,h=H-PAD*2;
  let o=frame(s)+surface(s,x,y,w,h);
  const lx=x+24;
  o+=txt(s,lx,y+34,t(s,'выручка за квартал'),9.5,s.wl,s.tm,1.8);
  o+=txt(s,lx,y+80,'₸2.4B',38,s.wv,s.mode==='neon'||s.mode==='retro'?s.ac:s.tp,-1.2);
  // спарклайн справа от числа
  const sx=x+w-24-96, sy=y+58, sw2=96, sh=26;
  const D=[30,44,38,56,50,68,76], mn=30, mx=76;
  const pts=D.map((v,i)=>[+(sx+i*sw2/6).toFixed(1),+(sy+sh-(v-mn)/(mx-mn)*sh).toFixed(1)]);
  const gl=s.glow?` filter="${s.glow}"`:'';
  let d;
  if(s.mode==='retro'){d=`M ${pts[0][0]} ${pts[0][1]}`;
    for(let i=1;i<pts.length;i++)d+=` L ${pts[i][0]} ${pts[i-1][1]} L ${pts[i][0]} ${pts[i][1]}`;}
  else d='M '+pts.map(p=>p.join(' ')).join(' L ');
  o+=`<path d="${d}" fill="none" stroke="${s.pos}" stroke-width="${s.mode==='brutal'?3:2}" stroke-linejoin="round" stroke-linecap="round"${gl}/>`;
  if(s.mode!=='line')o+=`<circle cx="${pts[6][0]}" cy="${pts[6][1]}" r="3.2" fill="${s.pos}"${gl}/>`;
  o+=txt(s,lx,y+112,t(s,'▲ 23% к прошлому кварталу'),10,600,bgTx(s,s.pos),null);
  o+=`<line x1="${lx}" y1="${y+124}" x2="${x+w-24}" y2="${y+124}" stroke="${s.ln}" stroke-width="1"/>`;
  o+=txt(s,lx,y+144,t(s,'план на год выполнен на 62%'),9,s.wl,s.tm,null);
  return wrapSvg(s,o);
}

// 4 ── Кольцо прогресса
function elRing(s){
  const x=PAD,y=PAD,w=W-PAD*2,h=H-PAD*2;
  let o=frame(s)+surface(s,x,y,w,h);
  o+=txt(s,x+20,y+26,t(s,'Готовность этапа'),12,s.wl,s.ts,s.ls);
  const cx=x+72, cy=y+h/2+12, R=40, V=74;
  const SW=s.mode==='clay'?16:s.mode==='line'?2.5:12;
  const C=2*Math.PI*R, gl=s.glow?` filter="${s.glow}"`:'';
  if(s.mode==='retro'){
    const N=18;
    for(let i=0;i<N;i++){const a=-Math.PI/2+i*2*Math.PI/N;
      const px=cx+R*Math.cos(a), py=cy+R*Math.sin(a);
      o+=`<rect x="${(px-5).toFixed(1)}" y="${(py-5).toFixed(1)}" width="10" height="10" fill="${i/N<V/100?s.ac:s.track}"/>`;}
  }else{
    o+=`<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${s.track}" stroke-width="${SW}"/>`;
    o+=`<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${s.ac}" stroke-width="${SW}" stroke-linecap="${s.mode==='clay'?'round':'butt'}" stroke-dasharray="${(C*V/100).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 ${cx} ${cy})"${gl}/>`;
  }
  o+=txt(s,cx,cy+7,V+'%',22,s.wv,s.mode==='neon'||s.mode==='retro'?s.ac:s.tp,-.5).replace('<text ','<text text-anchor="middle" ');
  const lx=cx+R+26;
  [['Готово','18 задач',s.pos],['В работе','5 задач',s.ac],['Не начато','2 задачи',s.tm]].forEach(([l,v,c],i)=>{
    const ly=cy-26+i*26;
    o+=`<rect x="${lx}" y="${ly-7}" width="9" height="9" rx="${s.mode==='clay'?4.5:s.mode==='retro'||s.mode==='brutal'?0:2}" fill="${c}"/>`;
    o+=txt(s,lx+15,ly,t(s,l),9.5,600,s.ts,null);
    o+=txt(s,lx+15,ly+11,t(s,v),8.5,s.wl,s.tm,null);
  });
  return wrapSvg(s,o);
}

// 5 ── Четыре преимущества
function elIcons(s,дан){
  const x=PAD,y=PAD,w=W-PAD*2,h=H-PAD*2;
  let o=frame(s)+surface(s,x,y,w,h);
  const заг=строка(дан&&дан.title,'Что даёт внедрение');
  o+=txt(s,x+20,y+26,t(s,ужать(заг,w-40,12,9)[0]),12,s.wl,s.ts,s.ls);
  const пал=[s.ac,s.ac3,s.ac2,s.pos];
  const I=ряды(дан&&дан.items,[{value:'×10',label:'скорость'},{value:'98%',label:'точность'},
      {value:'₸40M',label:'экономия'},{value:'−80%',label:'время'}],4)
    .map((э,i)=>[String(э.value==null?'':э.value),String(э.label==null?'':э.label),пал[i%пал.length]]);
  const cw=(w-40)/I.length, top=y+44;
  const [подписи,пfs]=ужатьНабор(I.map(э=>t(s,э[1])),cw-10,9,6.5);
  I.forEach(([v,l,c],i)=>{
    const bx=x+20+i*cw, bw=cw-8, ccx=bx+bw/2;
    // знак-плашка вместо иконки: форма зависит от стиля
    const r=17;
    if(s.mode==='retro')      o+=`<rect x="${ccx-r}" y="${top}" width="${r*2}" height="${r*2}" fill="${c}"/>`;
    else if(s.mode==='line')  o+=`<circle cx="${ccx}" cy="${top+r}" r="${r}" fill="none" stroke="${c}" stroke-width="1.6"/>`;
    else if(s.mode==='brutal')o+=`<rect x="${ccx-r+3}" y="${top+3}" width="${r*2}" height="${r*2}" fill="${s.hard}"/><rect x="${ccx-r}" y="${top}" width="${r*2}" height="${r*2}" fill="#fff" stroke="${s.hard}" stroke-width="3"/>`;
    else if(s.mode==='neon')  o+=`<circle cx="${ccx}" cy="${top+r}" r="${r}" fill="${c}" fill-opacity=".16" stroke="${c}" stroke-width="1.4"${s.glow?` filter="${s.glow}"`:''}/>`;
    else{o+=`<circle cx="${ccx}" cy="${top+r}" r="${r}" fill="${c}" fill-opacity="${s.mode==='glass'||s.mode==='aurora'?.5:1}"/>`;
      if(s.mode==='clay')o+=`<ellipse cx="${ccx}" cy="${top+r-6}" rx="8" ry="4" fill="${s.hi}" fill-opacity=".3"/>`;}
    const tc=(s.mode==='line'||s.mode==='neon')?c:s.mode==='brutal'?'#000':nodeTx(s,c);
    o+=txt(s,ccx,top+r+4,ужать(v,r*1.85,11,8)[0],11,700,tc,null).replace('<text ','<text text-anchor="middle" ');
    o+=txt(s,ccx,top+r*2+20,подписи[i],пfs,s.wl,s.ts,null).replace('<text ','<text text-anchor="middle" ');
  });
  o+=`<line x1="${x+20}" y1="${y+h-30}" x2="${x+w-20}" y2="${y+h-30}" stroke="${s.ln}" stroke-width="1"/>`;
  const прим=строка(дан&&дан.note,'по данным пилота на 3 площадках');
  o+=txt(s,x+20,y+h-18,t(s,ужать(прим,w-40,8.5,7)[0]),8.5,s.wl,s.tm,null);
  return wrapSvg(s,o);
}

// 6 ── Цитата с цифрами
function elQuote(s,дан){
  const x=PAD,y=PAD,w=W-PAD*2,h=H-PAD*2;
  let o=frame(s)+surface(s,x,y,w,h);
  const lx=x+22, qc=s.mode==='brutal'?s.ink:s.ac;
  o+=txt(s,lx,y+44,'«',40,700,bgTx(s,qc),null);
  // цитата в одну-две строки, ширина ограничена кавычкой слева
  const цит=ряды(дан&&дан.quote,['Обработка документов','ускорилась в десять раз.'],2).map(String);
  const [строкиЦ,цfs]=ужатьНабор(цит.map(с=>t(s,с)),x+w-22-(lx+24),11.5,8.5);
  строкиЦ.forEach((с,i)=>o+=txt(s,lx+24,y+34+i*16,с,цfs,s.wl,s.tp,null));
  const авт=строка(дан&&дан.author,'Асель Сейтова · CIO');
  o+=txt(s,lx+24,y+70,t(s,ужать(авт,x+w-22-(lx+24),9,7)[0]),9,s.wl,s.tm,null);
  o+=`<line x1="${lx}" y1="${y+86}" x2="${x+w-22}" y2="${y+86}" stroke="${s.ln}" stroke-width="1"/>`;
  const палЦ=[s.ac,s.ac3,s.pos];
  const S=ряды(дан&&дан.stats,[{value:'×10',label:'быстрее'},{value:'98%',label:'точность'},
      {value:'₸40M',label:'в год'}],3)
    .map((э,i)=>[String(э.value==null?'':э.value),String(э.label==null?'':э.label),палЦ[i%3]]);
  const cw=(w-44)/S.length;
  const [подписиЦ,пfsЦ]=ужатьНабор(S.map(э=>t(s,э[1])),cw-8,8.5,6.5);
  S.forEach(([v,l,c],i)=>{
    const ccx=lx+cw*i+cw/2-4;
    o+=txt(s,ccx,y+118,ужать(v,cw-8,20,13)[0],20,s.wv,s.mode==='brutal'?s.ink:bgTx(s,c),-.5).replace('<text ','<text text-anchor="middle" ');
    o+=txt(s,ccx,y+136,подписиЦ[i],пfsЦ,s.wl,s.tm,null).replace('<text ','<text text-anchor="middle" ');
  });
  return wrapSvg(s,o);
}

// 7 ── До и после
function elBefore(s,дан){
  const x=PAD,y=PAD,w=W-PAD*2,h=H-PAD*2;
  let o=frame(s)+surface(s,x,y,w,h);
  const заг=строка(дан&&дан.title,'Что изменилось');
  o+=txt(s,x+20,y+26,t(s,ужать(заг,w-40,12,9)[0]),12,s.wl,s.ts,s.ls);
  // ритм считан от блока: 13px сверху, 15.6 снизу, шаг строк 18
  const cw=(w-64)/2, top=y+36, bh=86, hdr=top+20, r0=top+38, rs=16;
  const было=ряды(дан&&дан.before,['3 дня','10 ошибок','вручную'],3).map(String);
  const стало=ряды(дан&&дан.after,['4 минуты','0 ошибок','автоматом'],3).map(String);
  const cols=[['было',s.tm,было,0],['стало',s.ac,стало,1]];
  // обе колонки берут единый кегль: разный размер читался бы как разная важность
  const [,сfs]=ужатьНабор([...было,...стало].map(в=>t(s,в)),cw-12,11,7.5);
  cols.forEach(([hd,c,rows,hi])=>{
    const bx=x+20+hi*(cw+24);
    o+=node(s,bx,top,cw,bh,c,null);
    const tc=onNode(s, hi?c:s.tm);
    o+=txt(s,bx+cw/2,hdr,t(s,hd),9.5,700,tc,1.4).replace('<text ','<text text-anchor="middle" ');
    rows.forEach((v,ri)=>o+=txt(s,bx+cw/2,r0+ri*rs,ужать(t(s,v),cw-12,сfs,сfs)[0],сfs,hi?700:s.wl,tc,null).replace('<text ','<text text-anchor="middle" '));
  });
  o+=txt(s,x+w/2,top+bh/2+5,'→',15,700,s.mode==='brutal'?s.ink:bgTx(s,s.pos),null).replace('<text ','<text text-anchor="middle" ');
  const прим=строка(дан&&дан.note,'срок · брак · контроль');
  o+=txt(s,x+20,y+h-18,t(s,ужать(прим,w-40,8.5,7)[0]),8.5,s.wl,s.tm,null);
  return wrapSvg(s,o);
}


/* ══════ Переходные слайды ══════ */

// 1 ── Разделитель раздела
function elDivider(s){
  const x=PAD,y=PAD,w=W-PAD*2,h=H-PAD*2;
  let o=frame(s)+surface(s,x,y,w,h);
  const cx=x+w/2, ac=s.mode==='brutal'?s.ink:bgTx(s,s.ac);
  o+=txt(s,cx,y+38,t(s,'раздел'),9,600,s.tm,3).replace('<text ','<text text-anchor="middle" ');
  // номер — самостоятельный элемент, а не подложка: поверх него ничего не ставим
  o+=txt(s,cx,y+80,'02',44,s.wv,ac,-1.5).replace('<text ','<text text-anchor="middle" ');
  o+=txt(s,cx,y+110,t(s,'Цифровая платформа'),18,s.wv,s.mode==='neon'||s.mode==='retro'?s.ac:s.tp,-.4).replace('<text ','<text text-anchor="middle" ');
  o+=`<line x1="${cx-40}" y1="${y+124}" x2="${cx+40}" y2="${y+124}" stroke="${ac}" stroke-width="${s.mode==='brutal'?3:2}"/>`;
  o+=txt(s,cx,y+144,t(s,'архитектура · данные · интеграции'),9.5,s.wl,s.ts,null).replace('<text ','<text text-anchor="middle" ');
  return wrapSvg(s,o);
}

// 2 ── Открытие главы
function elChapter(s){
  const x=PAD,y=PAD,w=W-PAD*2,h=H-PAD*2;
  let o=frame(s)+surface(s,x,y,w,h);
  const bw=s.mode==='brutal'?8:5, lx=x+22+bw+14;
  o+=`<rect x="${x+22}" y="${y+26}" width="${bw}" height="${h-52}" rx="${s.mode==='clay'?bw/2:s.mode==='retro'||s.mode==='brutal'?0:2}" fill="${s.ac}"/>`;
  o+=txt(s,lx,y+42,t(s,'глава 03'),9,700,bgTx(s,s.ac),2.6);
  o+=txt(s,lx,y+76,t(s,'ИИ и автоматизация'),18,s.wv,s.mode==='neon'||s.mode==='retro'?s.ac:s.tp,-.4);
  o+=txt(s,lx,y+102,t(s,'как внедряем искусственный'),10.5,s.wl,s.ts,null);
  o+=txt(s,lx,y+118,t(s,'интеллект в госсекторе'),10.5,s.wl,s.ts,null);
  o+=txt(s,lx,y+142,t(s,'12 минут · 4 кейса'),9,s.wl,s.tm,null);
  return wrapSvg(s,o);
}

// 3 ── Финальный слайд
function elThanks(s){
  const x=PAD,y=PAD,w=W-PAD*2,h=H-PAD*2;
  let o=frame(s)+surface(s,x,y,w,h);
  const cx=x+w/2;
  o+=txt(s,cx,y+62,t(s,'Спасибо'),34,s.wv,s.mode==='neon'||s.mode==='retro'?s.ac:s.tp,-1).replace('<text ','<text text-anchor="middle" ');
  o+=`<line x1="${cx-38}" y1="${y+78}" x2="${cx+38}" y2="${y+78}" stroke="${s.ac}" stroke-width="${s.mode==='brutal'?3:2}"/>`;
  o+=txt(s,cx,y+100,t(s,'Алексей Шестак'),12,600,s.ts,null).replace('<text ','<text text-anchor="middle" ');
  o+=txt(s,cx,y+116,t(s,'Bolashak Engineering'),9.5,s.wl,s.tm,null).replace('<text ','<text text-anchor="middle" ');
  const cy2=y+138, bw2=112;
  if(s.mode==='line')      o+=`<rect x="${cx-bw2/2}" y="${cy2-14}" width="${bw2}" height="22" rx="4" fill="none" stroke="${s.ac}" stroke-width="1.3"/>`;
  else if(s.mode==='brutal')o+=`<rect x="${cx-bw2/2}" y="${cy2-14}" width="${bw2}" height="22" fill="${s.ink}"/>`;
  else o+=`<rect x="${cx-bw2/2}" y="${cy2-14}" width="${bw2}" height="22" rx="${s.mode==='clay'?11:5}" fill="${s.ac}" fill-opacity="${s.mode==='neon'?.16:s.mode==='glass'||s.mode==='aurora'?.4:.16}"${s.mode==='neon'?` stroke="${s.ac}" stroke-width="1.2"`:''}/>`;
  const cc=s.mode==='brutal'?'#fff':bgTx(s,s.ac);
  o+=txt(s,cx,cy2-1,'+7 705 588 55 66',9.5,600,cc,null).replace('<text ','<text text-anchor="middle" ');
  return wrapSvg(s,o);
}

// 4 ── Содержание
function elAgenda(s,дан){
  const x=PAD,y=PAD,w=W-PAD*2;
  const пал=[s.ac,s.ac3,s.ac2,s.pos,s.tm];
  const пункты=ряды(дан&&дан.items,['Контекст и задачи','Текущее состояние','Решение на ИИ',
      'Результаты и эффект','Следующие шаги'],6).map(String);
  const A=пункты.map((п,i)=>[String(i+1).padStart(2,'0'),п,пал[i%пал.length]]);
  const hh=рост(y+56+(A.length-1)*21+3);   // пунктов больше пяти — холст растёт
  const h=hh-PAD*2;
  let o=frameH(s,hh)+surface(s,x,y,w,h);
  const заг=строка(дан&&дан.title,'Содержание');
  o+=txt(s,x+22,y+28,t(s,ужать(заг,w-44,13,10)[0]),13,s.wv,s.mode==='neon'||s.mode==='retro'?s.ac:s.tp,null);
  o+=`<line x1="${x+22}" y1="${y+36}" x2="${x+w-22}" y2="${y+36}" stroke="${s.ac}" stroke-width="${s.mode==='brutal'?3:2}"/>`;
  const [пп,пfs]=ужатьНабор(A.map(п=>t(s,п[1])),x+w-22-(x+46),10.5,8);
  A.forEach(([n2,l,c],i)=>{
    const ly=y+56+i*21;
    o+=txt(s,x+22,ly,n2,10.5,700,bgTx(s,c),null);
    o+=txt(s,x+46,ly,пп[i],пfs,s.wl,s.ts,null);
    if(i<A.length-1)o+=`<line x1="${x+46}" y1="${ly+6}" x2="${x+w-22}" y2="${ly+6}" stroke="${s.ln}" stroke-width=".7"${s.mode==='retro'?'':' stroke-dasharray="2 3"'}/>`;
  });
  return wrapSvgH(s,o,hh);
}

// 5 ── Профиль спикера
function elSpeaker(s){
  const x=PAD,y=PAD,w=W-PAD*2,h=H-PAD*2;
  let o=frame(s)+surface(s,x,y,w,h);
  const ax=x+56, ay=y+h/2-4, r=32;
  const gl=s.glow?` filter="${s.glow}"`:'';
  if(s.mode==='retro')      o+=`<rect x="${ax-r}" y="${ay-r}" width="${r*2}" height="${r*2}" fill="${s.ac}"/>`;
  else if(s.mode==='line')  o+=`<circle cx="${ax}" cy="${ay}" r="${r}" fill="none" stroke="${s.ac}" stroke-width="1.6"/>`;
  else if(s.mode==='brutal')o+=`<rect x="${ax-r+4}" y="${ay-r+4}" width="${r*2}" height="${r*2}" fill="${s.hard}"/><rect x="${ax-r}" y="${ay-r}" width="${r*2}" height="${r*2}" fill="#fff" stroke="${s.hard}" stroke-width="3"/>`;
  else if(s.mode==='neon')  o+=`<circle cx="${ax}" cy="${ay}" r="${r}" fill="${s.ac}" fill-opacity=".16" stroke="${s.ac}" stroke-width="1.4"${gl}/>`;
  else{o+=`<circle cx="${ax}" cy="${ay}" r="${r}" fill="${s.ac}" fill-opacity="${s.mode==='glass'||s.mode==='aurora'?.5:1}"/>`;
    if(s.mode==='clay')o+=`<ellipse cx="${ax}" cy="${ay-12}" rx="14" ry="7" fill="${s.hi}" fill-opacity=".3"/>`;}
  const ic=(s.mode==='line'||s.mode==='neon')?s.ac:s.mode==='brutal'?'#000':nodeTx(s,s.ac);
  o+=txt(s,ax,ay+7,'АШ',19,s.wv,ic,null).replace('<text ','<text text-anchor="middle" ');
  const lx=ax+r+22;
  o+=txt(s,lx,y+50,t(s,'Алексей Шестак'),14,s.wv,s.mode==='neon'||s.mode==='retro'?s.ac:s.tp,-.2);
  o+=txt(s,lx,y+68,t(s,'Senior Systems Analyst'),10,600,bgTx(s,s.ac),null);
  o+=txt(s,lx,y+84,t(s,'Bolashak Engineering'),9.5,s.wl,s.tm,null);
  o+=`<line x1="${lx}" y1="${y+98}" x2="${x+w-22}" y2="${y+98}" stroke="${s.ln}" stroke-width="1"/>`;
  o+=txt(s,lx,y+118,t(s,'TOGAF 9 · IPMA · 10 лет в ИТ'),9,s.wl,s.ts,null);
  o+=txt(s,lx,y+136,t(s,'Астана, Казахстан'),9,s.wl,s.tm,null);
  return wrapSvg(s,o);
}

// 6 ── Вопросы и ответы
function elFaq(s,дан){
  const x=PAD,y=PAD,w=W-PAD*2;
  const Q=ряды(дан&&дан.items,[{q:'С чего начать внедрение?',a:'с аудита процессов, 2 недели',open:1},
      {q:'Какие данные нужны?',open:0},{q:'Сроки пилота?',open:0}],4)
    .map(п=>[String(п.q==null?'':п.q),п.open?1:0,String(п.a==null?'с аудита процессов, 2 недели':п.a)]);
  const bx=x+20, bw=w-40, top=y+42;
  /* низ считается по последнему видимому: у свёрнутого вопроса плашки нет,
     остаётся только строка, и она заканчивается выше */
  let низQ=top, ходQ=top;
  Q.forEach(([,open])=>{const в=open?42:26;
    низQ=Math.max(низQ,open?ходQ+в:ходQ+16+9.5*0.22); ходQ+=в+6;});
  const hh=рост(низQ);   // раскрытых больше одного — холст растёт
  const h=hh-PAD*2;
  let o=frameH(s,hh)+surface(s,x,y,w,h);
  const заг=строка(дан&&дан.title,'Частые вопросы');
  o+=txt(s,x+22,y+28,t(s,ужать(заг,w-44,12,9)[0]),12,s.wl,s.ts,s.ls);
  const [вопр,вfs]=ужатьНабор(Q.map(п=>t(s,п[0])),bw-40,9.5,7);
  let cy=top;
  Q.forEach(([q,open,ans],i)=>{
    const bh=open?42:26;
    if(open){
      if(s.mode==='line')      o+=`<rect x="${bx}" y="${cy}" width="${bw}" height="${bh}" rx="4" fill="none" stroke="${s.ac}" stroke-width="1.3"/>`;
      else if(s.mode==='brutal')o+=`<rect x="${bx}" y="${cy}" width="${bw}" height="${bh}" fill="none" stroke="${s.ink}" stroke-width="3"/>`;
      else o+=`<rect x="${bx}" y="${cy}" width="${bw}" height="${bh}" rx="${s.mode==='clay'?12:5}" fill="${s.ac}" fill-opacity="${s.mode==='neon'?.12:.13}"/>`;
      o+=`<rect x="${bx}" y="${cy}" width="3" height="${bh}" rx="1.5" fill="${s.ac}"/>`;
    }
    const qc=open?(s.mode==='brutal'?s.ink:bgTx(s,s.ac)):s.ts;
    o+=txt(s,bx+14,cy+16,вопр[i],вfs,open?700:s.wl,qc,null);
    o+=txt(s,bx+bw-14,cy+16,open?'−':'+',13,700,s.mode==='brutal'?s.ink:bgTx(s,s.ac),null).replace('<text ','<text text-anchor="end" ');
    if(open)o+=txt(s,bx+14,cy+32,t(s,ужать(ans,bw-28,8.5,7)[0]),8.5,s.wl,s.tm,null);
    cy+=bh+6;
    if(i<Q.length-1)o+=`<line x1="${bx}" y1="${cy-3}" x2="${bx+bw}" y2="${cy-3}" stroke="${s.ln}" stroke-width=".7"/>`;
  });
  return wrapSvgH(s,o,hh);
}



const CATS=[
  ["Диаграммы и данные",[["kpi","KPI-карточка",elKpi],["bars","Прогресс-бары",elBars],["column","Столбчатый график",elColumn],["donut","Кольцевая диаграмма",elDonut],["radar","Радар",elRadar],["gauge","Спидометр",elGauge],["area","Area chart",elArea],["wf","Waterfall",elWaterfall],["heat","Heatmap",elHeat],["tree","Treemap",elTree],["scat","Scatter",elScatter],["spark","Sparklines",elSpark],["bub","Bubble",elBubble],["dumb","Dumbbell",elDumb]]],
  ["Шаги и процессы",[["arrows","Стрелки-шаги",elArrows],["funnel","Воронка",elFunnel],["timeline","Таймлайн",elTimeline],["cycle","Цикл PDCA",elCycle],["roadmap","Дорожная карта",elRoadmap],["swim","Swimlane",elSwim],["dtree","Дерево решений",elTree2],["loop","Бесконечный цикл",elLoop],["journey","Путь клиента",elJourney],["tcards","Таймлайн карточками",elTCards]]],
  ["Матрицы и пирамиды",[["pyramid","Пирамида",elPyramid],["swot","SWOT",elSwot],["m22","Матрица 2×2",elM22],["venn","Диаграмма Венна",elVenn],["fmatrix","Таблица сравнения",elFMatrix]]],
  ["AI и нейросети",[["net","Нейронная сеть",elNet],["trans","Блок трансформера",elTrans],["rag","Конвейер RAG",elRag],["llm","Сравнение моделей",elLLM],["vec","Векторное пространство",elVec]]],
  ["Архитектура и интеграции",[["micro","Микросервисы",elMicro],["cicd","Конвейер CI/CD",elCicd],["egov","Межведомственный шлюз",elEgov],["bus","Событийная шина",elBus],["layers","Слои системы",elLayers]]],
  ["Числа и инфографика",[["bignum","Большое число",elBigNum],["facts","Три факта",elFacts],["statcard","Показатель с трендом",elStatCard],["ring","Кольцо прогресса",elRing],["icons","Четыре преимущества",elIcons],["quote","Цитата с цифрами",elQuote],["before","До и после",elBefore]]],
  ["Переходные слайды",[["divider","Разделитель раздела",elDivider],["chapter","Открытие главы",elChapter],["thanks","Финальный слайд",elThanks],["agenda","Содержание",elAgenda],["speaker","Профиль спикера",elSpeaker],["faq","Вопросы и ответы",elFaq]]]
];
export { CATS };
