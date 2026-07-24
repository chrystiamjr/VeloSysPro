import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'VeloSys Pro',
  tagline:
    'High-performance Windows optimization, gaming tweaks, network tuning, and registry backup desktop application.',
  favicon: 'img/favicon.ico',

  url: 'https://chrystiamjr.github.io',
  baseUrl: '/VeloSysPro/',

  organizationName: 'chrystiamjr',
  projectName: 'VeloSysPro',

  onBrokenLinks: 'warn',
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'pt-BR'],
    localeConfigs: {
      en: { label: 'English' },
      'pt-BR': { label: 'Português (Brasil)' },
    },
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/chrystiamjr/VeloSysPro/tree/main/website/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/docusaurus-social-card.jpg',
    colorMode: {
      defaultMode: 'dark',
      disableSwitch: true,
      respectPrefersColorScheme: false,
    },
    navbar: {
      title: 'VeloSys Pro',
      logo: {
        alt: 'VeloSys Pro Logo',
        src: 'img/logo.png',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Documentation',
        },
        {
          type: 'localeDropdown',
          position: 'right',
        },
        {
          href: 'https://github.com/chrystiamjr/VeloSysPro',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {
              label: 'Introduction',
              to: '/docs/intro',
            },
            {
              label: 'Installation',
              to: '/docs/installation',
            },
            {
              label: 'User Guide',
              to: '/docs/user-guide/optimizations',
            },
          ],
        },
        {
          title: 'Community & Source',
          items: [
            {
              label: 'GitHub Repository',
              href: 'https://github.com/chrystiamjr/VeloSysPro',
            },
            {
              label: 'Releases & Downloads',
              href: 'https://github.com/chrystiamjr/VeloSysPro/releases',
            },
          ],
        },
        {
          title: 'Organization',
          items: [
            {
              label: 'Envolvo Systems LTDA.',
              href: 'https://github.com/chrystiamjr',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Envolvo Systems LTDA. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['csharp', 'powershell', 'json', 'bash'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
