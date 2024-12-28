/** @type {import('@docusaurus/types').DocusaurusConfig} */
module.exports = {
	title: 'TallyArbiter Documentation',
	tagline: '',
	url: 'https://josephdadams.github.io',
	baseUrl: '/TallyArbiter/',
	onBrokenLinks: 'throw',
	onBrokenMarkdownLinks: 'warn',
	favicon: 'img/favicon.png',
	organizationName: 'josephdadams', // Usually your GitHub org/user name.
	projectName: 'TallyArbiter', // Usually your repo name.
	themeConfig: {
		navbar: {
			title: '',
			logo: {
				alt: 'TallyArbiter Logo',
				src: 'img/logo.png',
			},
			items: [
				{
					type: 'doc',
					docId: 'intro',
					position: 'left',
					label: 'Documentation',
				},
				{
					href: 'https://github.com/josephdadams/TallyArbiter',
					label: 'GitHub',
					position: 'right',
				},
			],
		},
		footer: {
			style: 'dark',
			links: [],
			copyright: `Copyright © ${new Date().getFullYear()} Joseph Adams & Contributors. Documentation built with ❤ and Docusaurus.`,
		},
	},
	presets: [
		[
			'@docusaurus/preset-classic',
			{
				docs: {
					sidebarPath: require.resolve('./sidebars.js'),
					// Please change this to your repo.
					editUrl: 'https://github.com/josephdadams/TallyArbiter/edit/master/docs/',
				},
				theme: {
					customCss: require.resolve('./src/css/custom.css'),
				},
			},
		],
	],
}
