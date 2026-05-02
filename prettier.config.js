/** @type {import("prettier").Config} */
export default {
	// Aligned with .editorconfig [*]
	useTabs: true,
	endOfLine: 'lf',

	// Code style
	semi: false,
	singleQuote: true,
	trailingComma: 'es5',
	printWidth: 120,
	bracketSpacing: true,
	bracketSameLine: false,
	arrowParens: 'always',
	quoteProps: 'as-needed',
	jsxSingleQuote: false,
	proseWrap: 'preserve',
	htmlWhitespaceSensitivity: 'css',
	embeddedLanguageFormatting: 'auto',

	// Aligned with .editorconfig [*.md], [*.json], [*.yml], [*.yaml], [*.feature]
	overrides: [
		{
			files: ['*.json', '*.yml', '*.yaml', '*.feature', '*.md'],
			options: {
				useTabs: false,
				tabWidth: 2,
			},
		},
	],
}
