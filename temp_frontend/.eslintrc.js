module.exports = {
  extends: ['react-app', 'react-app/jest'],
  rules: {
    // Fix no-throw-literal warnings
    'no-throw-literal': 'off',
    // Fix empty object pattern warnings
    'no-empty-pattern': 'warn',
    // Fix accessibility warnings
    'jsx-a11y/anchor-is-valid': 'warn'
  }
};