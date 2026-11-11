/**
 * Local intent “training” — keyword packs only, no ML/API.
 * Naye staff ke bolne ke andaaz yahan keywords se add hotay hain.
 */

export const MUNSHI_INTENT_KEYWORDS = {
  self: [
    'tum kaun',
    'aap kaun',
    'ap kon',
    'who are',
    'munshi ji',
    'munshi',
    'khud',
    'about you',
    'kaam kya',
    'kya ho',
    'robot',
    'تم کون',
    'آپ کون',
    'کون ہو',
    'منشی',
  ],
  help: [
    'madad',
    'help',
    'kya kar',
    'samjhao',
    'train',
    'sikh',
    'seekh',
    'bol sakte',
    'pooch sakte',
    'kya pooch',
    'guide',
    'کیا کہوں',
    'مدد',
  ],
  greet: ['salam', 'assalam', 'hello', 'hi', 'adaab', 'سلام', 'السلام', 'صبح', 'شام'],
  list_all: [
    'sab naam',
    'saab naam',
    'tamam naam',
    'sab ka naam',
    'sab ke naam',
    'poori fehrist',
    'poori list',
    'puri list',
    'full list',
    'kon kon',
    'kaun kaun',
    'kin kin',
    'reminder kon',
    'yaad dahani kin',
    'bhejne wale',
    'bhejna hai',
    'نام',
    'سب',
    'فہرست',
    'کون کون',
    'بتاؤ',
    'batao',
    'bata do',
    'dikhao',
    'show list',
    'names',
    'بتاؤ',
    'بتادو',
    'بتا',
    'مجھے',
    'مجھے سب',
    'ریماینڈر',
    'reminder',
    'yaad dahani',
    'detail mein',
    'detail',
    'mukammal',
    'poori list detail',
    'list detail',
  ],
  sent_today: [
    'bhej chuke',
    'bhej diya',
    'sent',
    'ho chuka',
    'chuke hain',
    'mark',
    'bheja hua',
    'bheje hue',
    'already sent',
    'کتنے بھیج',
    'بھیج چکے',
    'بھیج دیا',
  ],
  count_pending: [
    'kitne baqi',
    'kitne baki',
    'kitne customer',
    'kitne hain',
    'count',
    'pending kitne',
    'کتنے',
    'باقی',
    'تعداد',
  ],
  due_today: [
    'aaj ka wada',
    'aaj ki tareekh',
    'due today',
    'aaj wale',
    'آج کا وعدہ',
    'آج کی تاریخ',
  ],
  rolled: ['purana', 'purane', 'rolled', 'carry', 'pechay', 'puranay', 'پرانا', 'پرانے'],
  total_amount: ['kul raqam', 'kul bqaya', 'total amount', 'kitna paisa', 'sum', 'کل رقم', 'کل بقایا'],
  next_customer: ['agla', 'agle', 'next', 'pehla', 'first customer', 'پہلا', 'اگلا'],
  summary: ['khulasa', 'summary', 'short', 'ek nazr', 'overview', 'mukhtasar', 'حاصل'],
  highest: ['sab se zyada', 'zyada raqam', 'highest', 'bara amount', 'max', 'سب سے زیادہ'],
  lowest: ['kam raqam', 'lowest', 'chota amount', 'min', 'سب سے کم'],
  whatsapp_how: ['whatsapp', 'kholo', 'fehrist khol', 'queue', 'kaise bhej', 'کیسے بھیجیں'],
  thanks: ['shukriya', 'thanks', 'thank', 'جزاک'],
  refresh: ['taaza', 'update', 'refresh', 'naya data', 'dobara load'],
};

/** Example sentences staff can copy (training catalog). */
export const MUNSHI_TRAIN_EXAMPLES = [
  'Mujhe sab customers ke naam batao jo bhejne hain',
  'Poori fehrist detail mein',
  'Kitne customer baqi hain aur kul raqam?',
  'Aaj ka wada kin kin ka hai?',
  'Purane rolled waday kaun hain?',
  'Agla customer detail se',
  'Aaj kin ko WhatsApp bhej chuke?',
  'Sab se zyada bqaya kis ka hai?',
  '[Customer naam] ka balance aur wada',
  'Munshi ji tum kaun ho',
];

export function detectMunshiIntent(raw) {
  const q = normIntentText(raw);
  if (!q) return 'empty';

  const scores = {};
  for (const [intent, keywords] of Object.entries(MUNSHI_INTENT_KEYWORDS)) {
    let score = 0;
    for (const kw of keywords) {
      const k = normIntentText(kw);
      if (!k) continue;
      if (q === k) score += 12;
      else if (q.includes(k)) score += k.length >= 6 ? 4 : 2;
    }
    scores[intent] = score;
  }

  if (isLikelyNameLookup(q, scores)) return 'account_lookup';

  let best = 'unknown';
  let bestScore = 2;
  for (const [intent, s] of Object.entries(scores)) {
    if (s > bestScore) {
      bestScore = s;
      best = intent;
    }
  }

  if (best === 'list_all' && includesSentCue(q)) return 'sent_today';
  if (best === 'unknown' && includesListCue(q)) return 'list_all';

  return best;
}

function includesSentCue(q) {
  return ['chuke', 'chuka', 'bhej di', 'sent', 'بھیج چک'].some((w) => q.includes(w));
}

function includesAny(text, list) {
  return list.some((w) => text.includes(w));
}

export function includesListCue(q) {
  return [
    'naam',
    'name',
    'list',
    'fehrist',
    'نام',
    'سب',
    'کون',
    'poori',
    'puri',
    'detail',
    'sab',
    'tamam',
    'mukammal',
    'batao',
    'bata',
  ].some((w) => q.includes(w));
}

function isLikelyNameLookup(q, scores) {
  if (scores.list_all >= 3 || scores.help >= 4) return false;
  if (includesListCue(q) || includesAny(q, ['detail', 'poori', 'puri', 'fehrist', 'list', 'sab', 'tamam', 'batao', 'bata'])) {
    return false;
  }
  const words = q.split(/\s+/).filter((w) => w.length > 2);
  const stop = new Set([
    'the',
    'aur',
    'ka',
    'ki',
    'ke',
    'ko',
    'se',
    'main',
    'mujhe',
    'batao',
    'kya',
    'hai',
    'what',
    'customer',
    'gahak',
  ]);
  const meaningful = words.filter((w) => !stop.has(w));
  return meaningful.length >= 1 && meaningful.length <= 4 && scores.list_all < 3;
}

export function normIntentText(raw) {
  return String(raw || '')
    .toLowerCase()
    .replace(/[^\w\s\u0600-\u06ff]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
