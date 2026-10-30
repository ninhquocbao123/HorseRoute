/**
 * HorseRoute mobile — design tokens.
 * Nguồn màu gốc: apps/web/src/features/home/landing-page.css (:root) và
 * apps/web/src/features/tracking/driver/driver-shell.css. Thang 50–950 nội suy trong OKLCH (05-design-system.md mục 1).
 * Font: Be Vietnam Pro qua @expo-google-fonts/be-vietnam-pro.
 * File độc lập, không import react-native, để copy thẳng vào app Expo.
 */

export const palette = {
  teal: {
    50: '#f2f8f8',
    100: '#e7f1f1',
    200: '#c5d8d8',
    300: '#a3bfc1',
    400: '#81a6aa',
    500: '#608f94',
    600: '#3e777e',
    700: '#14606a',
    800: '#104d56',
    900: '#0b3b42',
    950: '#061416',
  },
  gold: {
    50: '#fef9ec',
    100: '#fbedce',
    200: '#f8e1af',
    300: '#f7d58f',
    400: '#f5c76d',
    500: '#f4b942',
    600: '#ce9025',
    700: '#a86a00',
    800: '#7b4e00',
    900: '#513300',
    950: '#2b1a00',
  },
  neutral: {
    50: '#f6faf9',
    100: '#e7f0f0',
    200: '#d8e6e6',
    300: '#b5c6c7',
    400: '#94a8a9',
    500: '#738a8d',
    600: '#546d71',
    700: '#3c565a',
    800: '#243f43',
    900: '#0d2a2e',
    950: '#061416',
  },
} as const;

export type ColorScale = (typeof palette)[keyof typeof palette];

export interface ColorTokens {
  /** Nền màn hình */
  bg: string;
  /** Nền thẻ, sheet, ô nhập */
  surface: string;
  /** Nền phụ: chip chưa chọn, ô thông tin, skeleton */
  surfaceMuted: string;
  /** Lớp nổi (sheet, dialog). Dark mode sáng hơn thay cho bóng */
  surfaceElevated: string;
  /** Thẻ nổi bật, header đậm, thanh trạng thái */
  surfaceBrand: string;
  /** Thanh thông báo, chỉ báo GPS */
  surfaceBrandAlt: string;
  /** Chữ và icon trên surfaceBrand */
  onBrand: string;
  /** Chữ phụ trên surfaceBrand */
  onBrandMuted: string;
  /** Chữ chính */
  textPrimary: string;
  /** Chữ phụ, nhãn */
  textSecondary: string;
  /** Chữ bị khóa (được miễn yêu cầu tương phản) */
  textDisabled: string;
  /** Đường kẻ phân tách (trang trí) */
  border: string;
  /** Viền ô nhập, checkbox: đạt 3:1 */
  borderInput: string;
  /** Viền đang chọn */
  borderStrong: string;
  /** Nền nút chính. Duy nhất một chỗ mỗi màn */
  accent: string;
  /** Nút chính khi nhấn */
  accentPressed: string;
  /** Chữ trên nút chính */
  onAccent: string;
  /** Chữ vàng (không dùng #f4b942 làm chữ) */
  accentText: string;
  /** Nền nhấn rất nhạt: mục chưa đọc */
  accentSubtle: string;
  /** Liên kết, nút tertiary */
  link: string;
  /** Vòng focus bàn phím, viền ô đang nhập */
  focusRing: string;
  /** Tab đang chọn */
  tabActive: string;
  /** Tab chưa chọn */
  tabInactive: string;
  successFg: string;
  successBg: string;
  successSolid: string;
  warningFg: string;
  warningBg: string;
  warningSolid: string;
  dangerFg: string;
  dangerBg: string;
  dangerSolid: string;
  infoFg: string;
  infoBg: string;
  infoSolid: string;
  neutralFg: string;
  neutralBg: string;
  /** Lớp tối sau sheet và dialog */
  overlay: string;
}

export type ThemeName = 'light' | 'dark';

export interface Theme {
  name: ThemeName;
  colors: ColorTokens;
  /** Dark mode tạo chiều sâu bằng surfaceElevated, không dùng bóng. */
  shadow: ShadowScale;
}

