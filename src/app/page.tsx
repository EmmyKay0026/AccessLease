'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Ban, ChevronRight, Clock3, Ellipsis, Fingerprint, LoaderCircle, LockKeyhole, Radio, RefreshCw, ScanLine, ShieldCheck, ShieldX, Sparkles, Wallet as WalletIcon } from 'lucide-react';
import { labels, GatewayError, safeError } from '@/lib/feedback';
import { discoverWallets, recipient, watchWallet, type Wallet } from '@/lib/wallet';
import { runAccessAction, stageLabels, type AccessStage } from '@/lib/access-client';
import { requestData } from '@/lib/client-http';
import type { Resource } from '@/lib/policy';

type Config = { trustedIssuer: string | null; chain: string; chainId: number; validKey: string | null; forgedKey: string | null };
type Result = { decision?: { allowed: boolean; reason: string }; allowed?: boolean; reason?: string; error?: string;
  creator?: string; subject?: string; resource?: string; deadlineMs?: number; expiresAtBlock?: string; data?: string };
const short = (v?: string | null) => v && v.length > 16 ? `${v.slice(0, 9)}…${v.slice(-6)}` : v || 'Not configured';
export default function Home() {
  const [config, setConfig] = useState<Config | null>(null);
  const [key, setKey] = useState('');
  const [resource, setResource] = useState<Resource>('vault-demo');
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState('');
  const [error, setError] = useState('');
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [walletId, setWalletId] = useState('');
  const [account, setAccount] = useState('');
  const [stage, setStage] = useState<AccessStage>('idle');
  const activeRequest = useRef<AbortController | null>(null);
  const wallet = wallets.find(w => w.id === walletId);
  useEffect(() => discoverWallets(window, setWallets), []);
  useEffect(() => {
    return () => activeRequest.current?.abort(new GatewayError('request_cancelled'));
  }, []);
  useEffect(() => {
    setAccount('');
    if (!wallet) return;
    return watchWallet(wallet.provider, accounts => {
      let next = '';
      try { next = recipient(accounts); } catch { /* locked or disconnected */ }
      setAccount(next); setResult(null);
      if (!activeRequest.current) { setStage('idle'); setError(next ? labels.account_changed : labels.wallet_disconnected); }
    }, () => {
      setAccount(''); setResult(null);
      activeRequest.current?.abort(new GatewayError('wallet_disconnected'));
      if (!activeRequest.current) { setStage('idle'); setError(labels.wallet_disconnected); }
    });
  }, [wallet]);
  useEffect(() => {
    const controller = new AbortController();
    requestData<Config>('/api/config', {}, controller.signal).then((v: Config) => {
      setConfig(v); if (v.validKey) setKey(current => current || v.validKey || '');
    }).catch(() => { if (!controller.signal.aborted) setError('Unable to load network configuration'); });
    return () => controller.abort();
  }, []);
  async function verify(sample?: string) {
    const target = sample ?? key;
    setKey(target); setBusy(true); setAction('verify'); setError(''); setResult(null);
    try {
      const data = await requestData<Result>(`/api/verify?key=${encodeURIComponent(target)}&resource=${encodeURIComponent(resource)}`); setResult(data);
      if (data.error) setError(labels[data.reason || data.decision?.reason || ''] || 'Verification service unavailable.');
    } catch (e) { setError(safeError(e)); }
    finally { setBusy(false); }
  }
  async function discover() {
    setBusy(true); setError(''); setResult(null); setAction('discover');
    try {
      const data = await requestData<{ leases?: {key: string; resource: string}[] }>('/api/discover', {}, undefined, async response => {
        if (!response.ok) throw new GatewayError('arkiv_unavailable');
        return response.json();
      });
      if (!data.leases?.length) throw new GatewayError('not_found');
      const sample = data.leases[0];
      setKey(sample.key);
      if (sample.resource === 'vault-demo' || sample.resource === 'analytics-demo') setResource(sample.resource);
    } catch (e) { setError(safeError(e)); }
    finally { setBusy(false); }
  }
  async function access() {
    if (activeRequest.current) return;
    const controller = new AbortController();
    activeRequest.current = controller;
    setAction('access');
    try {
      await runAccessAction({ wallet, key, resource, origin: window.location.origin, controller }, {
        busy: setBusy, stage: setStage, result: setResult, error: setError, account: setAccount,
      });
    } finally { activeRequest.current = null; setBusy(false); }
  }
  const permitted = result?.decision?.allowed ?? result?.allowed;
  const reason = result?.decision?.reason ?? result?.reason;
  const accessBusy = busy && action === 'access';
  return <div className="app-shell">
    <main className="wrap" id="main-content">
      <section className="hero">
        <div className="eyebrow"><span className="eyebrow-line"/>SECURITY INFRASTRUCTURE / 001</div>
        <h1>Trust the proof.<br/><em>Not the permission.</em></h1>
        <p>Time-bound access that must prove itself. AccessLease verifies every grant against Arkiv&apos;s on-chain creator, immutable scope, and expiry — on every request.</p>
        <div className="hero-meta"><span>AUTHENTIC</span><span>SCOPED</span><span>EXPIRING</span><span>FAIL-CLOSED</span></div>
      </section>
      <section className="overview" aria-label="Network and security overview">
        <div><span className="mini-label">NETWORK</span><strong>7738577</strong><small>Tiramisu testnet</small></div>
        <div><span className="mini-label">TRUSTED ISSUER</span><strong title={config?.trustedIssuer || ''}>{short(config?.trustedIssuer)}</strong><small>verified via $creator</small></div>
        <div><span className="mini-label">ENFORCEMENT</span><strong>Live checks</strong><small>no cached authorization</small></div>
        <div><span className="mini-label">PROTECTED DATA</span><strong>Synthetic only</strong><small>safe for public demos</small></div>
      </section>
      <section className="workspace">
        <div className="workspace-title">
          <div><span className="section-num">01 / ACCESS GATEWAY</span><h2>Verify an authorization</h2><p>Inspect a live Arkiv lease or authenticate with a wallet to unlock a synthetic protected resource.</p></div>
          <span className="live-pill"><Radio aria-hidden="true"/> LIVE CHAIN READ</span>
        </div>
        <div className="workspace-grid">
          <div className="form-side">
            <label htmlFor="key">ARKIV ENTITY KEY</label>
            <input id="key" disabled={busy} value={key} onChange={e => { setKey(e.target.value); setResult(null); setError(''); setStage('idle'); }} placeholder="0x..." spellCheck={false}/>
            <div className="sample-controls">
              <span>Example records</span>
              <button type="button" disabled={!config?.validKey || busy} onClick={() => config?.validKey && verify(config.validKey)}>Trusted lease <ChevronRight aria-hidden="true"/></button>
              <button type="button" disabled={!config?.forgedKey || busy} onClick={() => config?.forgedKey && verify(config.forgedKey)}>Forged lease <ChevronRight aria-hidden="true"/></button>
              <button type="button" disabled={busy} onClick={discover}>Discover live {busy && action === 'discover' ? <span className="icon-spin"><LoaderCircle aria-hidden="true"/></span> : <RefreshCw aria-hidden="true"/>}</button>
            </div>
            <label htmlFor="resource">REQUESTED RESOURCE</label>
            <select id="resource" disabled={busy} value={resource} onChange={e => { setResource(e.target.value as Resource); setResult(null); setStage('idle'); setError(''); }}>
              <option value="vault-demo">Incident response vault</option><option value="analytics-demo">Operational analytics</option>
            </select>
            <div className="wallet-controls">
              <label htmlFor="wallet"><WalletIcon aria-hidden="true"/> SIGN WITH WALLET</label>
              <select id="wallet" disabled={busy} value={walletId} onChange={e => { setWalletId(e.target.value); setResult(null); setError(''); setStage('idle'); }}>
                <option value="">Select MetaMask</option>
                {wallets.map(w => <option key={w.id} value={w.id} disabled={!w.supported}>{w.name}{w.supported ? ' (MetaMask)' : ' - unsupported'}</option>)}
              </select>
              <small>{account ? 'Connected recipient: ' + short(account) : 'Choose the MetaMask extension for this request.'}</small>
            </div>
            <div className="actions">
              <button className="primary" onClick={() => verify()} disabled={busy || !key}>
                {busy && action === 'verify' ? <span className="icon-spin"><LoaderCircle aria-hidden="true"/></span> : <ShieldCheck aria-hidden="true"/>}
                <span>{busy && action === 'verify' ? 'Verifying…' : 'Verify lease'}</span>
                {busy && action === 'verify' ? null : <ChevronRight aria-hidden="true"/>}
              </button>
              <button className="secondary" onClick={access} disabled={busy || !key || !wallet?.supported}>
                {accessBusy ? <span className="icon-spin"><LoaderCircle aria-hidden="true"/></span> : <WalletIcon aria-hidden="true"/>}
                <span>{accessBusy ? stageLabels[stage] + '…' : 'Request access'}</span>
                {accessBusy ? null : <ArrowRight aria-hidden="true"/>}
              </button>
            </div>
            <p className="access-status" role="status" aria-live="polite">{action === 'access' ? stageLabels[stage] : ''}</p>
            <p className="hint">Wallet signatures are required only to retrieve protected synthetic data. Public verification needs no wallet.</p>
          </div>
          <div className="result-side" aria-busy={busy}>
            <div className="result-header"><span>VERIFICATION OUTPUT</span><Ellipsis aria-hidden="true"/></div>
            {!result && !error ? <div className="empty-output">
              <div className="empty-icon"><ScanLine aria-hidden="true"/></div>
              <h3>Awaiting verification</h3><p>Submit an entity key to check the issuer, record immutability, resource scope, and deadline against Arkiv.</p>
            </div> : <div className="filled-output">
              <div className={'decision ' + (permitted ? 'grant' : 'deny')}>
                <span className="decision-symbol">{permitted ? <ShieldCheck aria-hidden="true"/> : <ShieldX aria-hidden="true"/>}</span>
                <div><span>{permitted ? 'CHECK PASSED' : 'ACCESS DENIED'}</span><strong>{permitted ? (result?.data ? 'Access granted' : 'Permission verified') : 'Verification failed'}</strong></div>
              </div>
              <p role={error ? 'alert' : undefined}>{error || labels[reason || ''] || 'No decision returned.'}</p>
              {result?.creator && <div className="output-row"><span>On-chain creator</span><code>{short(result.creator)}</code></div>}
              {result?.subject && <div className="output-row"><span>Authorized subject</span><code>{short(result.subject)}</code></div>}
              {result?.deadlineMs && <div className="output-row"><span>Fixed deadline</span><code>{new Date(result.deadlineMs).toLocaleString()}</code></div>}
              {result?.data && <div className="secret-data">{result.data}</div>}
            </div>}
            <div className="terminal-footer"><span>ZERO TRUST · EXPLICIT VERIFICATION</span><span>v0.1</span></div>
          </div>
        </div>
      </section>
      <section className="features">
        <div className="features-heading"><span className="section-num">02 / SECURITY MODEL</span><h2>Trust boundaries, enforced.</h2></div>
        <div className="feature-grid">
          <article><span className="feature-icon"><Fingerprint aria-hidden="true"/></span><h3>Publisher authenticity</h3><p>Verify the immutable on-chain creator, not a user-submitted issuer claim.</p></article>
          <article><span className="feature-icon"><LockKeyhole aria-hidden="true"/></span><h3>Immutable scope</h3><p>Read-only Arkiv records cannot silently change their permitted resource or subject.</p></article>
          <article><span className="feature-icon"><Clock3 aria-hidden="true"/></span><h3>Hard deadline</h3><p>Independent policy expiry is never extended by extending Arkiv storage.</p></article>
          <article><span className="feature-icon"><Ban aria-hidden="true"/></span><h3>Revocation by deletion</h3><p>If a lease disappears or the network cannot be verified, the gateway denies access.</p></article>
        </div>
      </section>
      <section className="footer-note"><div><strong>Built for Arkiv Global Tour · Security Track</strong><p>Public auditability for temporary authorization. Demonstration uses synthetic data and test wallets only.</p></div><span>OCTOBER 2026 <Sparkles className="footer-sparkles" aria-hidden="true"/></span></section>
    </main>
  </div>;
}
