/* ========================================
   PWSWORK - CRYPTO UTILS
   Client-side hashing helpers (SHA-256)
   ======================================== */

const CryptoUtil = (() => {
    const SALT = 'pwswork_v1';

    function _toHex(buffer) {
        const bytes = new Uint8Array(buffer);
        return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    async function _sha256(text) {
        const encoder = new TextEncoder();
        const data = encoder.encode(text);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        return _toHex(hashBuffer);
    }

    async function hashSecret(secret) {
        const normalized = `${SALT}::${String(secret || '')}`;
        const digest = await _sha256(normalized);
        return `sha256$${digest}`;
    }

    async function verifySecret(secret, storedValue) {
        if (!storedValue || typeof storedValue !== 'string') return false;
        if (storedValue.startsWith('sha256$')) {
            const computed = await hashSecret(secret);
            return computed === storedValue;
        }
        return String(secret || '') === storedValue;
    }

    function isHashed(value) {
        return typeof value === 'string' && value.startsWith('sha256$');
    }

    return {
        hashSecret,
        verifySecret,
        isHashed
    };
})();
