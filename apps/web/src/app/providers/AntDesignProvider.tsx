import type { ReactNode } from 'react';
import { App as AntApp, ConfigProvider } from 'antd';
import viVN from 'antd/locale/vi_VN';
import dayjs from 'dayjs';
import 'dayjs/locale/vi';

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
          colorPrimary: '#193e32',
          colorSuccess: '#275338',
          colorError: '#a32d28',
          colorWarning: '#b09050',
          colorText: '#193e32',
          colorTextSecondary: '#68756e',
          colorBgBase: '#fbfaf6',
          colorBorder: '#d7dcd1',
          borderRadius: 4,
          controlHeight: 44,
          fontFamily: '"Segoe UI", Arial, Helvetica, sans-serif',
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
