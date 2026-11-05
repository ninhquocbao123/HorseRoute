/**
 * HorseRoute mobile: design tokens (bản code của docs/mobile-design/tokens/theme.ts, đã áp review 07).
 * Màu gốc: apps/web landing-page.css và driver-shell.css. Chỉ teal, vàng, trắng; vàng chỉ cho MỘT nút chính mỗi màn.
 * Thay đổi so với bản thiết kế: xem docs/mobile-design/changelog.md.
 */

export const palette = {
  teal: {
    50: '#f2f8f8', 100: '#e7f1f1', 200: '#c5d8d8', 300: '#a3bfc1', 400: '#81a6aa', 500: '#608f94',
    600: '#3e777e', 700: '#14606a', 800: '#104d56', 900: '#0b3b42', 950: '#061416',
  },
  gold: {
    50: '#fef9ec', 100: '#fbedce', 200: '#f8e1af', 300: '#f7d58f', 400: '#f5c76d', 500: '#f4b942',
    600: '#ce9025', 700: '#a86a00', 800: '#7b4e00', 900: '#513300', 950: '#2b1a00',
  },
} as const;

export interface ColorTokens {
  bg: string;
  surface: string;
  surfaceMuted: string;
  surfaceElevated: string;
  surfaceBrand: string;
  surfaceBrandAlt: string;
  onBrand: string;
  /** R-24: chữ phụ trên nền đậm, ≥ 4.5:1 ở cả đầu sáng của gradient */
  onBrandMuted: string;
  textPrimary: string;
  textSecondary: string;
  textDisabled: string;
  /** Placeholder dùng textSecondary (R-22), không dùng textDisabled */
  placeholder: string;
  border: string;
  borderInput: string;
  borderStrong: string;
  accent: string;
  accentPressed: string;
  onAccent: string;
  accentText: string;
  accentSubtle: string;
  link: string;
  focusRing: string;
  tabActive: string;
  tabInactive: string;
  /** R-08: chip đang chọn đạt ≥ 3:1 với chip chưa chọn ở cả hai chế độ */
  chipSelectedBg: string;
  chipSelectedFg: string;
  chipBg: string;
  chipBorder: string;
  /** R-20: số đếm, nhãn "Mới": teal, không dùng vàng */
  countBg: string;
  countFg: string;
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
  overlay: string;
}

/** R-52: màu bản đồ SVG (DRV-05, CUS-05) */
export interface MapTokens {
  land: string;
  water: string;
  road: string;
  routeDone: string;
  routeAhead: string;
  routeAir: string;
  stop: string;
  stopRing: string;
  vehicle: string;
  estimateHalo: string;
  label: string;
}

export type ThemeName = 'light' | 'dark';

export interface Theme {
  name: ThemeName;
  colors: ColorTokens;
  map: MapTokens;
  shadow: ShadowScale;
}

/* ---------- Chữ ---------- */

export const fontFamily = {
  regular: 'BeVietnamPro_400Regular',
  medium: 'BeVietnamPro_500Medium',
  semibold: 'BeVietnamPro_600SemiBold',
  bold: 'BeVietnamPro_700Bold',
} as const;

export type FontWeightName = keyof typeof fontFamily;

export interface TextToken {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
}

/**
 * R-05: đúng 4 cỡ chữ cho cả app: 24 (thông tin chính), 17 (nội dung, nút), 15 (phụ), 12 (nhãn nhỏ).
 * Các biến thể chỉ khác độ đậm. lineHeight cao để dấu chồng tiếng Việt không bị cắt.
 */
export const fontSize = { xl: 24, md: 17, sm: 15, xs: 12 } as const;

const t = (w: FontWeightName, size: number, lineHeight: number, letterSpacing = 0): TextToken => ({
  fontFamily: fontFamily[w],
  fontSize: size,
  lineHeight,
  letterSpacing,
});

export const typography = {
  /** Tiêu đề màn, tên điểm kế tiếp, giờ dự kiến (R-06) */
  title: t('bold', fontSize.xl, 32, -0.2),
  headline: t('semibold', fontSize.md, 24),
  body: t('regular', fontSize.md, 26),
  bodyStrong: t('semibold', fontSize.md, 26),
  sub: t('regular', fontSize.sm, 22),
  subStrong: t('semibold', fontSize.sm, 22),
  caption: t('medium', fontSize.xs, 18, 0.2),
  button: t('semibold', fontSize.md, 22),
} as const;

export type TypeVariant = keyof typeof typography;

/* ---------- Khoảng cách, bo góc, kích thước ---------- */

