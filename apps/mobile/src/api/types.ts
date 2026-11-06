// API contracts mirror the existing backend and shared tracking DTOs; no fixture values.
export type { IUser } from "../../../../packages/shared/src/types/user.type";
export type {
  IDriverTripSummary,
  IDriverTripDetail,
  ILegTracking,
  IOrderTimeline,
  IHorseReport,
  IHorseLog,
  IIncident,
  ICareActivityList,
} from "../../../../packages/shared/src/types/tracking.type";
export type { ITripMap } from "../../../../packages/shared/src/types/trackmap.type";
export type Profile = {
  id: string;
  revision: number;
  name: string;
  passportNo: string;
  breed: string;
  birthDate: string;
  sex: "" | "Đực" | "Cái";
  coatColor: string;
  microchip: string;
  weightKg: number | null;
  heightCm: number | null;
  ownerName: string;
  feed: string;
  note: string;
  documentNote: string;
  activeOrderId?: string | null;
  activeOrderCode?: string | null;
  files: {
    id: string;
    kind: "PHOTO" | "DOCUMENT";
    slot: string;
    original_name: string;
  }[];
  documents: {
    id: string;
    document_type_id: string;
    status: string;
    invalid_reason: string | null;
    expiry_date: string | null;
    order_id: string;
    order_code: string;
  }[];
};
export type ProfileInput = Omit<
  Profile,
  | "id"
  | "birthDate"
  | "files"
  | "documents"
  | "activeOrderId"
  | "activeOrderCode"
  | "revision"
> & {
  birthDate?: string;
  revision?: number;
};
export type Order = {
  id: string;
  order_code: string;
  status: string;
  origin_address: string | null;
  destination_address: string | null;
  origin_country: string | null;
  destination_country: string | null;
  desired_departure_date: string | null;
  horse_count?: number;
  horse_names?: string;
  quote_total?: number | string | null;
  quote_deposit?: number | string | null;
  quote_expires_at?: string | null;
  arrived_at_delivery?: number | boolean;
  paid?: number | string;
  manager_note?: string | null;
};
export type OrderHorse = {
  id?: string;
  profileId?: string;
  name: string;
  passportNo: string;
  breed?: string;
  birthDate?: string;
  sex?: "" | "Đực" | "Cái";
  coatColor?: string;
  note?: string;
};
export type OrderPayload = {
  originAddress: string;
  originCountry: string;
  destinationAddress: string;
  destinationCountry: string;
  desiredDepartureDate: string;
  specialRequirements: string;
  horses: OrderHorse[];
  booking?: unknown;
};
export type OrderDetail = Order & {
  special_requirements: string | null;
  draft: OrderPayload | null;
  booking_details?: unknown;
  horses: {
    id: string;
    name: string;
    passport_no: string;
    breed: string | null;
    birth_date: string | null;
    sex: "" | "Đực" | "Cái" | null;
    coat_color: string | null;
    note: string | null;
  }[];
  documents: {
    id: string;
    document_name: string;
    horse_name: string;
    status: string;
    invalid_reason?: string | null;
  }[];
};
export type Workspace = {
  orders: Order[];
  horses: {
    id: string;
    order_id: string;
    name: string;
    order_code: string;
    order_status: string;
    missing_documents: number;
    pending_documents: number;
  }[];
};
export type Quote = {
  id: string;
  items: {
    code: string;
    label: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }[];
  adjustment: number | string;
  adjustment_reason: string | null;
  vat_percent: number | string;
  vat_amount: number | string;
  total: number | string;
  deposit: number | string;
  deposit_percent: number | string;
  paid: number | string;
  expires_at: string | null;
  order_status: string;
  arrived_at_delivery: boolean;
  receipts: {
    id: string;
    amount: number | string;
    reference: string;
    received_at: string;
  }[];
};
export type Notice = {
  id: string;
  content: string;
  is_read: number | boolean;
  created_at?: string;
  event_type?: string;
  related_type?: string;
  related_id?: string;
  order_id?: string;
  horse_id?: string;
  document_id?: string;
};
export type Page = {
  screen: string;
  id?: string;
  orderId?: string;
  tripId?: string;
  horseId?: string;
  /** Mở form sự cố với loại chọn sẵn (Y tế ngựa từ ESC-07). */
  incidentType?: string;
  /** Đợt thanh toán của màn CUS-17. */
  paymentType?: "DEPOSIT" | "BALANCE";
};
/** screen "back" quay về màn trước. */
export type Navigate = (screen: string, params?: Omit<Page, "screen">) => void;
