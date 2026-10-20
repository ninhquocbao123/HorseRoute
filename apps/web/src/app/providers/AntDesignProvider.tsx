import type { ReactNode } from 'react';
import { App as AntApp, ConfigProvider } from 'antd';
import viVN from 'antd/locale/vi_VN';
import dayjs from 'dayjs';
import 'dayjs/locale/vi';
import { themeTokens } from '../../styles/theme-tokens';

dayjs.locale('vi');

type AntDesignProviderProps = {
  children: ReactNode;
};

export default function AntDesignProvider({ children }: AntDesignProviderProps) {
  return (
    <ConfigProvider
      locale={viVN}
      theme={{
        token: {
          colorPrimary: themeTokens.colorBrand,
          colorSuccess: themeTokens.colorSuccess,
          colorError: themeTokens.colorError,
          colorWarning: themeTokens.colorAccent,
          colorText: themeTokens.colorBrand,
          colorTextSecondary: themeTokens.colorTextMuted,
          colorBgBase: themeTokens.colorBackground,
          colorBorder: themeTokens.colorBorder,
          borderRadius: themeTokens.borderRadius,
          controlHeight: themeTokens.controlHeight,
          fontFamily: themeTokens.fontSans,
        },
        components: {
          Button: {
            primaryShadow: 'none',
          },
          Modal: {
            titleFontSize: 22,
          },
        },
      }}
    >
      <AntApp>{children}</AntApp>
    </ConfigProvider>
  );
}
