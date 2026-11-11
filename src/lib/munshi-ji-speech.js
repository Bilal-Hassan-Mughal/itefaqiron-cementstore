/** Purane munshi jaisi dheemi awaaz — browser TTS only */

export const MUNSHI_SPEECH = {
  preSpeakMs: 1100,
  pauseAfterMs: 2800,
  rateUrdu: { calm: 0.56, fun: 0.6 },
  rateRoman: { calm: 0.62, fun: 0.66 },
  pitch: { calm: 0.78, fun: 0.8 },
  volume: 0.9,
};

/** TTS ke liye: dheemi, wazeh pauses */
export function prepareMunshiSpeechText(text) {
  return String(text || '')
    .replace(/\n+/g, '. ')
    .replace(/[—–]/g, ', ')
    .replace(/[:;]/g, ',')
    .replace(/\s+/g, ' ')
    .trim();
}

function voiceRankMunshi(v) {
  const lang = (v.lang || '').toLowerCase();
  const name = (v.name || '').toLowerCase();
  let score = 0;
  if (lang.startsWith('ur')) score += 90;
  if (lang === 'ur-pk') score += 15;
  if (name.includes('pakistan')) score += 10;
  if (lang.startsWith('hi')) score += 55;
  if (lang.startsWith('en-in') || name.includes('india')) score += 50;
  if (name.includes('male') || name.includes('david') || name.includes('ravi') || name.includes('deep')) score += 18;
  if (name.includes('female') || name.includes('zira') || name.includes('samantha')) score -= 40;
  return score;
}

export function pickUrduVoice() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  const urdu = voices.filter((v) => (v.lang || '').toLowerCase().startsWith('ur'));
  if (!urdu.length) return null;
  return [...urdu].sort((a, b) => voiceRankMunshi(b) - voiceRankMunshi(a))[0];
}

export function pickFallbackSpeechVoice() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  return [...voices].sort((a, b) => voiceRankMunshi(b) - voiceRankMunshi(a))[0] || null;
}

export function pickMunshiVoice() {
  return pickUrduVoice() || pickFallbackSpeechVoice();
}

/** Roman Urdu on screen = Roman in TTS (en-IN / en-GB voices). */
function rankRomanVoice(v) {
  const lang = (v.lang || '').toLowerCase();
  const name = (v.name || '').toLowerCase();
  let score = 0;
  if (lang === 'en-in') score += 100;
  if (lang.startsWith('en-gb')) score += 85;
  if (lang.startsWith('en-')) score += 70;
  if (lang.startsWith('hi')) score += 40;
  if (name.includes('male') || name.includes('ravi') || name.includes('david')) score += 15;
  if (name.includes('female') || name.includes('zira')) score -= 25;
  return score;
}

export function pickMunshiRomanVoice() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  const ranked = [...voices].sort((a, b) => rankRomanVoice(b) - rankRomanVoice(a));
  return ranked.find((v) => (v.lang || '').toLowerCase().startsWith('en')) || ranked[0] || null;
}

export function speechTextFromLine(entry) {
  const roman = (entry?.sayRoman || entry?.text || entry?.say || '').trim();
  return prepareMunshiSpeechText(roman);
}

export function speechRomanFromChatReply(entry) {
  const roman = (entry?.sayRoman || entry?.text || '').trim();
  return prepareMunshiSpeechText(roman);
}

export function estimateSpeechMs(sayText, fun, _urVoice) {
  const words = (sayText || '').trim().split(/\s+/).filter(Boolean).length;
  const rate = fun ? MUNSHI_SPEECH.rateRoman.fun : MUNSHI_SPEECH.rateRoman.calm;
  const wpm = 108 * rate;
  const speech = words > 0 ? (words / wpm) * 60 * 1000 : 4000;
  return Math.max(3500, speech);
}
