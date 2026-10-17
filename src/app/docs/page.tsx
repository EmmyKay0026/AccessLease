import type { Metadata } from 'next';
import Link from 'next/link';
import {
  AlertTriangle, ArrowRight, Ban, BookOpen, ChevronDown, Clock3,
  Database, ExternalLink, Fingerprint, Info, KeyRound, Link2, LockKeyhole,
  Network, Server, Shield, ShieldCheck, ShieldX, Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { CodeBlock } from '@/components/code-block';
import { DocsNavigation } from '@/components/docs-navigation';
import { ArchitectureDiagram, ProcessDiagram } from '@/components/docs-diagrams';
import './docs.css';

export const metadata: Metadata = {
  title: 'AccessLease Docs | Architecture, Security & Setup',
  description: 'Understand AccessLease: verifiable temporary permissions on Arkiv Tiramisu, MetaMask authentication, replay protection, demo guides and developer setup.',
  openGraph: {
    title: 'AccessLease Documentation',
    description: 'The field guide to verifiable temporary permissions: architecture, security, the live demo and local setup.',
    type: 'website',
  },
};

function Heading({ number, id, children }: { number: string; id: string; children: string }) {
  return <div className="docs-section-heading">
    <span className="docs-section-number" aria-hidden="true">{number}</span>
    <h2>{children}<a className="docs-heading-link" href={'#' + id} aria-label={'Link to ' + children}><Link2 aria-hidden="true"/></a></h2>
  </div>;
}

function SecurityRule({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: React.ReactNode }) {
  return <div className="docs-security-rule"><span className="docs-rule-icon"><Icon aria-hidden="true"/></span><div><h3>{title}</h3><p>{children}</p></div></div>;
}

const installCode = [
  'npm install',
  '# Create a local file only if you do not already have one.',
  'if (!(Test-Path .env)) { Copy-Item .env.example .env }',
  '',
  '# Add your server configuration to .env, then start the app.',
  'npm run dev',
].join('\n');

const envCode = [
  '# Local browser origin. Use your exact HTTPS origin in production.',
  'ACCESSLEASE_ORIGIN=http://localhost:3000',
  '',
  '# Set these server-only values privately. No credentials belong here.',
  '# ARKIV_ISSUER_ADDRESS',
  '# UPSTASH_REDIS_REST_URL',
  '# UPSTASH_REDIS_REST_TOKEN',
].join('\n');

const issueCode = [
  '# Replace 0xRECIPIENT_ADDRESS with the recipient test wallet address.',
  'npm run lease:issue -- --subject=0xRECIPIENT_ADDRESS --resource=vault-demo --minutes=20',
  '',
  '# Optional attack demonstration, using a separate attacker test wallet.',
  'npm run lease:forge -- --subject=0xRECIPIENT_ADDRESS --resource=vault-demo --minutes=20',
  '',
  '# Replace 0xENTITY_KEY with the lease key to revoke.',
  'npm run lease:revoke -- --key=0xENTITY_KEY',
].join('\n');

const checkCode = [
  'npm test',
  'npm run typecheck',
  'npm run build',
  '',
  '# Serve the production build locally.',
  'npm run start',
  '',
  '# Inspect dependency advisories.',
  'npm audit',
].join('\n');

export default function Documentation() {
  return <main className="wrap docs-layout" id="main-content">
    <DocsNavigation/>
    <article className="docs-article">
      <header className="docs-hero">
        <div className="docs-breadcrumb"><BookOpen aria-hidden="true"/><span>DOCUMENTATION</span><span className="docs-version">ACCESSLEASE / V1</span></div>
        <h1>Permissions that<br/><em>prove themselves.</em></h1>
        <p>The field guide to AccessLease. Understand the evidence, follow the authentication flow, and put temporary access to the test.</p>
        <div className="docs-hero-meta"><span><Shield aria-hidden="true"/> Security prototype</span><span><Network aria-hidden="true"/> Arkiv Tiramisu</span><span><LockKeyhole aria-hidden="true"/> Synthetic data only</span></div>
        <Link className="docs-demo-button" href="/">Open the live demo <ArrowRight aria-hidden="true"/></Link>
      </header>

      <section className="docs-section" id="introduction">
        <Heading number="01" id="introduction">Introduction</Heading>
        <p className="docs-lead">A permission should prove who issued it, what it allows, and when it ends. Every time it is used.</p>
        <p>AccessLease is a security-focused prototype on <strong>Arkiv Tiramisu</strong>. A trusted administrator grants a specific test wallet access to one synthetic resource for a limited time. The application checks that grant against live on-chain evidence before returning any protected response.</p>
        <p>Temporary permissions can outlive their purpose: a contractor finishes a project, an incident ends, or a shared link keeps working. A stored role or a previously successful login cannot, by itself, prove that a particular time-limited grant is still valid.</p>
        <div className="docs-principles">
          <div><Fingerprint aria-hidden="true"/><h3>Who granted it?</h3><p>Check the actual on-chain creator against a configured trusted issuer.</p></div>
          <div><LockKeyhole aria-hidden="true"/><h3>What does it allow?</h3><p>Bind one recipient wallet to one explicit resource scope.</p></div>
          <div><Clock3 aria-hidden="true"/><h3>Is it still valid?</h3><p>Check both Arkiv expiration and an independent, fixed deadline.</p></div>
        </div>
        <h3>Why Arkiv?</h3>
        <p>Arkiv stores queryable entities with system-level creator and owner information, creation flags and storage expiration. AccessLease uses those fields as public permission evidence. A forged payload cannot make its publisher become the trusted on-chain creator.</p>
        <h3>How is this different from a role?</h3>
        <p>Ordinary role-based access often asks whether a user currently belongs to a category such as “admin.” AccessLease demonstrates a narrower question: does this issuer-authored lease still authorize this wallet to read this resource, right now? It complements broader identity and role systems; it does not replace every part of them.</p>
      </section>

      <section className="docs-section" id="how-it-works">
        <Heading number="02" id="how-it-works">How AccessLease works</Heading>
        <p>Permission evidence and identity proof travel through separate steps. They meet at the gateway, where every required check must pass.</p>
        <ProcessDiagram/>
        <div className="docs-callout"><Info aria-hidden="true"/><div><strong>Public verification is not protected access.</strong><p><strong>Verify lease</strong> inspects the record without a wallet. <strong>Request access</strong> also requires the authorized recipient to prove control of their wallet.</p></div></div>
      </section>

      <section className="docs-section" id="architecture">
        <Heading number="03" id="architecture">System architecture</Heading>
        <p>The Next.js application provides the user interface and the authorization gateway. Arkiv records permission evidence; authentication and delivery of protected data happen off-chain.</p>
        <ArchitectureDiagram/>
        <dl className="docs-components">
          <div><dt><Server aria-hidden="true"/> Next.js gateway</dt><dd>Serves the dashboard, documentation and API routes. It validates requests, coordinates authentication and enforces the final access decision on the server.</dd></div>
          <div><dt><Database aria-hidden="true"/> Arkiv Tiramisu</dt><dd>Supplies the current entity, its actual creator and owner, creation flags, permission payload and expiration. A fresh chain-head read supports the storage-expiry check.</dd></div>
          <div><dt><Wallet aria-hidden="true"/> MetaMask + EIP-6963</dt><dd>Wallet announcements let the recipient explicitly choose MetaMask even when Phantom is installed. The selected provider handles both connection and signing; the app does not fall back to an arbitrary window.ethereum provider.</dd></div>
          <div><dt><Fingerprint aria-hidden="true"/> viem</dt><dd>Verifies the EIP-191 personal signature against the intended wallet and exact server-issued message. Signing proves wallet control; the lease policy still decides authorization.</dd></div>
          <div><dt><LockKeyhole aria-hidden="true"/> Upstash Redis</dt><dd>Stores challenges across application instances. A Lua EVAL operation compares the stored challenge, checks its expiration using Redis time and consumes it atomically.</dd></div>
        </dl>
        <div className="docs-callout docs-callout-security"><Shield aria-hidden="true"/><div><strong>Arkiv supplies evidence. The gateway enforces access.</strong><p>Arkiv does not automatically protect an external API. AccessLease must verify that evidence and withhold the response whenever authentication or authorization fails.</p></div></div>
      </section>

      <section className="docs-section" id="security-model">
        <Heading number="04" id="security-model">Security model</Heading>
        <p>The trust boundary is the server. Frontend state, a successful public preview and user-supplied issuer claims cannot grant access.</p>
        <div className="docs-security-grid">
          <SecurityRule icon={Fingerprint} title="An authentic issuer">The actual Arkiv <code>$creator</code> must match <code>ARKIV_ISSUER_ADDRESS</code>. The owner must still be that issuer; unauthorized ownership transfers are denied.</SecurityRule>
          <SecurityRule icon={Wallet} title="The intended recipient">The signed wallet must match the challenge, the submitted recipient and the lease subject. A valid signature from another wallet is insufficient.</SecurityRule>
          <SecurityRule icon={LockKeyhole} title="Exactly one resource">The lease and challenge bind the same resource and entity key. A vault signature cannot authorize analytics or another lease.</SecurityRule>
          <SecurityRule icon={ShieldCheck} title="Read-only permission">The entity must have <code>readonly: true</code> and <code>permissionlessExtension: false</code>. Mutable grants are rejected.</SecurityRule>
          <SecurityRule icon={Clock3} title="Two independent cutoffs">Access requires a live Arkiv entity and a future immutable <code>deadlineMs</code>. Storage extension cannot extend permission. Future-issued or not-yet-started leases are denied.</SecurityRule>
          <SecurityRule icon={Ban} title="Revocation by deletion">The issuer can delete a lease. Once that deletion is included and visible to the live read, the missing record denies access. No successful authorization is cached.</SecurityRule>
          <SecurityRule icon={KeyRound} title="A fresh, bound challenge">The server generates a random 256-bit nonce. The message binds the exact origin, wallet, resource, lease, issuance and a two-minute expiration.</SecurityRule>
          <SecurityRule icon={ShieldX} title="One use, then gone">After signature verification, Redis atomically consumes the challenge. A concurrent or repeated submission cannot reuse it. An Arkiv failure after consumption requires a new challenge.</SecurityRule>
        </div>
        <div className="docs-callout docs-callout-security"><Shield aria-hidden="true"/><div><strong>Unverifiable means denied.</strong><p>Missing records, invalid signatures, unavailable Redis or an Arkiv network failure return no protected data. There is no permissive mock or process-local nonce fallback.</p></div></div>
        <h3>What a decision looks like</h3>
        <p>These are examples of gateway outcomes, not live status indicators.</p>
        <div className="docs-status-examples">
          <div className="docs-status-card is-granted"><ShieldCheck aria-hidden="true"/><span>ACCESS GRANTED</span><strong>Every check passed</strong><code>allowed</code></div>
          <div className="docs-status-card is-denied"><ShieldX aria-hidden="true"/><span>ACCESS DENIED</span><strong>Forgery detected</strong><code>issuer_mismatch</code></div>
          <div className="docs-status-card is-unavailable"><AlertTriangle aria-hidden="true"/><span>ACCESS DENIED</span><strong>Verification unavailable</strong><code>arkiv_unavailable</code></div>
        </div>
      </section>

      <section className="docs-section" id="demo-guide">
        <Heading number="05" id="demo-guide">Try the security model</Heading>
        <p>Use disposable test accounts and an active demo lease. The <Link href="/">dashboard</Link> is the live interface for each scenario below.</p>
        <ol className="docs-demo-steps">
          <li><span>01</span><div><h3>Verify a trusted lease</h3><p>Click <strong>Trusted lease</strong> if configured, or paste a key into <strong>Arkiv entity key</strong>. Choose its <strong>Requested resource</strong> and click <strong>Verify lease</strong>. Expect <strong>Permission verified</strong>, the on-chain creator, recipient and fixed deadline. <strong>Discover live</strong> finds candidate records from the trusted creator; every selected record still needs policy verification.</p></div></li>
          <li><span>02</span><div><h3>Catch a forged issuer</h3><p>Click <strong>Forged lease</strong> if configured, or enter a known attacker-created lease with copied metadata. Expect <strong>Access denied</strong> and a forgery message because its actual creator differs from the trusted issuer.</p></div></li>
          <li><span>03</span><div><h3>Change the resource</h3><p>Keep a trusted <code>vault-demo</code> lease selected. Change <strong>Requested resource</strong> to <strong>Operational analytics</strong> and click <strong>Verify lease</strong>. Expect <code>resource_mismatch</code>: a permission for one scope does not grant the other.</p></div></li>
          <li><span>04</span><div><h3>Authenticate the recipient</h3><p>Restore the matching resource. Select <strong>MetaMask</strong> under <strong>Sign with wallet</strong>, choose the authorized recipient account in MetaMask and click <strong>Request access</strong>. Approve the connection, inspect the message and sign within two minutes. Expect <strong>Connecting wallet</strong>, <strong>Awaiting signature</strong>, <strong>Verifying signature</strong>, <strong>Checking Arkiv permission</strong> and <strong>Access granted</strong>, followed by synthetic text. Phantom may stay enabled.</p></div></li>
          <li><span>05</span><div><h3>Attempt a replay</h3><p>In your local browser DevTools Network panel, retain your own successful <code>/api/access</code> request and use <strong>Copy as fetch</strong> to resend it from the same origin. Expect HTTP <code>403</code> with <code>challenge_used</code>. Keep that signed request private. Clicking <strong>Request access</strong> again creates a new challenge and is not a replay.</p></div></li>
          <li><span>06</span><div><h3>Use another wallet</h3><p>Switch MetaMask to a different test account and request the same resource with the same lease. Even a valid signature must be denied because that wallet is not the authorized recipient. Account changes also clear previously displayed protected data.</p></div></li>
          <li><span>07</span><div><h3>Expire or revoke a lease</h3><p>Use a known expired or issuer-deleted lease and click <strong>Verify lease</strong>, then attempt access. Expect denial. An entity may disappear after expiry or deletion, so the response may be <code>not_found</code> rather than a distinct revocation message. Storage lifetime and the fixed permission deadline are checked independently.</p></div></li>
        </ol>
        <div className="docs-callout"><Info aria-hidden="true"/><div><strong>Test cancellation, too.</strong><p>Reject connection or signing, or switch accounts while a request is pending. Loading must end with useful feedback. The app can stop waiting for MetaMask, but it cannot close a native extension prompt; dismiss an old prompt before retrying.</p></div></div>
        <Link className="docs-inline-cta" href="/">Return to the access gateway <ArrowRight aria-hidden="true"/></Link>
      </section>

      <section className="docs-section" id="developers">
        <Heading number="06" id="developers">Developer setup</Heading>
        <p>Use Node.js 22 or later and npm. Work in the existing repository. You need a current MetaMask extension, a trusted issuer address, an active lease and a shared Upstash Redis database for protected access.</p>
        <h3>Install and run locally</h3>
        <CodeBlock title="Local installation" code={installCode}/>
        <p>Open <code>http://localhost:3000</code>. Public verification and discovery need a configured issuer and working Tiramisu RPC; protected access additionally requires shared challenge storage.</p>
        <CodeBlock title="Local origin configuration" language="Environment" code={envCode}/>
        <p>Set real values privately using the repository&apos;s <code>.env.example</code> as a checklist. Restart the server after configuration changes. Never commit secrets or prefix server credentials with <code>NEXT_PUBLIC_</code>.</p>

        <h3>Environment variables</h3>
        <div className="docs-table-wrap" role="region" aria-label="Environment variables" tabIndex={0}>
          <table><caption className="sr-only">AccessLease environment configuration</caption><thead><tr><th scope="col">Variable</th><th scope="col">Purpose</th></tr></thead><tbody>
            <tr><th scope="row"><code>ARKIV_ISSUER_ADDRESS</code></th><td>Required trusted public issuer. It must match the publishing wallet used by the grant CLI.</td></tr>
            <tr><th scope="row"><code>ACCESSLEASE_ORIGIN</code></th><td>The exact browser origin, including a local port. Required explicit HTTPS audience in production; only development loopback can be inferred.</td></tr>
            <tr><th scope="row"><code>UPSTASH_REDIS_REST_URL</code></th><td>Server-only HTTPS REST endpoint for shared challenge storage.</td></tr>
            <tr><th scope="row"><code>UPSTASH_REDIS_REST_TOKEN</code></th><td>Server-only writable token. A read-only Redis token cannot consume challenges.</td></tr>
            <tr><th scope="row"><code>ARKIV_RPC_URL</code></th><td>Optional server-only RPC override. Omit it to use the SDK&apos;s public Tiramisu endpoint.</td></tr>
            <tr><th scope="row"><code>SAMPLE_VALID_LEASE_KEY</code><br/><code>SAMPLE_FORGED_LEASE_KEY</code></th><td>Optional public entity keys for the two dashboard sample controls. They do not bypass verification.</td></tr>
            <tr><th scope="row"><code>ARKIV_ISSUER_PRIVATE_KEY</code></th><td>Local grant/revoke CLI only. Never required by the deployed gateway.</td></tr>
            <tr><th scope="row"><code>ARKIV_ATTACKER_PRIVATE_KEY</code></th><td>Optional local forge demonstration only. Use a separate disposable test wallet.</td></tr>
          </tbody></table>
        </div>

        <h3>Arkiv and wallet configuration</h3>
        <div className="docs-network-card"><Network aria-hidden="true"/><div><strong>Tiramisu testnet</strong><span>Chain ID <code>7738577</code> · Native currency <code>GLM</code></span><code className="docs-rpc-url">https://rpc.tiramisu.db-chain.testnet.arkiv.network</code></div></div>
        <p>The existing SDK clients use the Tiramisu chain configuration. The issuer and optional attacker need test GLM to publish or delete records. A recipient only signs a message; requesting access does not submit a transaction or require recipient GLM.</p>
        <p>Use a MetaMask version that announces EIP-6963 providers and select it explicitly in the dashboard. Verify that the selected account is the lease recipient. Other installed wallets can remain enabled; the app will not silently select one for you.</p>

        <h3>Shared Redis requirements</h3>
        <p>Connect a dedicated Upstash Redis database, for example through your Vercel project&apos;s Storage / Marketplace integration. Configure its HTTPS REST URL and writable token on the server. Use separate production and development/preview databases, durable storage with eviction disabled, and accurate application-server and Redis clocks.</p>
        <p>The adapter uses <code>SET</code>, <code>GET</code>, <code>EVAL</code>, <code>TIME</code> and <code>DEL</code>. Records are retained for three minutes so an expired challenge can receive a useful error; signatures are valid for only two minutes. All application instances must share the same store. Missing infrastructure fails closed.</p>

        <h3>The permission data contract</h3>
        <p>The JSON schema is <code>accesslease/v1</code>. It contains <code>subject</code>, <code>resource</code>, <code>issuedAtMs</code>, <code>notBeforeMs</code> and <code>deadlineMs</code>. Supported resources are <code>vault-demo</code> and <code>analytics-demo</code>. The CLI supports leases from 1 to 120 minutes.</p>
        <p>Discovery uses the <code>project</code> attribute <code>accesslease-2026-v1</code>, <code>kind=lease</code> and an actual creator filter. These searchable attributes are not the root of trust. The gateway reads system fields and the immutable payload again before granting access.</p>

        <h3>API reference</h3>
        <div className="docs-table-wrap" role="region" aria-label="API routes" tabIndex={0}>
          <table className="docs-api-table"><caption className="sr-only">Implemented AccessLease API routes</caption><thead><tr><th scope="col">Route</th><th scope="col">Behavior</th></tr></thead><tbody>
            <tr><th scope="row"><span className="docs-method">GET</span><code>/api/config</code></th><td>Public network, trusted issuer and optional sample-key configuration.</td></tr>
            <tr><th scope="row"><span className="docs-method">GET</span><code>/api/discover</code></th><td>Creator-filtered candidate leases. Returns up to 30 records; discovery is not an authorization decision.</td></tr>
            <tr><th scope="row"><span className="docs-method">GET</span><code>/api/verify</code></th><td>Public policy check with <code>key</code> and <code>resource</code> query parameters. Returns a decision and lease metadata; no protected data.</td></tr>
            <tr><th scope="row"><span className="docs-method is-post">POST</span><code>/api/challenge</code></th><td>Accepts JSON fields <code>key</code>, <code>resource</code>, <code>subject</code>. Returns a server-created challenge and its exact signing message.</td></tr>
            <tr><th scope="row"><span className="docs-method is-post">POST</span><code>/api/access</code></th><td>Accepts <code>key</code>, <code>resource</code>, <code>subject</code>, <code>nonce</code>, <code>signature</code>. Authenticates, consumes and checks the live lease before returning a synthetic resource.</td></tr>
          </tbody></table>
        </div>
        <p>Both POST routes require <code>Content-Type: application/json</code> and an <code>Origin</code> matching the configured audience. Browsers supply their Origin automatically; non-browser clients must set it. The old timestamp-only access format is not supported.</p>
        <p>Ordinary access responses use JSON with HTTP 403 for a policy denial, 410 for a recognized expired challenge and 503 for unavailable infrastructure. The dashboard requests <code>application/x-ndjson</code> to show the transition from signature verification to the Arkiv check. After streaming begins, the final body&apos;s <code>allowed</code> and <code>reason</code> determine the outcome, even when the HTTP stream status is 200. Responses are not cached.</p>

        <h3>Issue, forge and revoke demo leases</h3>
        <div className="docs-callout docs-callout-warning"><AlertTriangle aria-hidden="true"/><div><strong>These commands publish testnet transactions when you run them.</strong><p>Use dedicated test wallets and test GLM. Keep issuer and attacker keys local. Replace the address and key placeholders below; copying a command does not execute it.</p></div></div>
        <CodeBlock title="Demo lease administration" code={issueCode}/>
        <p>Issuance returns an entity key, transaction hash and deadline. Save public entity keys in the optional sample variables to enable the dashboard shortcuts. The forge script requires a different attacker account. Confirm a deletion transaction before demonstrating revocation. Do not publish keys, signing payloads or real personal information on-chain.</p>

        <h3>Tests and a production build</h3>
        <CodeBlock title="Validation and production preview" code={checkCode}/>
        <p>The suite covers authorization, real local signing/recovery, replay, API handling and wallet-flow failure states. Redis and RPC transports are mocked in automated integration tests; passing them is not proof that every live infrastructure path has been tested.</p>
        <p>The repository&apos;s <code>README.md</code>, <code>docs/AUTHENTICATION.md</code>, <code>arkiv/schema.md</code> and <code>arkiv/friction.md</code> contain setup details, the data contract and historical experiment notes. Treat pending entries as pending; this page does not turn them into measured results.</p>
      </section>

      <section className="docs-section" id="limitations">
        <Heading number="07" id="limitations">Limitations &amp; FAQ</Heading>
        <p>This is an inspectable security prototype, not a claim of universal security. Its protected responses are synthetic, its records live on a test network, and its trusted issuer remains a key assumption.</p>
        <div className="docs-faq">
          <details><summary><span>Is this completely decentralized?</span><ChevronDown aria-hidden="true"/></summary><p>No. Permission evidence is on Arkiv, but the operator configures a trusted issuer and runs the Next.js gateway and Redis-backed authentication. The gateway decides whether to return the external resource.</p></details>
          <details><summary><span>Does a public “Permission verified” result unlock data?</span><ChevronDown aria-hidden="true"/></summary><p>No. It is a policy inspection. Protected access also requires a fresh signature from the authorized recipient, a single-use challenge and another live permission check.</p></details>
          <details><summary><span>Can extending Arkiv storage extend permission?</span><ChevronDown aria-hidden="true"/></summary><p>No. The owner may extend storage lifetime even for a read-only entity, but AccessLease independently enforces the immutable deadlineMs. Both the chain lifetime and that deadline must remain valid.</p></details>
          <details><summary><span>Can I trust every wallet announcement?</span><ChevronDown aria-hidden="true"/></summary><p>EIP-6963 metadata is self-attested; it does not cryptographically authenticate an installed extension. Install only extensions you trust, inspect the selected provider and read the signing message. The backend still verifies the actual signer.</p></details>
          <details><summary><span>What happens when infrastructure is unavailable?</span><ChevronDown aria-hidden="true"/></summary><p>Availability depends on the application host, Arkiv RPC and Redis. A failed required check denies protected access. If an authenticated challenge has already been consumed, retrying needs a new challenge. An unavailable wallet prompt cannot leave the application loading indefinitely, though you may need to close the native prompt yourself.</p></details>
          <details><summary><span>Is this ready to protect real confidential data?</span><ChevronDown aria-hidden="true"/></summary><p>The current resource is synthetic. Broader hardening is outside this MVP: shared abuse controls, monitoring, issuer-key protection and rotation, incident response, and explicit RPC finality and read-consistency assumptions need further work. A deletion can also race an in-flight read.</p></details>
          <details><summary><span>Where can I learn more about Arkiv?</span><ChevronDown aria-hidden="true"/></summary><p>Use the <a href="https://docs.arkiv.network/" target="_blank" rel="noreferrer">official Arkiv documentation <ExternalLink aria-hidden="true"/><span className="sr-only"> (opens in a new tab)</span></a> for the SDK and network. AccessLease&apos;s gateway behavior is defined by this repository&apos;s implementation.</p></details>
        </div>
      </section>

      <footer className="docs-footer">
        <div><ShieldCheck aria-hidden="true"/><div><strong>Ready to inspect the proof?</strong><p>One wallet. One resource. A permission that must still be valid.</p></div></div>
        <Link className="docs-demo-button" href="/">Launch the demo <ArrowRight aria-hidden="true"/></Link>
        <span>ACCESSLEASE · ARKIV SECURITY TRACK · SYNTHETIC DATA ONLY</span>
      </footer>
    </article>
  </main>;
}
