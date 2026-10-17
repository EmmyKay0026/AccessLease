import {
  ArrowDown, ArrowRight, Ban, CircleCheck, Database, Fingerprint, KeyRound,
  LockKeyhole, ScanLine, Server, ShieldCheck, Wallet,
} from 'lucide-react';

const phases = [
  { title: 'Publish a permission', label: '01 / PERMISSION', steps: [
    { title: 'Issue the lease', text: 'A trusted administrator grants one wallet a resource for a fixed time.', icon: KeyRound },
    { title: 'Record it on Arkiv', text: 'A read-only Tiramisu entity holds the public permission evidence.', icon: Database },
    { title: 'Inspect the proof', text: 'The verifier checks the actual creator, owner, flags, scope and deadlines.', icon: ScanLine },
  ] },
  { title: 'Prove your identity', label: '02 / AUTHENTICATION', steps: [
    { title: 'Choose MetaMask', text: 'The intended recipient selects MetaMask and connects the right account.', icon: Wallet },
    { title: 'Receive a challenge', text: 'The server stores a fresh, single-use challenge in shared Redis.', icon: LockKeyhole },
    { title: 'Sign the challenge', text: 'The recipient signs the exact origin, wallet, lease, resource and deadline.', icon: Fingerprint },
  ] },
  { title: 'Enforce the decision', label: '03 / AUTHORIZATION', steps: [
    { title: 'Verify, consume, check', text: 'The gateway recovers the signer, consumes the nonce atomically and reads Arkiv again.', icon: ShieldCheck },
    { title: 'Grant valid requests', text: 'Every check must pass before the gateway returns synthetic protected data.', icon: CircleCheck },
    { title: 'Deny unsafe requests', text: 'Forged, unauthorized, expired, revoked or unverifiable requests receive no data.', icon: Ban },
  ] },
];

export function ProcessDiagram() {
  return <figure className="docs-figure" aria-labelledby="process-caption">
    <div className="process-diagram">
      {phases.map((phase, phaseIndex) => <div className="process-phase" key={phase.label}>
        <div className="process-phase-header"><span>{phase.label}</span><h3>{phase.title}</h3></div>
        <ol start={phaseIndex * 3 + 1}>
          {phase.steps.map((step, index) => <li key={step.title}>
            <div className="process-step-mark"><step.icon aria-hidden="true"/><span>{String(phaseIndex * 3 + index + 1).padStart(2, '0')}</span></div>
            <div><h4>{step.title}</h4><p>{step.text}</p></div>
          </li>)}
        </ol>
        {phaseIndex < 2 ? <span className="process-connector" aria-hidden="true"><ArrowRight className="connector-right"/><ArrowDown className="connector-down"/></span> : null}
      </div>)}
    </div>
    <figcaption id="process-caption">An on-chain permission supplies evidence. A fresh signature proves identity. The gateway makes the access decision.</figcaption>
  </figure>;
}

export function ArchitectureDiagram() {
  return <figure className="docs-figure architecture-diagram" aria-labelledby="architecture-caption">
    <div className="architecture-plane architecture-chain">
      <div className="architecture-plane-label"><Database aria-hidden="true"/> ON-CHAIN / PUBLIC EVIDENCE</div>
      <div className="architecture-chain-flow">
        <div><KeyRound aria-hidden="true"/><strong>Trusted issuer</strong><span>Creates or deletes a lease</span></div>
        <div className="architecture-arrow"><ArrowRight aria-hidden="true"/><span>testnet transaction</span></div>
        <div><Database aria-hidden="true"/><strong>Arkiv Tiramisu</strong><span>Creator · owner · flags · scope · expiry</span></div>
      </div>
    </div>
    <div className="architecture-boundary"><span/><ArrowDown aria-hidden="true"/><span>Fresh entity + chain-head reads</span><span/></div>
    <div className="architecture-plane architecture-offchain">
      <div className="architecture-plane-label"><Server aria-hidden="true"/> OFF-CHAIN / IDENTITY & ENFORCEMENT</div>
      <div className="architecture-nodes">
        <div className="architecture-node"><Wallet aria-hidden="true"/><strong>Recipient + MetaMask</strong><p>EIP-6963 provider selection<br/>EIP-191 personal signature</p></div>
        <div className="architecture-gateway architecture-node"><ShieldCheck aria-hidden="true"/><span className="architecture-node-tag">THE ACCESS GATE</span><strong>Next.js gateway</strong><p>viem signature verification<br/>Independent live lease policy</p></div>
        <div className="architecture-node"><Database aria-hidden="true"/><strong>Upstash Redis</strong><p>Shared challenge storage<br/>Atomic compare + consume</p></div>
      </div>
      <div className="architecture-interactions"><span>MetaMask <ArrowRight aria-hidden="true"/> signed challenge <ArrowRight aria-hidden="true"/> gateway</span><span>Gateway <ArrowRight aria-hidden="true"/> Redis read / EVAL</span></div>
      <div className="architecture-outcome"><ArrowDown aria-hidden="true"/><span><LockKeyhole aria-hidden="true"/> Protected synthetic resource</span><small>Returned by the gateway only after every check passes</small></div>
    </div>
    <figcaption id="architecture-caption">The Next.js application serves the dashboard and documentation. Its backend enforces access; Arkiv supplies permission evidence, MetaMask supplies a signature, and Redis prevents challenge reuse.</figcaption>
  </figure>;
}