export const spacing = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 20, xl: 24, xxl: 32, x3l: 40, x4l: 48, x5l: 64 } as const;
export const screenPadding = spacing.md;
export const radius = { sm: 8, md: 12, lg: 16, xl: 24, full: 999 } as const;

export const size = {
  /** Khách hàng: ≥ 48 (R-27: chip lọc 44 là mức tối thiểu tuyệt đối) */
  touchTarget: 48,
  chipFilter: 44,
  /** Tài xế và hộ tống: mọi phần tử bấm được ≥ 56 (R-03, R-04) */
  touchTargetLarge: 56,
  driverPrimaryButton: 64,
  /** R-28: thống nhất 56 */
  inputHeight: 56,
  tabBarHeight: 64,
  headerHeight: 56,
  icon: { sm: 16, md: 20, lg: 24 },
  iconStroke: 2,
} as const;

/* ---------- Bóng ---------- */

export interface ShadowToken {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
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
const noShadow = sh(0, 0, 0, 0);
const lightShadow: ShadowScale = { none: noShadow, sm: sh(1, 2, 0.04, 1), md: sh(4, 12, 0.06, 3), lg: sh(12, 32, 0.1, 8) };
const darkShadow: ShadowScale = { none: noShadow, sm: noShadow, md: noShadow, lg: noShadow };

export const motion = {
  duration: { fast: 150, base: 250, slow: 350 },
  /** Thanh Hoàn tác (DRV-02). R-43: kéo dài khi bật trình đọc màn hình */
  undoWindowMs: 5000,
  undoWindowScreenReaderMs: 12000,
  /** Thông báo trên cùng kiểu iOS */
  topNoticeMs: 3000,
} as const;

/* ---------- Hai chế độ ---------- */

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
    onBrandMuted: '#d3e5e7',
    textPrimary: '#0d2a2e',
    textSecondary: '#546d71',
    textDisabled: '#94a8a9',
    placeholder: '#546d71',
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
    chipSelectedBg: '#0b3b42',
    chipSelectedFg: '#ffffff',
    chipBg: '#ffffff',
    chipBorder: '#b5c6c7',
    countBg: '#0b3b42',
    countFg: '#ffffff',
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
  map: {
    land: '#eaf2ef',
    water: '#cfe3e6',
    road: '#ffffff',
    routeDone: '#14606a',
    routeAhead: '#0b3b42',
    routeAir: '#608f94',
    stop: '#ffffff',
    stopRing: '#0b3b42',
    vehicle: '#f4b942',
    estimateHalo: 'rgba(20,96,106,0.18)',
    label: '#0d2a2e',
  },
  shadow: lightShadow,
};

export const darkTheme: Theme = {
  name: 'dark',
  colors: {
    bg: '#061416',
    /** R-25: thẻ tách nền rõ hơn (#0c2326 → #102b2f), đường kẻ ≥ 1.5:1 */
    surface: '#102b2f',
    surfaceMuted: '#0a1f22',
    surfaceElevated: '#163539',
    surfaceBrand: '#104d56',
    surfaceBrandAlt: '#14606a',
    onBrand: '#ffffff',
    onBrandMuted: '#d3e5e7',
    textPrimary: '#e8f4f4',
    textSecondary: '#a3bfc1',
    textDisabled: '#5d7a7c',
    placeholder: '#a3bfc1',
    border: '#2a5055',
    borderInput: '#6b8c8f',
    borderStrong: '#a3bfc1',
    accent: '#f4b942',
    accentPressed: '#f5c76d',
    onAccent: '#2b1a00',
    accentText: '#f5c76d',
    accentSubtle: '#2a2410',
    link: '#7cc7cf',
    focusRing: '#7cc7cf',
    tabActive: '#e8f4f4',
    tabInactive: '#a3bfc1',
    /** R-08: nền sáng chữ teal đậm, tương phản cao với chip chưa chọn */
    chipSelectedBg: '#e8f4f4',
    chipSelectedFg: '#0b3b42',
    chipBg: '#102b2f',
    chipBorder: '#4d7377',
    countBg: '#7cc7cf',
    countFg: '#061416',
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
    neutralFg: '#a3bfc1',
    neutralBg: '#12302f',
    overlay: 'rgba(0,0,0,0.6)',
  },
  map: {
    land: '#0b1f22',
    water: '#0f2e33',
    road: '#1d3d41',
    routeDone: '#7cc7cf',
    routeAhead: '#e8f4f4',
    routeAir: '#81a6aa',
    stop: '#061416',
    stopRing: '#e8f4f4',
    vehicle: '#f4b942',
    estimateHalo: 'rgba(124,199,207,0.2)',
    label: '#e8f4f4',
  },
  shadow: darkShadow,
};

