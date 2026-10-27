import '../../styles/feedback.css';
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
            titleFontSize: 16,
          },
        },
      }}
    >
      <AntApp message={{top:24,maxCount:3,duration:4}} notification={{placement:'topRight',duration:4,maxCount:3}}>{children}</AntApp>
    </ConfigProvider>
  );
}
