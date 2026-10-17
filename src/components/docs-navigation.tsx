'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BookOpen, ChevronDown, List, ShieldCheck } from 'lucide-react';

export const DOC_SECTIONS = [
  { id: 'introduction', label: 'Introduction', number: '01' },
  { id: 'how-it-works', label: 'How it works', number: '02' },
  { id: 'architecture', label: 'System architecture', number: '03' },
  { id: 'security-model', label: 'Security model', number: '04' },
  { id: 'demo-guide', label: 'Demo guide', number: '05' },
  { id: 'developers', label: 'Developer setup', number: '06' },
  { id: 'limitations', label: 'Limitations & FAQ', number: '07' },
] as const;

export function DocsNavigation() {
  const [active, setActive] = useState<string>('introduction');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const sections = DOC_SECTIONS.map(section => document.getElementById(section.id)).filter((section): section is HTMLElement => section !== null);
    let frame = 0;
    const update = () => {
      frame = 0;
      let current = sections[0]?.id ?? 'introduction';
      for (const section of sections) {
        if (section.getBoundingClientRect().top <= 140) current = section.id;
      }
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 8) current = 'limitations';
      setActive(current);
    };
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    window.addEventListener('hashchange', schedule);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('hashchange', schedule);
    };
  }, []);

  return <aside className="docs-sidebar">
    <button className="docs-mobile-toggle" type="button" aria-expanded={open} aria-controls="docs-section-links" onClick={() => setOpen(value => !value)}>
      <List aria-hidden="true"/><span>On this page</span>
      <span className="docs-current-section">{DOC_SECTIONS.find(section => section.id === active)?.label}</span>
      <ChevronDown className={open ? 'is-rotated' : ''} aria-hidden="true"/>
    </button>
    <div id="docs-section-links" className={'docs-sidebar-content' + (open ? ' is-open' : '')}>
      <div className="docs-sidebar-label"><BookOpen aria-hidden="true"/> THE FIELD GUIDE</div>
      <nav aria-label="Documentation sections">
        {DOC_SECTIONS.map(section => <a key={section.id} href={'#' + section.id}
          aria-current={active === section.id ? 'location' : undefined}
          onClick={() => { setActive(section.id); setOpen(false); }}>
          <span className="docs-nav-number">{section.number}</span>{section.label}
        </a>)}
      </nav>
      <div className="docs-sidebar-note"><ShieldCheck aria-hidden="true"/><span>Verify every grant.<br/>Trust no expired lease.</span></div>
      <Link className="docs-back-link" href="/">Open the live demo <ArrowRight aria-hidden="true"/></Link>
    </div>
  </aside>;
}