/* ---------- Typography ---------- */

export const fontFamily = {
  regular: 'BeVietnamPro_400Regular',
  medium: 'BeVietnamPro_500Medium',
  semibold: 'BeVietnamPro_600SemiBold',
  bold: 'BeVietnamPro_700Bold',
} as const;

export type FontWeightName = keyof typeof fontFamily;

export interface TextToken {
  /** Android cần tên family riêng cho từng độ đậm, nên không dùng fontWeight. */
  fontFamily: (typeof fontFamily)[FontWeightName];
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
}

export type TypeVariant =
  | 'largeTitle'
  | 'title1'
  | 'title2'
  | 'title3'
  | 'display'
  | 'headline'
  | 'body'
  | 'bodyStrong'
  | 'callout'
  | 'subhead'
  | 'footnote'
  | 'caption'
  | 'buttonLarge'
  | 'button'
  | 'buttonSmall';

const t = (w: FontWeightName, fontSize: number, lineHeight: number, letterSpacing = 0): TextToken => ({
  fontFamily: fontFamily[w],
  fontSize,
  lineHeight,
  letterSpacing,
});

/** Thang iOS. lineHeight cao hơn iOS 1–2pt để dấu chồng tiếng Việt (ệ, ộ, ữ) không bị cắt. */
export const typography: Record<TypeVariant, TextToken> = {
  largeTitle: t('bold', 34, 42, -0.4),
  title1: t('bold', 28, 36, -0.3),
  title2: t('semibold', 22, 30, -0.2),
  title3: t('semibold', 20, 28, -0.1),
  /** Chỉ tài xế: tên điểm kế tiếp trên DRV-02. */
  display: t('bold', 24, 32, -0.2),
  headline: t('semibold', 17, 24),
  body: t('regular', 17, 26),
  bodyStrong: t('semibold', 17, 26),
  callout: t('regular', 16, 24),
  subhead: t('regular', 15, 22),
  footnote: t('regular', 13, 19),
  caption: t('medium', 12, 18, 0.1),
  buttonLarge: t('semibold', 18, 24),
  button: t('semibold', 17, 22),
  buttonSmall: t('semibold', 15, 20),
};

/* ---------- Spacing, radius, size ---------- */

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  x3l: 40,
  x4l: 48,
  x5l: 64,
} as const;

export type SpacingToken = keyof typeof spacing;

/** Lề ngang chuẩn của mọi màn. */
export const screenPadding = spacing.md;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
} as const;

export type RadiusToken = keyof typeof radius;

export const size = {
  touchTarget: 44,
  touchTargetLarge: 56,
  /** Nút chính đáy màn của tài xế (DRV-02). */
  driverPrimaryButton: 64,
  inputHeight: 52,
  tabBarHeight: 56,
  headerHeight: 52,
  icon: { sm: 16, md: 20, lg: 24 },
  iconStroke: 2,
} as const;

/* ---------- Shadow ---------- */

export interface ShadowToken {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  /** Android. */
  elevation: number;
}

export interface ShadowScale {
  none: ShadowToken;
  sm: ShadowToken;
  md: ShadowToken;
  lg: ShadowToken;
}

const sh = (y: number, r: number, opacity: number, elevation: number): ShadowToken => ({
  shadowColor: '#0b3b42',
  shadowOffset: { width: 0, height: y },
  shadowOpacity: opacity,
  shadowRadius: r,
  elevation,
});

const noShadow: ShadowToken = sh(0, 0, 0, 0);

const lightShadow: ShadowScale = {
  none: noShadow,
  /** Thẻ nổi trên nền bg. Ưu tiên đường kẻ border trước khi dùng. */
  sm: sh(1, 2, 0.04, 1),
  /** Thanh nút cố định đáy, tab bar. */
  md: sh(4, 12, 0.06, 3),
  /** Bottom sheet, dialog, toast. */
  lg: sh(12, 32, 0.1, 8),
};

const darkShadow: ShadowScale = { none: noShadow, sm: noShadow, md: noShadow, lg: noShadow };

/* ---------- Motion ---------- */

export type CubicBezier = readonly [number, number, number, number];

