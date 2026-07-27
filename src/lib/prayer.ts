/**
 * 祷告板块数据与存储：
 *  - 祷告提示词主题（引导语 + 和合本经文，公有领域）
 *  - 经典祷文（主祷文、诗篇 23 篇为公有领域经文；晨祷/晚祷为本项目原创）
 *  - 计时结束的安慰经文
 *  - 代祷事项清单（createLocalStore 持久化）
 */
import { createLocalStore } from './store';

/** 经节引用（文本为和合本，点击可跳转阅读页） */
export interface PrayerVerse {
  bookId: string;
  chapter: number;
  ref: string; // 显示用，如「诗篇 100:4」
  text: string;
}

/** 祷告提示词主题：标题 + 引导语 + 相关经文 */
export interface PrayerTheme {
  id: string;
  icon: string;
  title: string;
  guides: string[];
  verses: PrayerVerse[];
}

export const PRAYER_THEMES: PrayerTheme[] = [
  {
    id: 'thanksgiving',
    icon: '🌅',
    title: '感恩赞美',
    guides: [
      '先安静片刻，数一数今天值得感恩的三件小事。',
      '为神的属性赞美他：他的慈爱、信实、公义与圣洁。',
      '为身边的恩典具体地道谢：家人、工作、教会、健康的身体。',
      '把感恩的心化为一句话，告诉他：你是乐意感恩的人。',
    ],
    verses: [
      {
        bookId: 'psa',
        chapter: 100,
        ref: '诗篇 100:4-5',
        text: '当称谢进入他的门，当赞美进入他的院；当感谢他，称颂他的名。因为耶和华本为善，他的慈爱存到永远，他的信实直到万代。',
      },
      {
        bookId: '1th',
        chapter: 5,
        ref: '帖撒罗尼迦前书 5:16-18',
        text: '要常常喜乐，不住地祷告，凡事谢恩，因为这是神在基督耶稣里向你们所定的旨意。',
      },
    ],
  },
  {
    id: 'confession',
    icon: '🕊️',
    title: '认罪悔改',
    guides: [
      '求圣灵光照你，回想今天的言语、心思与行为。',
      '具体地承认得罪神、得罪人的地方，不笼统、不推卸。',
      '凭信心领受赦免，也立志靠着恩典远离这罪。',
      '若有亏欠的人，求神给你勇气去和好、去弥补。',
    ],
    verses: [
      {
        bookId: '1jo',
        chapter: 1,
        ref: '约翰一书 1:9',
        text: '我们若认自己的罪，神是信实的，是公义的，必要赦免我们的罪，洗净我们一切的不义。',
      },
      {
        bookId: 'psa',
        chapter: 51,
        ref: '诗篇 51:10',
        text: '神啊，求你为我造清洁的心，使我里面重新有正直的灵。',
      },
    ],
  },
  {
    id: 'family',
    icon: '🏡',
    title: '为家人',
    guides: [
      '逐个提起家人的名字，为他们各自的处境祷告。',
      '为父母的健康、配偶的压力、孩子的品格与信心代求。',
      '求神使你的家成为彼此相爱、彼此饶恕的地方。',
      '为自己祷告：求神先改变你，使你在家里作光作盐。',
    ],
    verses: [
      {
        bookId: 'jos',
        chapter: 24,
        ref: '约书亚记 24:15',
        text: '至于我和我家，我们必定事奉耶和华。',
      },
      {
        bookId: 'pro',
        chapter: 22,
        ref: '箴言 22:6',
        text: '教养孩童，使他走当行的道，就是到老他也不偏离。',
      },
    ],
  },
  {
    id: 'work',
    icon: '💼',
    title: '为工作/学业',
    guides: [
      '把手中正在做的事摆在神面前，承认它是主所托付的。',
      '为手头具体的难题求智慧，为与同事、同学的关系求恩典。',
      '求神保守你不被忙碌吞噬，在工作中仍有正直与良心。',
      '把结果交托给他，学习殷勤做工、安然休息。',
    ],
    verses: [
      {
        bookId: 'col',
        chapter: 3,
        ref: '歌罗西书 3:23',
        text: '无论作什么，都要从心里作，像是给主作的，不是给人作的。',
      },
      {
        bookId: 'pro',
        chapter: 3,
        ref: '箴言 3:5-6',
        text: '你要专心仰赖耶和华，不可倚靠自己的聪明，在你一切所行的事上都要认定他，他必指引你的路。',
      },
    ],
  },
  {
    id: 'anxiety',
    icon: '🌧️',
    title: '焦虑忧愁时',
    guides: [
      '不必修饰词句，把心里翻腾的忧虑原原本本告诉他。',
      '一件一件说出你害怕的事，并在每一件后面加上「我把这事交托给你」。',
      '回想他过去如何带领你走过难处，让信心代替恐惧。',
      '最后安静一分钟，只是停留在他面前，什么都不必说。',
    ],
    verses: [
      {
        bookId: 'phi',
        chapter: 4,
        ref: '腓立比书 4:6-7',
        text: '应当一无挂虑，只要凡事藉着祷告、祈求和感谢，将你们所要的告诉神。神所赐出人意外的平安，必在基督耶稣里保守你们的心怀意念。',
      },
      {
        bookId: 'mat',
        chapter: 11,
        ref: '马太福音 11:28',
        text: '凡劳苦担重担的人，可以到我这里来，我就使你们得安息。',
      },
    ],
  },
  {
    id: 'church',
    icon: '⛪',
    title: '为教会/肢体',
    guides: [
      '为你的牧者、传道人祷告，求神保守他们的心与家庭。',
      '为教会里的合一祷告，求神除去隔阂与纷争。',
      '想起一两位软弱的肢体，点名为他们代求。',
      '求神使用你的恩赐，让你也成为别人的祝福。',
    ],
    verses: [
      {
        bookId: 'joh',
        chapter: 13,
        ref: '约翰福音 13:34-35',
        text: '我赐给你们一条新命令，乃是叫你们彼此相爱；我怎样爱你们，你们也要怎样相爱。你们若有彼此相爱的心，众人因此就认出你们是我的门徒了。',
      },
      {
        bookId: 'psa',
        chapter: 133,
        ref: '诗篇 133:1',
        text: '看哪，弟兄和睦同居，是何等地善，何等地美！',
      },
    ],
  },
  {
    id: 'sick',
    icon: '🌿',
    title: '为病痛中人',
    guides: [
      '提起患病之人的名字，求神怜悯、医治、安慰。',
      '为他们病中的恐惧与孤单祷告，求主亲自陪伴。',
      '为照顾他们的家人求力量与耐心。',
      '也求神在病痛中显明他的恩典，坚固人的信心。',
    ],
    verses: [
      {
        bookId: 'jam',
        chapter: 5,
        ref: '雅各书 5:15',
        text: '出于信心的祈祷要救那病人，主必叫他起来；他若犯了罪，也必蒙赦免。',
      },
      {
        bookId: 'isa',
        chapter: 41,
        ref: '以赛亚书 41:10',
        text: '你不要害怕，因为我与你同在；不要惊惶，因为我是你的神。我必坚固你，我必帮助你，我必用我公义的右手扶持你。',
      },
    ],
  },
  {
    id: 'unsaved',
    icon: '🕯️',
    title: '为未信亲友',
    guides: [
      '想起一两位还不认识主的亲友，提名为他们祷告。',
      '求神软化他们的心，挪去他们对福音的误解与抗拒。',
      '求神赐你合适的时机与温柔的话语，为他们作见证。',
      '把结果交托给神——救恩是他的工作，我们只管播种浇水。',
    ],
    verses: [
      {
        bookId: '1ti',
        chapter: 2,
        ref: '提摩太前书 2:3-4',
        text: '这是好的，在神我们救主面前可蒙悦纳。他愿意万人得救，明白真道。',
      },
      {
        bookId: 'act',
        chapter: 16,
        ref: '使徒行传 16:31',
        text: '当信主耶稣，你和你一家都必得救。',
      },
    ],
  },
];

