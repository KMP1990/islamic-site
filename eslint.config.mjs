import globals from 'globals';

export default [
  {
    files: ['js/*.js'],
    languageOptions: {
      sourceType: 'script',
      globals: {
        ...globals.browser,
        LocalSecurity: 'readonly', showToast: 'readonly', showHome: 'readonly',
        closeSidebarIfOpen: 'readonly', getDeveloperSettings: 'readonly',
        developerUnlocked: 'readonly', refreshPublicSurfaces: 'readonly',
        closeDeveloperLoginModal: 'readonly', closeContentPreview: 'readonly',
        dismissHomeAd: 'readonly', applyAuthGate: 'readonly',
        AUTH_USERS_KEY: 'readonly', AUTH_SESSION_KEY: 'readonly'
      }
    },
    rules: {
      'no-undef': 'error', 'no-unreachable': 'error', 'no-dupe-keys': 'error',
      'no-constant-condition': 'error', 'valid-typeof': 'error'
    }
  },
  {
    files: ['tests/*.cjs'],
    languageOptions: { globals: globals.node },
    rules: { 'no-undef': 'error', 'no-unreachable': 'error' }
  }
];
