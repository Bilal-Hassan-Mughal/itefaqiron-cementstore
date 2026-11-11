/**
 * Munshi Ji — local brain (no API). Uses detectMunshiIntent + queue context.
 */
import {
  MUNSHI_TRAIN_EXAMPLES,
  detectMunshiIntent,
  includesListCue,
  normIntentText,
} from '@/lib/munshi-ji-intents';

function includesAny(text, list) {
  return list.some((w) => text.includes(w));
}

function pack(text, say, sayRoman, fun = false) {
  const lines = String(text || '').split('\n');
  const short =
    lines[0].length > 200 ? `${lines[0].slice(0, 197)}…` : lines.slice(0, 2).join(' ');
  return { text, say: say || short, sayRoman: sayRoman || short, fun };
}

export const MUNSHI_QUICK_PROMPTS = [
  { label: 'Sab naam', send: 'Mujhe sab customers ke naam batao jo bhejne hain' },
  { label: 'Khulasa', send: 'Aaj ka khulasa batao' },
  { label: 'Poori fehrist', send: 'Poori list detail mein batao' },
  { label: 'Kitne baqi', send: 'Kitne customer baqi hain aur kul raqam' },
  { label: 'Aaj wada', send: 'Aaj ka wada kin kin ka hai' },
  { label: 'Purane', send: 'Purane rolled waday kaun hain' },
  { label: 'Bheja?', send: 'Aaj kin ko message bhej chuke hain' },
  { label: 'Agla', send: 'Agla customer kaun hai detail se' },
  { label: 'Zyada raqam', send: 'Sab se zyada bqaya kis customer ka hai' },
  { label: 'Madad', send: 'Munshi madad karo kya bol sakta hai' },
];

const SELF_INTRO =
  'Main Munshi Ji hoon — Ittefaq store ka hisaab wala robot. Internet par koi AI nahin; sirf is dashboard ki aaj ki wada yaad dahani fehrist se bolta hoon.';

export function munshiLocalReply(userText, ctx) {
  const q = normIntentText(userText);
  const intent = detectMunshiIntent(userText);

  if (!q || intent === 'empty') {
    return pack('Kuch likhein, mic use karein, ya neeche button chunein.', null, null);
  }

  let resolvedIntent = intent;
  const byName = intent === 'account_lookup' ? findAccountByQuery(q, ctx) : null;
  if (byName) return formatOneAccount(byName, ctx);
  if (intent === 'account_lookup' && includesListCue(q)) resolvedIntent = 'list_all';

  switch (resolvedIntent) {
    case 'self':
      return formatSelf(ctx);
    case 'help':
      return formatHelp(ctx);
    case 'greet':
      return pack(`Wa Alaikum Assalam, baas ji.\n${formatSummary(ctx)}`, null, `Wa Alaikum Assalam. ${speakSummary(ctx)}`, true);
    case 'list_all':
      return formatPendingList(ctx, wantsFullDetail(q));
    case 'sent_today':
      return formatSentList(ctx);
    case 'count_pending':
      return formatCountPending(ctx);
    case 'due_today':
      return formatDueTodayAccounts(ctx);
    case 'rolled':
      return formatRolled(ctx);
    case 'total_amount':
      return formatTotal(ctx);
    case 'next_customer':
      return ctx?.nextAccount
        ? formatOneAccount(ctx.nextAccount, ctx)
        : pack('Agla customer fehrist mein nahin.', null, 'Agla customer nahin.');
    case 'summary':
      return pack(formatSummary(ctx), null, speakSummary(ctx));
    case 'highest':
      return formatExtremeAccount(ctx, 'high');
    case 'lowest':
      return formatExtremeAccount(ctx, 'low');
    case 'whatsapp_how':
      return pack(
        'Robot (neeche) par ek tap — fehrist khulti hai. Wahan Urdu paigham tayyar hota hai, WhatsApp khulta hai.\nMain yahan sirf data batata hoon.',
        null,
        'Robot tap karein, fehrist se WhatsApp bhejein.',
      );
    case 'thanks':
      return pack('Khush raho baas ji. Jab chahein phir pooch lena.', null, 'Khush raho baas ji.', true);
    case 'refresh':
      return pack(
        'Data har minute khud taaza hota hai jab fehrist load ho. Agar kuch missing ho to poori fehrist khol kar Refresh dabayein.',
        null,
        'Data auto refresh hota hai.',
      );
    default: {
      const fallback = findAccountByQuery(q, ctx);
      if (fallback) return formatOneAccount(fallback, ctx);
      return pack(
        `Mujhe yeh samajh nahin aaya — fehrist se related kuch aur pooch lein.\n\n${hintLine()}`,
        null,
        'Sirf fehrist data. Madad likhein ya button dabayein.',
      );
    }
  }
}

