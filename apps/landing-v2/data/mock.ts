export type Sentiment = 'positive' | 'negative' | 'neutral';

export interface MockReview {
  source: 'Яндекс.Карты' | '2ГИС' | 'Web';
  rating: number;
  text: string;
  author: string;
  sentiment: Sentiment;
}

export const REGISTER_URL = 'https://reputation.generationweb.ru/register';

export const heroReviews: MockReview[] = [
  { source: 'Яндекс.Карты', rating: 2, text: 'Ждали ответа от менеджера три дня, так и не дождались…', author: 'Марина К.', sentiment: 'negative' },
  { source: '2ГИС', rating: 5, text: 'Очень быстро отреагировали на замечание, исправили в тот же день!', author: 'Игорь П.', sentiment: 'positive' },
  { source: 'Web', rating: 3, text: 'В целом нормально, но хотелось бы обратной связи от компании.', author: 'forum.example', sentiment: 'neutral' },
  { source: 'Яндекс.Карты', rating: 1, text: 'Никто не отвечает на отзывы, ощущение что им всё равно.', author: 'Алексей Т.', sentiment: 'negative' },
  { source: '2ГИС', rating: 5, text: 'Спасибо за внимательное отношение и быстрый ответ.', author: 'Ольга Д.', sentiment: 'positive' },
  { source: 'Web', rating: 4, text: 'Хороший сервис, отвечают вежливо и по делу.', author: 'otzyv-site.ru', sentiment: 'positive' },
];

export const marqueeNegative = [
  '«никто не отвечает на отзывы» ★★',
  '«ждём реакции уже неделю» ★',
  '«написал жалобу — тишина» ★★',
  '«поддержка молчит» ★★',
  '«отзыв висит без ответа месяц» ★',
  '«им всё равно на клиентов» ★★',
];

export const marqueePositive = [
  '«ответили за пару минут» ★★★★★',
  '«проблему решили в тот же день» ★★★★★',
  '«приятно, что компания читает отзывы» ★★★★',
  '«быстрая и вежливая реакция» ★★★★★',
  '«вернусь ещё, спасибо за внимание» ★★★★★',
  '«чувствуется забота о репутации» ★★★★',
];

export const inboxRows: MockReview[] = [
  { source: 'Яндекс.Карты', rating: 2, text: 'Долго ждали заказ, персонал не извинился.', author: 'Марина К.', sentiment: 'negative' },
  { source: '2ГИС', rating: 5, text: 'Отличный сервис, всё быстро и вежливо!', author: 'Игорь П.', sentiment: 'positive' },
  { source: 'Web', rating: 3, text: 'Нормально, но есть куда расти.', author: 'forum.example', sentiment: 'neutral' },
  { source: 'Яндекс.Карты', rating: 4, text: 'Хорошее место, вернёмся ещё.', author: 'Ольга Д.', sentiment: 'positive' },
];

export const aiReply = {
  review: inboxRows[0],
  reply: [
    'Марина, здравствуйте! Спасибо, что рассказали о визите.',
    'Нам жаль, что пришлось ждать дольше обычного — это не наш стандарт.',
    'Мы уже разобрали ситуацию с командой смены. Будем рады видеть вас снова —',
    'напишите нам перед визитом, встретим лично и всё исправим.',
  ],
};

export interface Feature {
  title: string;
  desc: string;
  accent: 'electric' | 'amber' | 'teal' | 'rose';
  icon: 'inbox' | 'sparkles' | 'chart' | 'send' | 'users' | 'shield';
  size: 'lg' | 'md';
}

export const features: Feature[] = [
  { title: 'Единый инбокс', desc: 'Отзывы с Яндекс.Карт, 2ГИС и веб-источников — в одной ленте, с фильтрами и статусами.', accent: 'electric', icon: 'inbox', size: 'lg' },
  { title: 'AI-ответы', desc: 'Черновик ответа за секунды — YandexGPT или OpenAI, в тоне вашего бренда.', accent: 'amber', icon: 'sparkles', size: 'md' },
  { title: 'Аналитика', desc: 'Динамика рейтинга и тональности, срезы по источникам и точкам.', accent: 'teal', icon: 'chart', size: 'md' },
  { title: 'Telegram-бот', desc: 'Уведомления о новых отзывах и упоминаниях — сразу в рабочий чат.', accent: 'rose', icon: 'send', size: 'md' },
  { title: 'Воркспейсы', desc: 'Мультитенантность для агентств: клиенты и команды разделены, доступы под контролем.', accent: 'electric', icon: 'users', size: 'lg' },
  { title: 'Оплата через ЮKassa', desc: 'Прозрачный биллинг, оплата картой, закрывающие документы.', accent: 'teal', icon: 'shield', size: 'md' },
];

export const metrics = [
  { value: 24, suffix: '/7', label: 'мониторинг источников' },
  { value: 1, suffix: '', label: 'инбокс для всех отзывов' },
  { value: 2, suffix: ' клика', label: 'от отзыва до ответа с AI' },
];

export interface Plan {
  name: string;
  audience: string;
  price: string;
  bullets: string[];
  highlighted?: boolean;
}

export const plans: Plan[] = [
  {
    name: 'Старт',
    audience: 'Малый бизнес, 1–2 точки',
    price: '890 ₽',
    bullets: ['До 3 компаний', 'Яндекс Карты + 2ГИС', 'Единый Inbox отзывов', '50 AI-ответов в месяц'],
  },
  {
    name: 'Бизнес',
    audience: 'Растущий бизнес и сети',
    price: '1 890 ₽',
    bullets: ['До 10 компаний', 'Все платформы + Web', 'Безлимит AI-ответов', 'Аналитика и Telegram-алерты'],
    highlighted: true,
  },
  {
    name: 'Агентство',
    audience: 'ORM-агентства и франшизы',
    price: '3 990 ₽',
    bullets: ['До 100 компаний', 'Всё из тарифа «Бизнес»', 'До 20 участников команды', 'До 500 источников'],
  },
];
