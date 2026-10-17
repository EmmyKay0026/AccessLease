'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Check, Copy, Terminal } from 'lucide-react';

export function CodeBlock({ title, language = 'PowerShell', code }: { title: string; language?: string; code: string }) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'error'>('idle');

  useEffect(() => {
    if (status === 'idle') return;
    const timer = window.setTimeout(() => setStatus('idle'), 2500);
    return () => window.clearTimeout(timer);
  }, [status]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setStatus('copied');
    } catch { setStatus('error'); }
  }

  return <div className="docs-code-block">
    <div className="docs-code-toolbar">
      <div><Terminal aria-hidden="true"/><span>{title}</span><span className="docs-code-language">{language}</span></div>
      <button type="button" onClick={copy} aria-label={'Copy ' + title}>
        {status === 'copied' ? <Check aria-hidden="true"/> : status === 'error' ? <AlertTriangle aria-hidden="true"/> : <Copy aria-hidden="true"/>}
        <span>{status === 'copied' ? 'Copied' : status === 'error' ? 'Select code' : 'Copy'}</span>
      </button>
    </div>
    <pre tabIndex={0} aria-label={title + ' code'}><code>{code}</code></pre>
    <span className="sr-only" role="status" aria-live="polite">
      {status === 'copied' ? title + ' copied to clipboard.' : status === 'error' ? 'Copy unavailable. Select and copy the code manually.' : ''}
    </span>
  </div>;
}