/** 经典祷文（公有领域经文 + 本项目原创短文） */
export interface ClassicPrayer {
  id: string;
  title: string;
  source: string; // 出处说明
  /** 可选：跳转阅读整章 */
  link?: { bookId: string; chapter: number };
  paragraphs: string[];
}

export const CLASSIC_PRAYERS: ClassicPrayer[] = [
  {
    id: 'lords-prayer',
    title: '主祷文',
    source: '马太福音 6:9-13（和合本）',
    link: { bookId: 'mat', chapter: 6 },
    paragraphs: [
      '我们在天上的父：愿人都尊你的名为圣。',
      '愿你的国降临；愿你的旨意行在地上，如同行在天上。',
      '我们日用的饮食，今日赐给我们。',
      '免我们的债，如同我们免了人的债。',
      '不叫我们遇见试探；救我们脱离凶恶。',
      '因为国度、权柄、荣耀，全是你的，直到永远。阿们！',
    ],
  },
  {
    id: 'psalm-23',
    title: '诗篇 23 篇',
    source: '诗篇 23:1-6（和合本）',
    link: { bookId: 'psa', chapter: 23 },
    paragraphs: [
      '耶和华是我的牧者，我必不致缺乏。',
      '他使我躺卧在青草地上，领我在可安歇的水边；他使我的灵魂苏醒，为自己的名引导我走义路。',
      '我虽然行过死荫的幽谷，也不怕遭害，因为你与我同在；你的杖，你的竿，都安慰我。',
      '在我敌人面前，你为我摆设筵席；你用油膏了我的头，使我的福杯满溢。',
      '我一生一世必有恩惠慈爱随着我，我且要住在耶和华的殿中，直到永远。',
    ],
  },
  {
    id: 'morning',
    title: '晨祷',
    source: '灵修伴读 · 原创短文',
    paragraphs: [
      '主啊，新的一天从你而来，我把这一天恭敬地交在你手中。',
      '求你赐我清醒的头脑去工作，柔软的心肠去爱人，坚定的脚步去跟随你。',
      '今天无论遇见顺境还是难处，愿我先想到你，再作决定；先安静祷告，再开口说话。',
      '求你保守我的眼目、言语与心思，使我在小事上忠心，在暗处也正直。',
      '奉主耶稣的名求，阿们。',
    ],
  },
  {
    id: 'evening',
    title: '晚祷',
    source: '灵修伴读 · 原创短文',
    paragraphs: [
      '主啊，这一天将尽，我怀着感恩回到你面前。',
      '谢谢你赐下的饮食、工作与相遇，也谢谢你在我软弱时仍旧扶持。',
      '今天若有得罪你、亏欠人的地方，求你赦免；若有担忧挂念的事，此刻交托给你。',
      '求你看顾我的家人，保守这城这地，使疲乏的人得安息。',
      '愿我在你的平安里安睡，明天醒来，仍然跟随你。奉主耶稣的名求，阿们。',
    ],
  },
];

