export const labels: Record<string, string> = {
  allowed: 'Access granted.',
  unconfigured: 'The trusted issuer is not configured.',
  not_found: 'No active permission found. It may have expired or been revoked.',
  issuer_mismatch: 'Forgery detected: the on-chain creator is not the trusted issuer.',
  owner_mismatch: 'The permission was transferred to an unauthorized owner.',
  mutable_lease: 'The permission is mutable. Access denied.',
  permissionless_extension: 'Unsafe permission extension settings. Access denied.',
  invalid_payload: 'The permission record is invalid.',
  subject_mismatch: 'Connected wallet does not match the authorized recipient.',
  resource_mismatch: 'Resource not authorized.',
  lease_mismatch: 'The signature challenge belongs to another lease.',
  not_yet_valid: 'The permission has not started yet.',
  deadline_passed: 'Permission expired.',
  chain_expired: 'Permission expired on Arkiv.',
  invalid_duration: 'The permission violates the maximum 120-minute duration.',
  invalid_signature: 'Invalid wallet signature.',
  challenge_expired: 'Signature challenge expired — please retry.',
  challenge_used: 'Signature challenge expired or already used — please retry.',
  audience_mismatch: 'The signature challenge is for another site.',
  bad_request: 'Invalid request. Check the lease key, resource, and wallet address.',
  auth_unavailable: 'Authentication service unavailable. Please retry later.',
  arkiv_unavailable: 'Arkiv verification unavailable. Access denied.',
  connection_rejected: 'Wallet connection cancelled.',
  signature_rejected: 'Signature request rejected.',
  wallet_unavailable: 'Select MetaMask from the wallet list. Enable MetaMask and refresh if it is missing.',
  invalid_account: 'MetaMask did not return a valid recipient address.',
  account_changed: 'Wallet account changed. Request access again with the authorized recipient.',
  wallet_disconnected: 'Wallet disconnected. Reconnect MetaMask to continue.',
  wallet_pending: 'A wallet request is already pending. Open MetaMask to finish or cancel it.',
  wallet_error: 'Wallet operation failed. Open MetaMask and retry.',
  request_timeout: 'Request timed out. Please retry. If MetaMask is still open, close the pending request first.',
  request_cancelled: 'Request cancelled.',
  service_error: 'Unable to complete the request. Please retry.',
};
export class GatewayError extends Error {
  code: string;
  constructor(code: string) {
    super(labels[code] || labels.service_error);
    this.name = 'GatewayError';
    this.code = code;
  }
}
export const safeError = (error: unknown) => error instanceof GatewayError ? error.message : labels.service_error;
