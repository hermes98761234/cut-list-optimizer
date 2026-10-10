import type { Lang } from './lib/model'

export type T = (s: string, ...args: (string | number)[]) => string

/** Marks a string for translation where it is defined away from its t() call. */
export const N = (s: string) => s

/** English source string → Ukrainian. `{0}`, `{1}` are placeholders for interpolated values. */
export const UK: Record<string, string> = {
  'Cut-list optimizer': 'Оптимізатор розкрою',
  'Plan cuts from bars, lumber and sheets with the least waste.': 'Розкрій профілю, дошок і листів з мінімумом відходів.',
  'Bars (1D)': 'Прутки (1D)',
  'Sheets (2D)': 'Листи (2D)',
  'Load example': 'Завантажити приклад',
  Settings: 'Налаштування',
  'Saw kerf': 'Ширина пропилу',
  'Edge trim': 'Обрізка краю',
  Units: 'Одиниці',
  Currency: 'Валюта',
  Algorithm: 'Алгоритм',
  'Guillotine (edge-to-edge cuts)': 'Гільйотинний (наскрізні різи)',
  'MaxRects (tighter)': 'MaxRects (щільніше)',
  Effort: 'Старанність',
  Fast: 'Швидко',
  Balanced: 'Збалансовано',
  Thorough: 'Ретельно',
  Language: 'Мова',
  Theme: 'Тема',
  System: 'Системна',
  Light: 'Світла',
  Dark: 'Темна',
  'Sizes are unitless numbers: use the same unit everywhere. The unit only labels the results.':
    'Розміри — прості числа: використовуйте одну одиницю всюди. Одиниця лише підписує результати.',
  'Heuristic packing: results are good, not guaranteed optimal. Everything runs in your browser.':
    'Евристична укладка: результат добрий, але не обов’язково оптимальний. Усе працює у вашому браузері.',
  'Source on GitHub': 'Код на GitHub',
  'Parts to cut': 'Деталі для розкрою',
  Name: 'Назва',
  Length: 'Довжина',
  Width: 'Ширина',
  Qty: 'К-сть',
  'Keep the grain: length runs along the sheet, never rotated': 'Зберегти волокна: довжина вздовж листа, без повороту',
  Grain: 'Волокна',
  Remove: 'Видалити',
  'Add at least one part.': 'Додайте хоча б одну деталь.',
  '+ Add part': '+ Додати деталь',
  Clear: 'Очистити',
  'Sheet stock': 'Листи на складі',
  'Bar stock': 'Прутки на складі',
  Cost: 'Ціна',
  'Leave empty for unlimited': 'Залиште порожнім, якщо без обмежень',
  'Max qty': 'Макс. к-сть',
  'Add at least one stock size.': 'Додайте хоча б один розмір заготовки.',
  '+ Add stock': '+ Додати заготовку',
  'Fix the highlighted fields.': 'Виправте виділені поля.',
  'Add parts and stock to get a cutting plan.': 'Додайте деталі та заготовки, щоб отримати план розкрою.',
  'Error: {0}': 'Помилка: {0}',
  'Optimising…': 'Оптимізуємо…',
  '{0} of {1} parts could not be placed.': 'Не вдалося розмістити деталей: {0} з {1}.',
  'All {0} parts fit on {1} sheets.': 'Усі деталі ({0}) розміщено на листах: {1}.',
  'All {0} parts fit on {1} bars.': 'Усі деталі ({0}) розміщено на прутках: {1}.',
  Sheets: 'Листи',
  Bars: 'Прутки',
  'Total cost': 'Загальна вартість',
  Waste: 'Відходи',
  Used: 'Використано',
  'Too large for any stock, or stock ran out:': 'Завелика для будь-якої заготовки або заготовки закінчились:',
  'Buy list': 'Список закупівлі',
  'Download CSV': 'Завантажити CSV',
  'Print / Save as PDF': 'Друк / зберегти як PDF',
  'Kerf {0} {1}, edge trim {2} {1}.': 'Пропил {0} {1}, обрізка краю {2} {1}.',
  'offcut {0}': 'залишок {0}',
  'Bar {0}': 'Пруток {0}',
  'waste {0}': 'відходи {0}',
  'Sheet {0}': 'Лист {0}',
}

export function tr(lang: Lang, s: string, ...args: (string | number)[]): string {
  const src = lang === 'uk' ? (UK[s] ?? s) : s
  return src.replace(/\{(\d+)\}/g, (_, i: string) => String(args[+i]))
}