export const motion = {
  duration: { fast: 150, base: 250, slow: 350 },
  easing: {
    /** Đổi trạng thái tại chỗ. */
    standard: [0.2, 0, 0, 1] as CubicBezier,
    /** Phần tử đi vào: sheet, toast. */
    enter: [0, 0, 0, 1] as CubicBezier,
    /** Phần tử đi ra. */
    exit: [0.3, 0, 1, 1] as CubicBezier,
  },
  spring: {
    /** Bottom sheet mở và kéo thả. */
    sheet: { damping: 28, stiffness: 280, mass: 1 },
    /** Phản hồi nhấn nút. */
    press: { damping: 20, stiffness: 400, mass: 1 },
  },
  pressScale: 0.98,
  /** Thời gian hiện thanh Hoàn tác (DRV-02). */
  undoWindowMs: 5000,
} as const;

/* ---------- Themes ---------- */

export const lightTheme: Theme = {
  name: 'light',
  colors: {
    bg: '#f6faf9',
    surface: '#ffffff',
    surfaceMuted: '#e7f1f1',
    surfaceElevated: '#ffffff',
    surfaceBrand: '#0b3b42',
    surfaceBrandAlt: '#14606a',
    onBrand: '#ffffff',
    onBrandMuted: '#b9d3d6',
    textPrimary: '#0d2a2e',
    textSecondary: '#546d71',
    textDisabled: '#94a8a9',
    border: '#d8e6e6',
    borderInput: '#738a8d',
    borderStrong: '#0b3b42',
    accent: '#f4b942',
    accentPressed: '#ce9025',
    onAccent: '#2b1a00',
    accentText: '#7b4e00',
    accentSubtle: '#fef9ec',
    link: '#14606a',
    focusRing: '#14606a',
    tabActive: '#0b3b42',
    tabInactive: '#546d71',
    successFg: '#166534',
    successBg: '#eaf6ee',
    successSolid: '#166534',
    warningFg: '#a24a05',
    warningBg: '#fdf1e4',
    warningSolid: '#b45309',
    dangerFg: '#b42318',
    dangerBg: '#fdeceb',
    dangerSolid: '#dc2626',
    infoFg: '#14606a',
    infoBg: '#f2f8f8',
    infoSolid: '#14606a',
    neutralFg: '#546d71',
    neutralBg: '#e7f0f0',
    overlay: 'rgba(6,20,22,0.48)',
  },
  shadow: lightShadow,
};

export const darkTheme: Theme = {
  name: 'dark',
  colors: {
    bg: '#061416',
    surface: '#0c2326',
    surfaceMuted: '#08191b',
    surfaceElevated: '#133034',
    surfaceBrand: '#104d56',
    surfaceBrandAlt: '#14606a',
    onBrand: '#ffffff',
    onBrandMuted: '#b9d3d6',
    textPrimary: '#e8f4f4',
    textSecondary: '#96b4b7',
    textDisabled: '#55716f',
    border: '#1a3a3e',
    borderInput: '#56777a',
    borderStrong: '#96b4b7',
    accent: '#f4b942',
    accentPressed: '#f5c76d',
    onAccent: '#2b1a00',
    accentText: '#f5c76d',
    accentSubtle: '#2a2410',
    link: '#7cc7cf',
    focusRing: '#7cc7cf',
    tabActive: '#e8f4f4',
    tabInactive: '#96b4b7',
    successFg: '#6fd39a',
    successBg: '#0f2a1e',
    successSolid: '#17753f',
    warningFg: '#f3a35c',
    warningBg: '#2e1f0f',
    warningSolid: '#b45309',
    dangerFg: '#ff8a80',
    dangerBg: '#341514',
    dangerSolid: '#dc2626',
    infoFg: '#7cc7cf',
    infoBg: '#0f2e33',
    infoSolid: '#14606a',
    neutralFg: '#96b4b7',
    neutralBg: '#12302f',
    overlay: 'rgba(0,0,0,0.6)',
  },
  shadow: darkShadow,
};

export const themes: Record<ThemeName, Theme> = { light: lightTheme, dark: darkTheme };

/* ---------- Trạng thái nghiệp vụ ---------- */

