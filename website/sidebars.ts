import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars:SidebarsConfig = {
  docsSidebar: [
    'intro',
    'installation',
    {
      type: 'category',
      label: 'User Guide',
      items: [
        'user-guide/optimizations',
        'user-guide/registry-backup',
        'user-guide/restore-points',
        'user-guide/scheduling',
        'user-guide/settings',
      ],
      collapsed: false,
    },
    {
      type: 'category',
      label: 'Developer Guide',
      items: [
        'developer-guide/architecture',
        'developer-guide/ipc-bridge',
        'developer-guide/building-and-testing',
      ],
      collapsed: false,
    },
  ],
};

export default sidebars;
