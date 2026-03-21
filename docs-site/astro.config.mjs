// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightTypeDoc, { typeDocSidebarGroup } from 'starlight-typedoc';

// https://astro.build/config
export default defineConfig({
	site: 'https://dweng0.github.io',
	base: '/Mooch',
	integrations: [
		starlight({
			title: 'Mooch',
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/dweng0/Mooch' }],
			plugins: [
				starlightTypeDoc({
					entryPoints: [
						'../src/shared/types.ts',
						'../src/main/services/ai-provider.ts',
						'../src/main/services/interview-session.ts',
						'../src/main/services/interview-orchestrator.ts',
						'../src/main/services/local-bridge-api.ts',
						'../src/main/services/tts-provider.ts',
					],
					tsconfig: './tsconfig.typedoc.json',
					output: 'api',
					typeDoc: {
						excludePrivate: true,
						excludeInternal: true,
						skipErrorChecking: true,
					},
				}),
			],
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
				typeDocSidebarGroup,
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
