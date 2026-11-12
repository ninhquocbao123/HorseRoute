/**
 * Cửa khẩu đường bộ cho chuyến quốc tế (kế hoạch điều phối tự động 12/11/2026, mục 4).
 * Mỗi cặp cửa khẩu có hai điểm: phía rời đi (tài xế check-in "đã đến cửa khẩu") và phía bên kia (check-in "đã qua cửa khẩu").
 * Theo quyết định H4, H5 của Long: trong phạm vi đề tài mọi cửa khẩu dưới đây coi như nhận ngựa sống, chỉ kiểm tra giấy tờ.
 * Tọa độ lấy gần đúng từ OpenStreetMap; OSRM tự bám vào đường gần nhất (tối đa 5 km).
 */
export type GateSide = { name: string; country: string; latitude: number; longitude: number };
export type BorderGate = { code: string; name: string; exit: GateSide; entry: GateSide };
/** Một hành lang là chuỗi cặp cửa khẩu phải đi qua theo thứ tự để tới nước nhận. */
export type BorderCorridor = { code: string; name: string; destinationCountry: 'CN' | 'TH'; gates: BorderGate[] };

const VN = 'Việt Nam', CN = 'Trung Quốc', LA = 'Lào', KH = 'Campuchia', TH = 'Thái Lan';
const gate = (code: string, name: string, exit: GateSide, entry: GateSide): BorderGate => ({ code, name, exit, entry });

export const BORDER_GATES = {
  HUU_NGHI: gate('HUU_NGHI', 'Hữu Nghị – Hữu Nghị Quan',
    { name: 'Cửa khẩu Hữu Nghị (Lạng Sơn)', country: VN, latitude: 21.9706, longitude: 106.7050 },
    { name: 'Cửa khẩu Hữu Nghị Quan (Quảng Tây)', country: CN, latitude: 21.9800, longitude: 106.7095 }),
  MONG_CAI: gate('MONG_CAI', 'Móng Cái – Đông Hưng',
    { name: 'Cửa khẩu Móng Cái (Quảng Ninh)', country: VN, latitude: 21.5320, longitude: 107.9620 },
    { name: 'Cửa khẩu Đông Hưng (Quảng Tây)', country: CN, latitude: 21.5470, longitude: 107.9720 }),
  LAO_CAI: gate('LAO_CAI', 'Lào Cai – Hà Khẩu',
    { name: 'Cửa khẩu Lào Cai (Kim Thành)', country: VN, latitude: 22.5050, longitude: 103.9640 },
    { name: 'Cửa khẩu Hà Khẩu (Vân Nam)', country: CN, latitude: 22.5130, longitude: 103.9590 }),
  TA_LUNG: gate('TA_LUNG', 'Tà Lùng – Thủy Khẩu',
    { name: 'Cửa khẩu Tà Lùng (Cao Bằng)', country: VN, latitude: 22.4890, longitude: 106.5660 },
    { name: 'Cửa khẩu Thủy Khẩu (Quảng Tây)', country: CN, latitude: 22.4950, longitude: 106.5640 }),
  THANH_THUY: gate('THANH_THUY', 'Thanh Thủy – Thiên Bảo',
    { name: 'Cửa khẩu Thanh Thủy (Hà Giang)', country: VN, latitude: 22.9020, longitude: 104.8380 },
    { name: 'Cửa khẩu Thiên Bảo (Vân Nam)', country: CN, latitude: 22.9150, longitude: 104.8450 }),
  LAO_BAO: gate('LAO_BAO', 'Lao Bảo – Đen Sa Vẳn',
    { name: 'Cửa khẩu Lao Bảo (Quảng Trị)', country: VN, latitude: 16.6200, longitude: 106.5935 },
    { name: 'Cửa khẩu Đen Sa Vẳn (Savannakhet)', country: LA, latitude: 16.6230, longitude: 106.5830 }),
  SAVANNAKHET: gate('SAVANNAKHET', 'Savannakhet – Mukdahan (cầu Hữu Nghị 2)',
    { name: 'Cửa khẩu Savannakhet (Lào)', country: LA, latitude: 16.6010, longitude: 104.7580 },
    { name: 'Cửa khẩu Mukdahan (Thái Lan)', country: TH, latitude: 16.5890, longitude: 104.7280 }),
  CAU_TREO: gate('CAU_TREO', 'Cầu Treo – Nậm Phao',
    { name: 'Cửa khẩu Cầu Treo (Hà Tĩnh)', country: VN, latitude: 18.3850, longitude: 105.1470 },
    { name: 'Cửa khẩu Nậm Phao (Bolikhamxay)', country: LA, latitude: 18.3930, longitude: 105.1370 }),
  THAKHEK: gate('THAKHEK', 'Thakhek – Nakhon Phanom (cầu Hữu Nghị 3)',
    { name: 'Cửa khẩu Thakhek (Lào)', country: LA, latitude: 17.4380, longitude: 104.7860 },
    { name: 'Cửa khẩu Nakhon Phanom (Thái Lan)', country: TH, latitude: 17.4430, longitude: 104.7600 }),
  MOC_BAI: gate('MOC_BAI', 'Mộc Bài – Bavet',
    { name: 'Cửa khẩu Mộc Bài (Tây Ninh)', country: VN, latitude: 11.0770, longitude: 106.1490 },
    { name: 'Cửa khẩu Bavet (Svay Rieng)', country: KH, latitude: 11.0830, longitude: 106.1400 }),
  POIPET: gate('POIPET', 'Poipet – Aranyaprathet',
    { name: 'Cửa khẩu Poipet (Campuchia)', country: KH, latitude: 13.6595, longitude: 102.5590 },
    { name: 'Cửa khẩu Aranyaprathet (Thái Lan)', country: TH, latitude: 13.6610, longitude: 102.5480 }),
} satisfies Record<string, BorderGate>;

const g = BORDER_GATES;
export const BORDER_CORRIDORS: BorderCorridor[] = [
  { code: 'CN_HUU_NGHI', name: 'Qua cửa khẩu Hữu Nghị', destinationCountry: 'CN', gates: [g.HUU_NGHI] },
  { code: 'CN_MONG_CAI', name: 'Qua cửa khẩu Móng Cái', destinationCountry: 'CN', gates: [g.MONG_CAI] },
  { code: 'CN_LAO_CAI', name: 'Qua cửa khẩu Lào Cai', destinationCountry: 'CN', gates: [g.LAO_CAI] },
  { code: 'CN_TA_LUNG', name: 'Qua cửa khẩu Tà Lùng', destinationCountry: 'CN', gates: [g.TA_LUNG] },
  { code: 'CN_THANH_THUY', name: 'Qua cửa khẩu Thanh Thủy', destinationCountry: 'CN', gates: [g.THANH_THUY] },
  { code: 'TH_R9', name: 'Đường 9 qua Lào: Lao Bảo → Savannakhet – Mukdahan', destinationCountry: 'TH', gates: [g.LAO_BAO, g.SAVANNAKHET] },
  { code: 'TH_R8', name: 'Đường 8 qua Lào: Cầu Treo → Thakhek – Nakhon Phanom', destinationCountry: 'TH', gates: [g.CAU_TREO, g.THAKHEK] },
  { code: 'TH_KH', name: 'Qua Campuchia: Mộc Bài → Poipet – Aranyaprathet', destinationCountry: 'TH', gates: [g.MOC_BAI, g.POIPET] },
];

export const corridorsTo = (country: string) => BORDER_CORRIDORS.filter(corridor => corridor.destinationCountry === country);
export const findCorridor = (code: string) => BORDER_CORRIDORS.find(corridor => corridor.code === code);
