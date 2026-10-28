import type { ThemeConfig } from 'antd';

export const coordinatorTheme: ThemeConfig = {
  token: {
    colorPrimary: '#0f4d55',
    colorInfo: '#0f4d55',
    colorSuccess: '#18a45b',
    colorWarning: '#ffbd3f',
    colorError: '#ee2f3c',
    colorText: '#102f34',
    colorTextSecondary: '#607b80',
    colorBgLayout: '#f4faf9',
    colorBorder: '#d4e4e4',
    borderRadius: 12,
    borderRadiusLG: 20,
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
    controlHeight: 44,
  },
  components: {
    Layout: { siderBg: '#0f4d55', headerBg: '#f4faf9', bodyBg: '#f4faf9' },
    Menu: {
      darkItemBg: 'transparent',
      darkItemColor: '#d4e5e7',
      darkItemHoverBg: 'rgba(255,255,255,.08)',
      darkItemSelectedBg: '#ffbd3f',
      darkItemSelectedColor: '#3e3212',
      itemBorderRadius: 12,
    },
    Button: { primaryShadow: 'none' },
    Card: { headerBg: '#ffffff' },
    Table: { headerBg: '#f5f9f8', headerColor: '#607b80' },
  },
};
