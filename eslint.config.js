const { FlatCompat } = require('@eslint/eslintrc');

const compat = new FlatCompat({
  baseDirectory: process.cwd(),
});

module.exports = [
  ...compat.extends('expo'),
  {
    ignores: ['node_modules/**', 'dist/**'],
  },
];