function hintLine() {
  return 'Jaise: "sab naam", "khulasa", "kitne baqi", "aaj wada", "agla customer".';
}

function wantsFullDetail(q) {
  return includesAny(q, ['poori', 'puri', 'detail', 'full', 'mukammal', 'tamam', 'sab kuch']);
}

function formatSelf(ctx) {
  return pack(
    `${SELF_INTRO}\n\n${formatSummary(ctx)}`,
    'میں منشی جی ہوں، مقامی فہرست سے بات کرتا ہوں۔',
    `${SELF_INTRO} ${speakSummary(ctx)}`,
    true,
  );
}

function formatHelp() {
  const examples = MUNSHI_TRAIN_EXAMPLES.map((line, i) => `${i + 1}. ${line}`).join('\n');
  return pack(
    `${SELF_INTRO}\n\nAap yeh keh sakte hain (copy bhi kar sakte hain):\n${examples}`,
    null,
    'Main fehrist ke naam, raqam, wada, bheja hua, agla customer bata sakta hoon.',
  );
}

function formatCountPending(ctx) {
  if (!ctx?.readyCount) {
    return pack('Fehrist khali — koi pending yaad dahani nahin.', null, 'Koi baqi nahin.');
  }
  return pack(
    `Baqi: ${ctx.readyCount} customer.\nKul bqaya: ${ctx.totalPendingAmountLabel}.\nBheje: ${ctx.sentTodayCount ?? 0}.\nAaj wada: ${ctx.dueToday ?? 0}.\nPurane rolled: ${ctx.carryOver ?? 0}.`,
    null,
    `${ctx.readyCount} customer baqi, kul ${ctx.totalPendingAmountLabel}.`,
  );
}

function formatSummary(ctx) {
  const d = ctx?.todayLabel ? `Tareekh: ${ctx.todayLabel}` : '';
  const lines = [
    d,
    `Pending WhatsApp: ${ctx?.readyCount ?? 0} customer`,
    `Kul bqaya: ${ctx?.totalPendingAmountLabel ?? 'Rs. 0'}`,
    `Aaj wada tareekh: ${ctx?.dueToday ?? 0}`,
    `Purane rolled: ${ctx?.carryOver ?? 0}`,
    `Aaj bhej chuke: ${ctx?.sentTodayCount ?? 0}`,
    ctx?.nextAccount ? `Agla: ${ctx.nextAccount.name} (${ctx.nextAccount.amountLabel})` : null,
  ].filter(Boolean);
  return lines.join('\n');
}

function speakSummary(ctx) {
  return `Pending ${ctx?.readyCount ?? 0}, kul ${ctx?.totalPendingAmountLabel ?? 'zero'}.`;
}

function formatTotal(ctx) {
  return pack(
    `Kul bqaya (pending): ${ctx?.totalPendingAmountLabel ?? 'Rs. 0'} — ${ctx?.readyCount ?? 0} customer par.`,
    null,
    `Kul bqaya ${ctx?.totalPendingAmountLabel}.`,
  );
}

function formatDueTodayAccounts(ctx) {
  const list = ctx?.dueTodayAccounts?.length ? ctx.dueTodayAccounts : [];
  const n = ctx?.dueToday ?? list.length;
  if (!n && !list.length) {
    return pack('Aaj kisi ki wada tareekh due nahin (jo baqi hain purane ho sakte hain).', null, 'Aaj wada due nahin.');
  }
  const body = list.length ? nameAmountLines(list, 20) : '(Naam ke liye "sab naam" pooch lein.)';
  return pack(`Aaj wada tareekh (${n}):\n${body}`, null, `Aaj ${n} wadon ki tareekh.`);
}

function formatRolled(ctx) {
  const rolled = (ctx?.pending || []).filter((a) => a.carriedOver);
  if (!rolled.length) return pack('Koi purana rolled wada nahin.', null, 'Koi purana nahin.');
  return pack(`Purane rolled (${rolled.length}):\n${nameAmountLines(rolled, 20)}`, null, `${rolled.length} puranay waday.`);
}

