// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	site: 'https://dweng0.github.io',
	base: '/Mooch',
	integrations: [
		starlight({
			title: 'Mooch',
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/dweng0/Mooch' }],
			sidebar: [
				{
					label: 'Getting Started',
					items: [
						{ label: 'Introduction', slug: 'getting-started/introduction' },
						{ label: 'Installation', slug: 'getting-started/installation' },
					],
				},
				{
					label: 'Guides',
					items: [
						{ label: 'Mock Interviews', slug: 'guides/mock-interviews' },
						{ label: 'Code Interview Mode', slug: 'guides/code-interview' },
						{ label: 'Chrome Extension', slug: 'guides/chrome-extension' },
						{ label: 'Providers', slug: 'guides/providers' },
					],
				},
				{
					label: 'Reference',
					items: [
						{ label: 'Bridge API', slug: 'reference/bridge-api' },
						{ label: 'Architecture', slug: 'reference/architecture' },
					],
				},
				{
					label: 'Development',
					items: [
						{ label: 'Poppins Framework', slug: 'development/baadd' },
						{ label: 'Contributing', slug: 'development/contributing' },
					],
				},
			],
		}),
	],
});
