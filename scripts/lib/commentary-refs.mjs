/**
 * 注解译文英文书卷引用 → 中文简称 替换逻辑
 * （fix-commentary.mjs 与 translate-commentary.mjs 共用，避免两份实现）
 *
 * 覆盖两套英文缩写体系：
 *  ① OSIS/SWORD 三字母式：Joh Heb Isa Psa 2Sa 1Ti …
 *  ② 两字母缩写式：Mt Mr Lu Jo Ac Ro Ge Ex De …
 *     - Jo/Jn 无前导数字时 = 约翰福音(joh)；1Jo/2Jo/3Jo（或 1Jn 等）= 约翰书信
 *     - Ti/Th/Sa/Ki/Ch/Pe/Co 不单独出现，只以 1Ti、2Th、2Sa 等带前导数字的形式合法
 *
 * 仅替换书卷名 token（要求其后紧跟 章:节 数字，用前瞻断言保证），
 * 章节号与其后分隔符（", 4"、"; "、"等" 等）原样保留：
 *   "2Sa 7:12; Ps 89:3等" → "撒下 7:12; 诗 89:3等"
 * 中文简称以 books-meta.mjs 的 abbr 字段为准。
 */
import { BOOKS_META } from '../books-meta.mjs';

/** bookId → 中文简称 */
const ABBR = Object.fromEntries(BOOKS_META.map((b) => [b.bookId, b.abbr]));

/**
 * 英文别名（全小写、无前导空格）→ bookId
 * 带前导数字的书卷（1ti/2sa/1jo…）数字包含在别名内，
 * 因此裸写的 "Ti 3:3"、"Sa 7:12" 不会被匹配，会进入「无法识别」清单。
 */
const ALIAS_TO_BOOK = {
  // 旧约
  ge: 'gen', gen: 'gen',
  ex: 'exo', exo: 'exo', exod: 'exo',
  le: 'lev', lev: 'lev',
  nu: 'num', num: 'num',
  de: 'deu', dt: 'deu', deu: 'deu', deut: 'deu',
  jos: 'jos', josh: 'jos',
  jdg: 'jdg', judg: 'jdg',
  ru: 'rut', rut: 'rut', ruth: 'rut',
  '1sa': '1sa', '1sam': '1sa',
  '2sa': '2sa', '2sam': '2sa',
  '1ki': '1ki', '1kgs': '1ki',
  '2ki': '2ki', '2kgs': '2ki',
  '1ch': '1ch', '1chr': '1ch',
  '2ch': '2ch', '2chr': '2ch',
  ezr: 'ezr', ezra: 'ezr',
  ne: 'neh', neh: 'neh',
  est: 'est', esth: 'est',
  job: 'job',
  ps: 'psa', psa: 'psa',
  pr: 'pro', pro: 'pro', prov: 'pro',
  ec: 'ecc', ecc: 'ecc',
  ss: 'sng', sng: 'sng', song: 'sng',
  isa: 'isa',
  jer: 'jer',
  la: 'lam', lam: 'lam',
  eze: 'eze', ezek: 'eze',
  da: 'dan', dan: 'dan',
  hos: 'hos',
  joe: 'joe', joel: 'joe',
  am: 'amo', amo: 'amo', amos: 'amo',
  oba: 'oba', obad: 'oba',
  jon: 'jon', jonah: 'jon',
  mic: 'mic',
  na: 'nah', nah: 'nah',
  hab: 'hab',
  zep: 'zep', zeph: 'zep',
  hag: 'hag',
  zec: 'zec', zech: 'zec',
  mal: 'mal',
  // 新约
  mt: 'mat', mat: 'mat', matt: 'mat',
  mr: 'mar', mk: 'mar', mar: 'mar', mark: 'mar',
  lu: 'luk', lk: 'luk', luk: 'luk', luke: 'luk',
  jo: 'joh', jn: 'joh', joh: 'joh', john: 'joh',
  ac: 'act', act: 'act', acts: 'act',
  ro: 'rom', rom: 'rom',
  '1co': '1co', '1cor': '1co',
  '2co': '2co', '2cor': '2co',
  ga: 'gal', gal: 'gal',
  eph: 'eph',
  php: 'phi', phi: 'phi', phil: 'phi',
  col: 'col',
  '1th': '1th', '1thes': '1th', '1thess': '1th',
  '2th': '2th', '2thes': '2th', '2thess': '2th',
  '1ti': '1ti', '1tim': '1ti',
  '2ti': '2ti', '2tim': '2ti',
  tit: 'tit', titus: 'tit',
  phm: 'phm', phlm: 'phm', philem: 'phm',
  heb: 'heb',
  jas: 'jam', jam: 'jam', james: 'jam',
  '1pe': '1pe', '1pet': '1pe',
  '2pe': '2pe', '2pet': '2pe',
  '1jo': '1jo', '1jn': '1jo', '1joh': '1jo', '1john': '1jo',
  '2jo': '2jo', '2jn': '2jo', '2joh': '2jo', '2john': '2jo',
  '3jo': '3jo', '3jn': '3jo', '3joh': '3jo', '3john': '3jo',
  jud: 'jud', jude: 'jud',
  re: 'rev', rev: 'rev',
};

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// 生成交替模式：长别名优先；带前导数字的别名允许数字与字母间有一个空格（如 "1 Ti"）
const aliasPatterns = Object.keys(ALIAS_TO_BOOK)
  .map((a) => (/^[1-3]/.test(a) ? `${a[0]}\\s?${escapeRe(a.slice(1))}` : escapeRe(a)))
  .sort((x, y) => y.length - x.length);

/**
 * 书卷引用正则：
 *  - 前面不能是字母/数字（防止截获 "11Ti" 之类）
 *  - token 后可带一个句点（"Ps. 89:3"），句点一并去掉
 *  - 后面必须紧跟章节数字（"Joh 15:3" 或仅有章号的 "Mt 13"，允许全角冒号），
 *    章节数字不在匹配内、原样保留；数字后不能再跟 :数字 或数字（防止吃掉 "Mt 13:1" 的章号以外的部分）
 */
const REF_RE = new RegExp(`(?<![A-Za-z0-9])(?:${aliasPatterns.join('|')})\\.?(?=\\s*\\d+(?:[:：]\\d+)?(?![:：0-9]))`, 'gi');

/** 类引用模式（用于替换后复查无法识别的残留） */
const UNKNOWN_REF_RE = /(?<![A-Za-z0-9])[1-3]?\s?[A-Za-z]{1,12}\.?\s*\d+[:：]\d+/g;

/**
 * 替换文本中的英文书卷引用为中文简称。
 * @param {string} text 译文文本
 * @param {(bookId: string, matched: string) => void} [onReplace] 每次替换的回调（用于统计）
 * @returns {string} 替换后的文本
 */
export function replaceEnglishRefs(text, onReplace) {
  return text.replace(REF_RE, (m) => {
    const key = m.replace(/[\s.]/g, '').toLowerCase();
    const bookId = ALIAS_TO_BOOK[key];
    if (!bookId) return m; // 兜底：理论上不会走到（正则由别名表生成）
    onReplace?.(bookId, m);
    return ABBR[bookId];
  });
}

/**
 * 查找替换后仍残留的「类引用模式」（书卷名无法识别，供人工核对）。
 * @returns {{ match: string, index: number }[]}
 */
export function findUnrecognizedRefs(text) {
  return [...text.matchAll(UNKNOWN_REF_RE)].map((m) => ({ match: m[0], index: m.index }));
}
