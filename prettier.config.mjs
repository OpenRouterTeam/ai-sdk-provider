export default {
  arrowParens: 'always',
  singleQuote: true,
  tabWidth: 2,
  trailingComma: 'all',
  singleAttributePerLine: true,
  jsxSingleQuote: true,
  proseWrap: 'never',
  plugins: ['@ianvs/prettier-plugin-sort-imports'],
  importOrder: [
    '<TYPES>',
    '<TYPES>^[@/]',
    '<TYPES>^[./|../]',
    '',

    '<BUILTIN_MODULES>', // Node.js built-in modules
    '<THIRD_PARTY_MODULES>', // Imports not matched by other special words or groups.
    '',

    '^[../]',
    '^[./]',
  ],
  importOrderParserPlugins: ['typescript', 'jsx', 'decorators-legacy'],
};
