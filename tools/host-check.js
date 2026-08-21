/* Проверка сервера глазами хоста: не команд, а условий запуска.
   Хост стартует процесс из чужого каталога, с урезанным окружением
   и разбирает stdout как поток JSON-RPC. Функциональные пробы — в smoke.js.

     node tools/host-check.js */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { tmpdir } from 'node:os';

const СЕРВЕР = new URL('../src/index.js', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

/* Anthropic API проверяет шаблоном не только имя инструмента, но и каждый ключ
   свойства в схеме — на любой глубине. Один кириллический ключ роняет весь
   список инструментов ошибкой 400, вместе с чужими серверами сессии.
   Именно это и пропустили первые прогоны: имена проверяли, поля — нет. */
const ключиСвойств = (узел, собрано = []) => {
  if (!узел || typeof узел !== 'object') return собрано;
  if (узел.properties && typeof узел.properties === 'object')
    for (const [к, вложенный] of Object.entries(узел.properties)) { собрано.push(к); ключиСвойств(вложенный, собрано); }
  for (const поле of ['items', 'additionalProperties']) ключиСвойств(узел[поле], собрано);
  for (const поле of ['anyOf', 'oneOf', 'allOf'])
    if (Array.isArray(узел[поле])) узел[поле].forEach(в => ключиСвойств(в, собрано));
  return собрано;
};

const итог = [];
const проба = (что, условие, пояснение = '') => {
  итог.push(!!условие);
  console.log(`  ${условие ? 'ок  ' : 'СБОЙ'}  ${что}${пояснение ? ' — ' + пояснение : ''}`);
};

/* Хост не наследует наш каталог и передаёт лишь часть окружения.
   Относительный путь к spec/ или зависимость от cwd убьют сервер именно здесь. */
const поднять = async (подпись, настройки) => {
  const клиент = new Client({ name: 'host-check', version: '1.0.0' });
  const транспорт = new StdioClientTransport({ command: process.execPath, args: [СЕРВЕР], stderr: 'pipe', ...настройки });
  let стерр = '';
  await клиент.connect(транспорт);
  транспорт.stderr?.on('data', ч => { стерр += ч; });
  const { tools } = await клиент.listTools();
  проба(`поднимается ${подпись}`, tools.length === 6, `инструментов ${tools.length}`);
  return { клиент, tools, стерр: () => стерр };
};

const чужой = tmpdir();
const { клиент, tools, стерр } = await поднять(`из чужого каталога (${чужой})`, { cwd: чужой });

/* Windows без SYSTEMROOT не запускает даже node, поэтому оставляем минимум,
   каким его отдаёт хост: путь к исполняемому файлу и системный корень. */
const урезанное = { PATH: process.env.PATH || '', SYSTEMROOT: process.env.SYSTEMROOT || '', TEMP: чужой };
const второй = await поднять('с урезанным окружением', { cwd: чужой, env: урезанное });
await второй.клиент.close();

for (const т of tools) {
  const с = т.inputSchema;
  проба(`${т.name}: описание и схема`,
    typeof т.description === 'string' && т.description.length > 20 &&
    с && с.type === 'object' && с.properties && typeof с.properties === 'object',
    `${(т.description || '').length} знаков, полей ${Object.keys(с?.properties || {}).length}`);
  проба(`${т.name}: схема без чужих ссылок`, !/"\$ref"|"\$schema"|zod/i.test(JSON.stringify(с)));
  const плохие = ключиСвойств(с).filter(к => !/^[a-zA-Z0-9_.-]{1,64}$/.test(к));
  проба(`${т.name}: имена полей проходят шаблон API`, плохие.length === 0,
    плохие.length ? `не проходят: ${плохие.join(', ')}` : ключиСвойств(с).join(', ') || 'полей нет');
}

/* Крупная полезная нагрузка: SVG длиннее строки терминала — проверяем,
   что кадрирование stdio его не рвёт и он доходит целиком. */
await клиент.callTool({ name: 'start', arguments: { style: 'flat' } });
const р = await клиент.callTool({ name: 'draw', arguments: { id: 'bars' } });
const тело = р.content?.[0];
проба('ответ — текстовый блок', тело?.type === 'text' && !р.isError);
const ответ = JSON.parse(тело.text);
проба('SVG доходит целиком', /^<svg[\s\S]*<\/svg>\s*$/.test(ответ['svg']), `${ответ['svg'].length} знаков`);
проба('в ответе холст и разбор фона', !!ответ['холст']?.['ширина'] && !!ответ['фон']?.['требуется']);

/* Сообщения человеку обязаны идти в stderr: stdout занят протоколом.
   Если бы туда попала лишняя строка, разбор JSON-RPC уже упал бы выше. */
проба('журнал уходит в stderr', /элемент|стил/i.test(стерр()), стерр().trim().split('\n')[0] || 'пусто');

await клиент.close();
const сбоев = итог.filter(о => !о).length;
console.log(`\nпроверок ${итог.length}, сбоев ${сбоев}`);
process.exit(сбоев ? 1 : 0);
