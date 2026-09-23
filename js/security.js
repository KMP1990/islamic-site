// @ts-check
const LocalSecurity = (() => {
  const iterations = 600000;
  /** @param {string} value */
  function encode(value) {
    return value.replace(/[&<>'"]/g, char => {
      switch (char) {
        case '&': return '&amp;';
        case '<': return '&lt;';
        case '>': return '&gt;';
        case "'": return '&#39;';
        default: return '&quot;';
      }
    });
  }
  /** @param {string} value */
  function safeUrl(value) {
    try {
      const url = new URL(value);
      return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : '';
    } catch {
      return '';
    }
  }
  /** @param {Uint8Array<ArrayBuffer>} bytes */
  function hex(bytes) {
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  }
  /** @param {string} password @param {Uint8Array<ArrayBuffer>} salt */
  async function derive(password, salt) {
    if (!globalThis.crypto?.subtle) throw new Error('افتح الموقع عبر HTTPS أو localhost لاستخدام الحسابات');
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    return hex(new Uint8Array(await crypto.subtle.deriveBits({
      name: 'PBKDF2', salt, iterations, hash: 'SHA-256'
    }, key, 256)));
  }
  /** @param {string} password */
  async function hash(password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    return `pbkdf2:${hex(salt)}:${await derive(password, salt)}`;
  }
  /** @param {string} password @param {string} stored */
  async function verify(password, stored) {
    const match = /^pbkdf2:([a-f0-9]{32}):([a-f0-9]{64})$/.exec(stored);
    if (!match) return false;
    const salt = Uint8Array.from(match[1].match(/../g) || [], byte => parseInt(byte, 16));
    const actual = await derive(password, salt);
    let difference = 0;
    for (let i = 0; i < actual.length; i++) difference |= actual.charCodeAt(i) ^ match[2].charCodeAt(i);
    return difference === 0;
  }
  function recoveryCode() {
    return hex(crypto.getRandomValues(new Uint8Array(16))).toUpperCase().match(/.{4}/g)?.join('-') || '';
  }
  /** @param {string} password */
  function passwordError(password) {
    return password.length < 10 || password.length > 128
      ? 'استخدم كلمة مرور من 10 إلى 128 حرفًا' : '';
  }
  return { encode, safeUrl, hash, verify, recoveryCode, passwordError };
})();