function formatExtremeAccount(ctx, mode) {
  const list = ctx?.pending || [];
  if (!list.length) return pack('Fehrist khali hai.', null, 'Khali fehrist.');
  const sorted = [...list].sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));
  const acc = mode === 'high' ? sorted[0] : sorted[sorted.length - 1];
  const label = mode === 'high' ? 'Sab se zyada bqaya' : 'Sab se kam bqaya';
  return pack(`${label}:\n${accountBlock(acc)}`, null, `${acc.name}, ${acc.amountLabel}.`);
}

function accountBlock(acc) {
  return [
    `Naam: ${acc.name}`,
    `Wada: ${acc.promisedDate}`,
    `Balance: ${acc.amountLabel}`,
    acc.carriedOver ? 'Rolled: Haan' : 'Rolled: Nahin',
    acc.note ? `Note: ${acc.note}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

function nameAmountLines(accounts, max = 15) {
  return accounts
    .slice(0, max)
    .map((a, i) => {
      const tag = a.carriedOver ? ' [rolled]' : '';
      const note = a.note ? ` · Note: ${a.note.slice(0, 40)}` : '';
      return `${i + 1}. ${a.name} — Wada ${a.promisedDate} — ${a.amountLabel}${tag}${note}`;
    })
    .join('\n');
}

function formatPendingList(ctx, fullDetail) {
  const list = ctx?.pending || [];
  if (!list.length) return pack('Abhi koi customer bhejne baqi nahin.', null, 'Koi baqi nahin.');
  const head = `Bhejne wali fehrist (${list.length}):`;
  const body = nameAmountLines(list, fullDetail ? 30 : 18);
  const tail = list.length > 18 && !fullDetail ? '\n\nPoori detail: "poori fehrist detail" likhein.' : '';
  const text = `${head}\n${body}${tail}`;
  return pack(text, `فہرست میں ${list.length} گاہک۔`, `Fehrist mein ${list.length} customer, pehla ${list[0]?.name}.`);
}

function formatSentList(ctx) {
  const list = ctx?.sent || [];
  if (!list.length) {
    return pack('Aaj abhi kisi ko "sent" mark nahi dikhta.', null, 'Aaj koi sent record nahin.');
  }
  const lines = list.slice(0, 25).map((a, i) => `${i + 1}. ${a.name} — ${a.amountLabel} — bheja: ${a.sentAt || '—'}`);
  return pack(`Aaj bheje hue (${list.length}):\n${lines.join('\n')}`, null, `Aaj ${list.length} ko bhej chuke.`);
}

function formatOneAccount(acc) {
  if (!acc) return pack('Naam fehrist mein nahin mila.', null, 'Naam nahin mila.');
  const text = accountBlock(acc);
  const extra = acc.pending
    ? '\nWhatsApp: Abhi bhejna baqi — robot tap se fehrist kholen.'
    : `\nWhatsApp: Bhej chuke (${acc.sentAt || '—'}).`;
  return pack(`${text}${extra}`, null, `${acc.name}, ${acc.amountLabel}, wada ${acc.promisedDate}.`);
}

function findAccountByQuery(q, ctx) {
  const all = [...(ctx?.pending || []), ...(ctx?.sent || [])];
  if (!all.length) return null;

  let best = null;
  let bestScore = 0;
  for (const a of all) {
    const n = normIntentText(a.name);
    if (!n) continue;
    let score = 0;
    if (q.includes(n)) score += 20;
    const parts = n.split(/\s+/).filter((p) => p.length > 2);
    for (const p of parts) {
      if (q.includes(p)) score += p.length;
    }
    if (score > bestScore) {
      bestScore = score;
      best = a;
    }
  }
  return bestScore >= 3 ? best : null;
}

export function munshiUserDisplayText(raw) {
  const t = String(raw || '').trim();
  if (!/[\u0600-\u06ff]/.test(t)) return t;
  const intent = detectMunshiIntent(t);
  const map = {
    list_all: 'Sab customers ke naam (bhejne wali list)',
    sent_today: 'Aaj kin ko message bhej chuke?',
    self: 'Munshi Ji, tum kaun ho?',
    count_pending: 'Kitne customer baqi hain?',
    due_today: 'Aaj ka wada kin ka hai?',
    summary: 'Aaj ka khulasa',
    help: 'Madad / kya bol sakte ho?',
    greet: 'Salam / greeting',
    account_lookup: 'Kisi customer ka naam / detail',
  };
  return map[intent] || 'Sawal (fehrist data)';
}