/** Mọi nhãn trạng thái có màu + icon + chữ, không truyền nghĩa chỉ bằng màu. */
export type StatusTone = 'neutral' | 'info' | 'brand' | 'success' | 'warning' | 'danger';

export interface ToneColors {
  fg: string;
  bg: string;
}

export const toneColors = (theme: Theme, tone: StatusTone): ToneColors => {
  const c = theme.colors;
  switch (tone) {
    case 'neutral':
      return { fg: c.neutralFg, bg: c.neutralBg };
    case 'info':
      return { fg: c.infoFg, bg: c.infoBg };
    case 'brand':
      return { fg: c.onBrand, bg: c.surfaceBrand };
    case 'success':
      return { fg: c.successFg, bg: c.successBg };
    case 'warning':
      return { fg: c.warningFg, bg: c.warningBg };
    case 'danger':
      return { fg: c.dangerFg, bg: c.dangerBg };
  }
};

/** Tên icon Lucide (lucide-react-native, PascalCase khi import). */
export interface StatusSpec {
  label: string;
  tone: StatusTone;
  icon: string;
}

export type OrderStatus = 'DRAFT' | 'PENDING' | 'NEED_INFO' | 'REJECTED' | 'APPROVED' | 'PREPARING' | 'READY' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED';

/** orders.status (01 mục 5.1). */
export const orderStatus: Record<OrderStatus, StatusSpec> = {
  DRAFT: { label: 'Nháp', tone: 'neutral', icon: 'file-pen-line' },
  PENDING: { label: 'Chờ duyệt', tone: 'info', icon: 'clock' },
  NEED_INFO: { label: 'Cần bổ sung', tone: 'warning', icon: 'circle-alert' },
  REJECTED: { label: 'Từ chối', tone: 'danger', icon: 'circle-x' },
  APPROVED: { label: 'Đã duyệt', tone: 'info', icon: 'badge-check' },
  PREPARING: { label: 'Đang chuẩn bị', tone: 'info', icon: 'package' },
  READY: { label: 'Sẵn sàng vận chuyển', tone: 'info', icon: 'calendar-check' },
  IN_TRANSIT: { label: 'Đang vận chuyển', tone: 'brand', icon: 'truck' },
  DELIVERED: { label: 'Đã giao', tone: 'success', icon: 'circle-check' },
  CANCELLED: { label: 'Đã hủy', tone: 'neutral', icon: 'ban' },
};

export type CustomerActionStatus = 'AWAITING_DEPOSIT';

/** Nhãn ghép cho khách (không phải cột DB): đơn APPROVED có báo giá chưa cọc. */
export const customerActionStatus: Record<CustomerActionStatus, StatusSpec> = {
  AWAITING_DEPOSIT: { label: 'Chờ đặt cọc', tone: 'warning', icon: 'wallet' },
};

export type LegStatus = 'NOT_STARTED' | 'MOVING' | 'AT_STOP' | 'COMPLETED';

/** legs.status (01 mục 5.2). */
export const legStatus: Record<LegStatus, StatusSpec> = {
  NOT_STARTED: { label: 'Chưa bắt đầu', tone: 'neutral', icon: 'circle-dashed' },
  MOVING: { label: 'Đang di chuyển', tone: 'brand', icon: 'truck' },
  AT_STOP: { label: 'Đang dừng', tone: 'info', icon: 'map-pin' },
  COMPLETED: { label: 'Hoàn thành', tone: 'success', icon: 'circle-check' },
};

export type SyncStatus = 'QUEUED' | 'SENDING' | 'SENT' | 'REJECTED';

/** Trạng thái của một mục trong hàng chờ offline (COM-12). */
export const syncStatus: Record<SyncStatus, StatusSpec> = {
  QUEUED: { label: 'Chờ gửi', tone: 'warning', icon: 'cloud-off' },
  SENDING: { label: 'Đang gửi', tone: 'info', icon: 'refresh-cw' },
  SENT: { label: 'Đã gửi', tone: 'success', icon: 'check' },
  REJECTED: { label: 'Bị từ chối', tone: 'danger', icon: 'circle-x' },
};

export type IncidentStatus = 'NEW' | 'ACKNOWLEDGED' | 'CLOSED';

