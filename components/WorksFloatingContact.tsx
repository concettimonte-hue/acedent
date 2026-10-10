'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { MessageCircle, Phone, Smartphone, X } from 'lucide-react';
import naverData from '@/content/naver.json';
import siteData from '@/content/site.json';
import { trackSmsClick, trackTalkClick, trackTelClick } from '@/lib/analytics';
import { withLandingUtm } from '@/lib/tracking';
import { observeWorksContactVisibility } from '@/lib/works-contact';

export default function WorksFloatingContact({ workSlug }: { workSlug?: string }) {
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [mobile, setMobile] = useState(true);
  const [focused, setFocused] = useState(false);
  const [visibility, setVisibility] = useState({ inline: false, collision: false, modal: false });
  const hidden = visibility.modal || (!open && !focused && (visibility.inline || visibility.collision));

  useEffect(() => {
    const media = window.matchMedia('(max-width: 680px)');
    const update = () => setMobile(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    return observeWorksContactVisibility(trigger, (next) => {
      setVisibility(next);
      // An image dialog owns focus; never reopen the contact panel behind it.
      if (next.modal) setOpen(false);
    });
  }, [workSlug]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: globalThis.PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus({ preventScroll: true });
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  const actions = {
    sms: {
      title: '사진 상담', description: '문자로 사진 보내기', icon: Smartphone,
      href: siteData.contact.smsHref,
      track: () => trackSmsClick('works_floating', workSlug),
    },
    tel: {
      title: '전화 문의', description: '전화로 바로 문의', icon: Phone,
      href: siteData.contact.phoneHref,
      track: () => trackTelClick('works_floating', workSlug),
    },
    talk: {
      title: '네이버 톡톡', description: '톡톡으로 문의', icon: MessageCircle,
      href: withLandingUtm(naverData.talk, 'work_detail'),
      track: () => trackTalkClick('works_floating', naverData.talk, workSlug),
    },
  };
  const order = mobile ? ['sms', 'tel', 'talk'] as const : ['talk', 'tel', 'sms'] as const;

  return (
    <div
      ref={rootRef}
      className="works-floating-contact"
      data-hidden={hidden}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setFocused(false);
          setOpen(false);
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        className="works-contact-trigger"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? '상담 방법 닫기' : '상담 방법 열기'}
        onClick={() => setOpen((current) => !current)}
      >
        {open ? <X aria-hidden="true" /> : <MessageCircle aria-hidden="true" />}
        <span>{open ? '닫기' : '상담'}</span>
      </button>
      <nav id={panelId} className="works-contact-panel" aria-label="빠른 수리 상담" hidden={!open}>
        <p>편한 방법으로 문의하세요</p>
        {order.map((method, index) => {
          const action = actions[method];
          const Icon = action.icon;
          return (
            <a
              key={method}
              href={action.href}
              className={index === 0 ? 'is-primary' : undefined}
              target={method === 'talk' ? '_blank' : undefined}
              rel={method === 'talk' ? 'noopener noreferrer' : undefined}
              onClick={() => {
                action.track();
                setOpen(false);
                triggerRef.current?.focus({ preventScroll: true });
              }}
            >
              <Icon aria-hidden="true" />
              <span><strong>{action.title}</strong><small>{action.description}</small></span>
            </a>
          );
        })}
      </nav>
    </div>
  );
}
