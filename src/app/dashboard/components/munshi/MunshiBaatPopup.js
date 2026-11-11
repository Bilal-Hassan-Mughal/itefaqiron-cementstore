'use client';

import MunshiPopupFrame from './MunshiPopupFrame';
import MunshiChatPanel from './MunshiChatPanel';
import { MUNSHI_BAAT_ROMAN } from '@/lib/munshi-intro-roman';

export default function MunshiBaatPopup({ style, onClose, name, chatProps }) {
  return (
    <MunshiPopupFrame
      title="Baat — Munshi Ji"
      subtitle="Roman Urdu · sirf fehrist data"
      accent="slate"
      style={style}
      onClose={onClose}
      connector="right"
    >
      <p className="shrink-0 text-[10px] font-medium text-slate-600 px-3 py-2 border-b border-slate-100 bg-slate-50 leading-relaxed">
        {MUNSHI_BAAT_ROMAN}
      </p>
      <MunshiChatPanel {...chatProps} name={name} hideHeader />
    </MunshiPopupFrame>
  );
}