/** incidents.status (01 mục 5.3). */
export const incidentStatus: Record<IncidentStatus, StatusSpec> = {
  NEW: { label: 'Đã gửi, chờ tiếp nhận', tone: 'warning', icon: 'send' },
  ACKNOWLEDGED: { label: 'Đã tiếp nhận', tone: 'info', icon: 'user-check' },
  CLOSED: { label: 'Đã đóng', tone: 'neutral', icon: 'circle-check' },
};

export type IncidentSeverity = 'LOW' | 'MEDIUM' | 'HIGH';

/** Mức độ sự cố. Hiển thị kèm vạch 1-2-3, không chỉ màu. */
export const incidentSeverity: Record<IncidentSeverity, StatusSpec> = {
  LOW: { label: 'Nhẹ', tone: 'neutral', icon: 'signal-low' },
  MEDIUM: { label: 'Trung bình', tone: 'warning', icon: 'signal-medium' },
  HIGH: { label: 'Nghiêm trọng', tone: 'danger', icon: 'signal-high' },
};

export type HorseCondition = 'STABLE' | 'OFF_FEED' | 'STRESSED' | 'CLIMATE_CHANGE';

/** horse_logs.condition_status (01 mục 4.9). */
export const horseCondition: Record<HorseCondition, StatusSpec> = {
  STABLE: { label: 'Sức khỏe ổn định', tone: 'success', icon: 'heart-pulse' },
  OFF_FEED: { label: 'Bỏ ăn', tone: 'warning', icon: 'utensils-crossed' },
  STRESSED: { label: 'Căng thẳng', tone: 'warning', icon: 'activity' },
  CLIMATE_CHANGE: { label: 'Khí hậu thay đổi', tone: 'info', icon: 'thermometer' },
};

export type HealthReportStatus = 'DRAFT' | 'SENT' | 'VIEWED';

/** horse_logs.report_status, thêm VIEWED khi khách đã mở (customer_viewed_at). */
export const healthReportStatus: Record<HealthReportStatus, StatusSpec> = {
  DRAFT: { label: 'Nháp', tone: 'neutral', icon: 'file-pen-line' },
  SENT: { label: 'Đã gửi', tone: 'success', icon: 'send' },
  VIEWED: { label: 'Khách đã xem', tone: 'info', icon: 'eye' },
};

export type DocumentStatus = 'NOT_SUBMITTED' | 'SUBMITTED' | 'VALID' | 'INVALID' | 'EXPIRED';

/** Giấy tờ ngựa (01 mục 5.5). */
export const documentStatus: Record<DocumentStatus, StatusSpec> = {
  NOT_SUBMITTED: { label: 'Chưa nộp', tone: 'neutral', icon: 'file' },
  SUBMITTED: { label: 'Chờ kiểm tra', tone: 'info', icon: 'file-clock' },
  VALID: { label: 'Hợp lệ', tone: 'success', icon: 'file-check' },
  INVALID: { label: 'Không hợp lệ', tone: 'danger', icon: 'file-x' },
  EXPIRED: { label: 'Hết hạn', tone: 'danger', icon: 'calendar-x' },
};

export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';

/** Phiên thanh toán (chỉ xem trên mobile). */
export const paymentStatus: Record<PaymentStatus, StatusSpec> = {
  PENDING: { label: 'Đang chờ thanh toán', tone: 'warning', icon: 'hourglass' },
  SUCCESS: { label: 'Đã thanh toán', tone: 'success', icon: 'circle-check' },
  FAILED: { label: 'Thanh toán thất bại', tone: 'danger', icon: 'circle-x' },
  CANCELLED: { label: 'Đã hủy', tone: 'neutral', icon: 'ban' },
};

export type OrderHorseStatus = 'NORMAL' | 'FLAGGED' | 'REMOVED';

/** Ngựa trong đơn. FLAGGED chặn xuất phát. */
export const orderHorseStatus: Record<OrderHorseStatus, StatusSpec> = {
  NORMAL: { label: 'Bình thường', tone: 'neutral', icon: 'check' },
  FLAGGED: { label: 'Bị gắn cờ', tone: 'danger', icon: 'flag' },
  REMOVED: { label: 'Đã rút khỏi đơn', tone: 'neutral', icon: 'circle-minus' },
};
