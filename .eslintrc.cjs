module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: ['./polycast-frontend/tsconfig.json'],
    sourceType: 'module',
    ecmaVersion: 'latest',
  },
  plugins: ['@typescript-eslint', 'lit'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:lit/recommended',
    'prettier',
  ],
  ignorePatterns: ['node_modules/', 'dist/', 'polycast-frontend/dist/'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
  },
}; 