/* ---------- Trạng thái nghiệp vụ ---------- */

export type StatusTone = 'neutral' | 'info' | 'brand' | 'success' | 'warning' | 'danger';

export const toneColors = (theme: Theme, tone: StatusTone) => {
  const c = theme.colors;
  switch (tone) {
    case 'neutral': return { fg: c.neutralFg, bg: c.neutralBg };
    case 'info': return { fg: c.infoFg, bg: c.infoBg };
    case 'brand': return { fg: c.onBrand, bg: c.surfaceBrand };
    case 'success': return { fg: c.successFg, bg: c.successBg };
    case 'warning': return { fg: c.warningFg, bg: c.warningBg };
    case 'danger': return { fg: c.dangerFg, bg: c.dangerBg };
  }
};

export interface StatusSpec {
  label: string;
  tone: StatusTone;
  icon: string;
}

export const orderStatus: Record<string, StatusSpec> = {
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
  AWAITING_DEPOSIT: { label: 'Chờ đặt cọc', tone: 'warning', icon: 'wallet' },
};

export const legStatus: Record<string, StatusSpec> = {
  NOT_STARTED: { label: 'Chưa bắt đầu', tone: 'neutral', icon: 'circle-dashed' },
  MOVING: { label: 'Đang di chuyển', tone: 'brand', icon: 'truck' },
  AT_STOP: { label: 'Đang dừng', tone: 'info', icon: 'map-pin' },
  COMPLETED: { label: 'Hoàn thành', tone: 'success', icon: 'circle-check' },
};

export const syncStatus: Record<string, StatusSpec> = {
  QUEUED: { label: 'Chờ gửi', tone: 'warning', icon: 'cloud-off' },
  SENDING: { label: 'Đang gửi', tone: 'info', icon: 'refresh-cw' },
  SENT: { label: 'Đã gửi', tone: 'success', icon: 'check' },
  REJECTED: { label: 'Bị từ chối', tone: 'danger', icon: 'circle-x' },
};

export const incidentStatus: Record<string, StatusSpec> = {
  NEW: { label: 'Đã gửi, chờ tiếp nhận', tone: 'warning', icon: 'send' },
  ACKNOWLEDGED: { label: 'Đã tiếp nhận', tone: 'info', icon: 'user-check' },
  CLOSED: { label: 'Đã xử lý xong', tone: 'neutral', icon: 'circle-check' },
};

/** R-15: khóa đúng API incidents.severity. Luôn hiện kèm vạch 1-2-3 và chữ */
export const incidentSeverity: Record<'RED' | 'ORANGE' | 'YELLOW', StatusSpec & { level: 1 | 2 | 3 }> = {
  YELLOW: { label: 'Nhẹ', tone: 'neutral', icon: 'signal-low', level: 1 },
  ORANGE: { label: 'Trung bình', tone: 'warning', icon: 'signal-medium', level: 2 },
  RED: { label: 'Nghiêm trọng', tone: 'danger', icon: 'signal-high', level: 3 },
};

export const horseCondition: Record<string, StatusSpec> = {
  STABLE: { label: 'Sức khỏe ổn định', tone: 'success', icon: 'heart-pulse' },
  OFF_FEED: { label: 'Bỏ ăn', tone: 'warning', icon: 'utensils-crossed' },
  STRESSED: { label: 'Căng thẳng', tone: 'warning', icon: 'activity' },
  CLIMATE_CHANGE: { label: 'Khí hậu thay đổi', tone: 'info', icon: 'thermometer' },
};

/** R-44: mức ăn uống dùng "Không ăn" để không trùng tình trạng "Bỏ ăn" */
export const appetiteLabel: Record<string, string> = { NORMAL: 'Bình thường', REDUCED: 'Ăn ít', REFUSED: 'Không ăn' };

export const healthReportStatus: Record<string, StatusSpec> = {
  DRAFT: { label: 'Nháp', tone: 'neutral', icon: 'file-pen-line' },
  SENT: { label: 'Đã gửi', tone: 'success', icon: 'send' },
  VIEWED: { label: 'Khách đã xem', tone: 'info', icon: 'eye' },
};

/** R-38, B8: khoảng bình thường để ESC-04 và CUS-06 cảnh báo giống nhau */
export const vitalsNormal = {
  bodyTempC: { min: 37.2, max: 38.6 },
  heartRateBpm: { min: 28, max: 44 },
} as const;
