/* Глазная проверка: гонит запросы через настоящий MCP-клиент и складывает
   ответы сервера в одну страницу. Это не тест — это возможность посмотреть,
   что именно хост получит на руки.

     node tools/preview.js flat                  двадцать элементов стиля
     node tools/preview.js glass bars donut kpi  выбранные
     node tools/preview.js retro --data          с длинными русскими подписями */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { writeFileSync } from 'node:fs';

const дов = process.argv.slice(2).filter(а => а !== '--data');
const сДанными = process.argv.includes('--data');
const стиль = дов[0] || 'flat';
const заказ = дов.slice(1);

const ДАННЫЕ = {
  bars: { title: 'Затраты по направлениям', rows: [
    { label: 'Автоматизация закупок', v: 78 }, { label: 'Персонал', v: 55 }, { label: 'Оцифровка архива', v: 91 }] },
  donut: { rows: [{ label: 'Госкорпорации', v: 44 }, { label: 'Частный сектор', v: 33 }, { label: 'Прочие', v: 23 }] },
  facts: { rows: [{ v: '12 лет', label: 'на рынке' }, { v: '340', label: 'внедрений' }, { v: '98%', label: 'продлений' }] }
};

const клиент = new Client({ name: 'preview', version: '1.0.0' });
await клиент.connect(new StdioClientTransport({
  command: process.execPath,
  args: [new URL('../src/index.js', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')],
  stderr: 'pipe'
}));

const вызов = async (имя, арг = {}) => {
  const р = await клиент.callTool({ name: имя, arguments: арг });
  if (р.isError) throw new Error(`${имя}: ${р.content[0].text}`);
  return JSON.parse(р.content[0].text);
};

const старт = await вызов('start', { style: стиль });
/* find отдаёт 1–3 элемента под задачу, а не каталог: перечень берём из библиотеки,
   отрисовку всё равно заказываем у сервера. */
const { CATS } = await import('../src/elements.js');
const все = CATS.flatMap(([, список]) => список.map(([ид]) => ид));
const список = заказ.length ? заказ : все.slice(0, 20);

const карточки = [];
for (const ид of список) {
  try {
    const о = await вызов('draw', { id: ид, ...(сДанными && ДАННЫЕ[ид] ? { data: ДАННЫЕ[ид] } : {}) });
    const зам = (о['предупреждения'] || []);
    карточки.push(`<figure><figcaption>${ид}${зам.length ? ` <b>${зам.length}</b>` : ''}</figcaption>
      ${о['svg']}
      ${зам.length ? `<ul>${зам.map(з => `<li>${з}</li>`).join('')}</ul>` : ''}</figure>`);
  } catch (e) { карточки.push(`<figure><figcaption>${ид}</figcaption><p class=err>${e.message}</p></figure>`); }
}

/* Фон страницы выводим из требований стиля: договор задаёт не цвет, а вилку
   светлоты. Берём её середину — на белом листе тёмные стили не читаются,
   и глазная проверка вышла бы ложной. */
const подробно = старт['фон']?.['подробно'] || {};
const норма = String(подробно['светлота'] || '');
/* Вилку узнаём по тире между числами: без него «НЕ ВЫШЕ 0.15» читалось бы
   как пара 0 и 15, и страница выходила белой под тёмный стиль. */
const вилка = норма.match(/(\d*\.?\d+)\s*[–—-]\s*(\d*\.?\d+)/);
const потолок = норма.match(/не выше\s*(\d*\.?\d+)/i);
const светлота = вилка ? (Number(вилка[1]) + Number(вилка[2])) / 2
  : потолок ? Number(потолок[1]) / 2 : 1;
const байт = Math.round(255 * светлота).toString(16).padStart(2, '0');
const фон = светлота >= 0.95 ? '#fff' : `#${байт}${байт}${байт}`;
writeFileSync('preview.html', `<!doctype html><meta charset=utf-8><title>${стиль}</title>
<style>body{background:${фон};font:13px/1.5 system-ui;margin:24px;color:#888}
figure{display:inline-block;margin:0 16px 24px 0;vertical-align:top;max-width:420px}
figcaption{font:600 12px system-ui;margin-bottom:6px}b{color:#c60}
ul{font-size:11px;padding-left:16px;margin:6px 0}.err{color:#c00}</style>
<h1 style="font:600 15px system-ui">${стиль} — ${список.length} элементов${сДанными ? ', с данными' : ''}</h1>
${карточки.join('\n')}`);

console.log(`preview.html: стиль ${стиль}, элементов ${список.length}${сДанными ? ', с данными' : ''}`);
console.log(`фон страницы ${фон} — от слайда требуется: ${старт['фон']?.['требуется'] || 'ничего'}`);
console.log(старт['фон']?.['свой_несёт'] ? 'элемент несёт фоновый слой сам' : 'элемент фон не несёт: под ним должен быть фон слайда');
await клиент.close();
