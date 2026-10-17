'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { BookOpen, ExternalLink, LayoutDashboard, Menu, Radio, X } from 'lucide-react';

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return <header className="site-header">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <div className="nav wrap">
      <Link href="/" className="brand" aria-label="AccessLease dashboard" onClick={() => setOpen(false)}>
        <span className="brand-mark" aria-hidden="true">A<span className="brand-dot">.</span></span>
        <span>accesslease</span><span className="brand-version">/ alpha</span>
      </Link>
      <div className="nav-right">
        <span className="network-indicator"><Radio className="network-icon" aria-hidden="true"/> Arkiv · Tiramisu</span>
        <button className="menu-toggle" type="button" aria-label={open ? 'Close navigation' : 'Open navigation'}
          aria-expanded={open} aria-controls="primary-navigation" onClick={() => setOpen(value => !value)}>
          {open ? <X aria-hidden="true"/> : <Menu aria-hidden="true"/>}
        </button>
        <nav id="primary-navigation" className={'primary-navigation' + (open ? ' is-open' : '')} aria-label="Main navigation">
          <Link href="/" aria-current={pathname === '/' ? 'page' : undefined} onClick={() => setOpen(false)}>
            <LayoutDashboard aria-hidden="true"/><span>Dashboard</span>
          </Link>
          <Link href="/docs" aria-current={pathname === '/docs' ? 'page' : undefined} onClick={() => setOpen(false)}>
            <BookOpen aria-hidden="true"/><span>Documentation</span>
          </Link>
          <a href="https://docs.arkiv.network/" target="_blank" rel="noreferrer" onClick={() => setOpen(false)}>
            <span>Arkiv Docs</span><ExternalLink aria-hidden="true"/><span className="sr-only"> (opens in a new tab)</span>
          </a>
        </nav>
      </div>
    </div>
  </header>;
}
