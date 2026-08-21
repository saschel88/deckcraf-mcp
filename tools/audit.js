/* Прогон 676 пар через шесть проверок.
   Без аргументов — сводка. С --snapshot <файл> ещё и слепок разметки,
   чтобы сравнить отрисовку образцов до и после правок в elements.js.
   Слепок сличается, если файл есть, и записывается, если файла нет
   либо передан --write.

     npm run check      сличить с tools/baseline.json
     npm run baseline   пересобрать слепок — только осознанно, когда
                        отрисовка образца изменена намеренно */

import { createHash } from 'node:crypto';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { ST, ALLOW } from '../src/engine.js';
import { CATS } from '../src/elements.js';
import { проверить } from '../src/checks.js';

const СТИЛИ = Object.keys(ST).filter(k => k !== 'iso');     // изометрия снята с производства
const ЭЛЕМЕНТЫ = CATS.flatMap(([кат, список]) => список.map(([ид, имя, fn]) => ({ ид, имя, кат, fn })));

const слепок = {}, счёт = {}, примеры = {};
let пар = 0, сбоев = 0;

for (const стиль of СТИЛИ) {
  for (const э of ЭЛЕМЕНТЫ) {
    if ((ALLOW[э.ид] || СТИЛИ).indexOf(стиль) < 0) continue;
    пар++;
    let svg;
    try { svg = э.fn(ST[стиль]); }
    catch (e) { сбоев++; console.log(`  ИСКЛЮЧЕНИЕ ${стиль}/${э.ид}: ${e.message}`); continue; }
    слепок[`${стиль}/${э.ид}`] = createHash('sha1').update(svg).digest('hex');
    for (const з of проверить(svg, ST[стиль])) {
      счёт[з.проверка] = (счёт[з.проверка] || 0) + 1;
      (примеры[з.проверка] ||= []).push(`${стиль}/${э.ид}: ${з.сообщение}`);
    }
  }
}

console.log(`пар ${пар}, сбоев отрисовки ${сбоев}`);
const порядок = ['разметка', 'нижний отступ', 'зазор подпись↔фигура', 'текст в фигуре', 'контраст', 'тёмный на поле', 'за кромкой'];
for (const п of порядок) {
  const n = счёт[п] || 0;
  console.log(`  ${п.padEnd(22)} ${String(n).padStart(4)}` + (n ? `   напр. ${примеры[п][0]}` : '   чисто'));
}

const и = process.argv.indexOf('--snapshot');
if (и > 0) {
  const файл = process.argv[и + 1];
  const перезаписать = process.argv.includes('--write');
  if (existsSync(файл) && !перезаписать) {
    const было = JSON.parse(readFileSync(файл, 'utf8'));
    const разошлись = Object.keys(слепок).filter(k => было[k] !== слепок[k]);
    const пропали = Object.keys(было).filter(k => !(k in слепок));
    console.log(`\nсличение с ${файл}: пар ${Object.keys(слепок).length}, разошлись ${разошлись.length}, пропали ${пропали.length}`);
    if (разошлись.length) console.log('  ' + разошлись.slice(0, 20).join(', '));
  } else {
    writeFileSync(файл, JSON.stringify(слепок, null, 0));
    console.log(`\nслепок записан: ${файл}`);
  }
}