/** 计时祷告结束后显示的安慰经文（按日轮换） */
export const COMFORT_VERSES: PrayerVerse[] = [
  {
    bookId: 'psa',
    chapter: 46,
    ref: '诗篇 46:10',
    text: '你们要休息，要知道我是神！我必在外邦中被尊崇，在遍地上也被尊崇。',
  },
  {
    bookId: 'mat',
    chapter: 11,
    ref: '马太福音 11:28',
    text: '凡劳苦担重担的人，可以到我这里来，我就使你们得安息。',
  },
  {
    bookId: 'phi',
    chapter: 4,
    ref: '腓立比书 4:7',
    text: '神所赐出人意外的平安，必在基督耶稣里保守你们的心怀意念。',
  },
  {
    bookId: 'isa',
    chapter: 41,
    ref: '以赛亚书 41:10',
    text: '你不要害怕，因为我与你同在；不要惊惶，因为我是你的神。我必坚固你，我必帮助你，我必用我公义的右手扶持你。',
  },
  {
    bookId: 'psa',
    chapter: 23,
    ref: '诗篇 23:1',
    text: '耶和华是我的牧者，我必不致缺乏。',
  },
];

/** 按当天日期选一节安慰经文 */
export function comfortVerseOfToday(): PrayerVerse {
  const now = new Date();
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
  return COMFORT_VERSES[dayOfYear % COMFORT_VERSES.length];
}

/* ---------------- 代祷事项清单 ---------------- */

export interface PrayerItem {
  id: string;
  content: string;
  createdAt: number;
  /** 已应允时间；未应允为 null */
  answeredAt: number | null;
}

interface PrayerState {
  items: PrayerItem[];
}

export const prayerStore = createLocalStore<PrayerState>('lingxiu.prayer.v1', { items: [] });

function uid(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function addPrayerItem(content: string) {
  prayerStore.update((s) => ({
    ...s,
    items: [{ id: uid(), content, createdAt: Date.now(), answeredAt: null }, ...s.items],
  }));
}

export function removePrayerItem(id: string) {
  prayerStore.update((s) => ({ ...s, items: s.items.filter((i) => i.id !== id) }));
}

/** 标记/取消「已应允」 */
export function togglePrayerAnswered(id: string) {
  prayerStore.update((s) => ({
    ...s,
    items: s.items.map((i) => (i.id === id ? { ...i, answeredAt: i.answeredAt ? null : Date.now() } : i)),
  }));
}
