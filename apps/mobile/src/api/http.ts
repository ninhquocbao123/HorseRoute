export class ApiError extends Error {
  status: number;
  fields: Record<string, string>;
  /** Lỗi gốc khi không gọi được máy chủ, hiện trong Hàng chờ gửi để biết vì sao chưa gửi được. */
  detail?: string;
  constructor(
    message: string,
    status: number,
    fields: Record<string, string> = {},
    detail?: string,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fields = fields;
    this.detail = detail;
  }
}
export type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
  anonymous?: boolean;
  /** Mặc định 20 giây; gửi file mặc định 90 giây vì máy chủ còn đẩy file lên kho lưu trữ. */
  timeoutMs?: number;
};
export function createApiClient(options: {
  baseUrl: string;
  getToken: () => string | null;
  onUnauthorized?: () => void;
  fetcher?: typeof fetch;
  timeoutMs?: number;
}) {
  const baseUrl = options.baseUrl.replace(/\/+$/, "");
  return async function request<T>(
    path: string,
    input: RequestOptions = {},
  ): Promise<T> {
    if (!path.startsWith("/") || path.startsWith("//") || path.includes("://"))
      throw new Error("Đường dẫn API không hợp lệ.");
    const token = input.anonymous ? null : options.getToken();
    const controller = new AbortController();
    const abort = () => controller.abort();
    input.signal?.addEventListener("abort", abort, { once: true });
    if (input.signal?.aborted) controller.abort();
    const multipart =
      typeof FormData !== "undefined" && input.body instanceof FormData;
    let timedOut = false;
    const timer = setTimeout(
      () => {
        timedOut = true;
        abort();
      },
      input.timeoutMs ?? (multipart ? 90000 : (options.timeoutMs ?? 20000)),
    );
    try {
      const response = await (options.fetcher ?? fetch)(baseUrl + path, {
        method: input.method ?? "GET",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(input.body !== undefined && !multipart
            ? { "Content-Type": "application/json" }
            : {}),
        },
        body:
          input.body === undefined
            ? undefined
            : multipart
              ? (input.body as FormData)
              : JSON.stringify(input.body),
      });
      const raw = await response.text();
      let body: unknown;
      try {
        body = raw ? JSON.parse(raw) : undefined;
      } catch {
        throw new ApiError(
          "Máy chủ trả dữ liệu không hợp lệ. Kiểm tra địa chỉ API.",
          response.status,
        );
      }
      if (!response.ok) {
        const data = body as
          | { message?: string | string[]; fields?: Record<string, string> }
          | undefined;
        if (response.status === 401 && token && token === options.getToken())
          options.onUnauthorized?.();
        const message = Array.isArray(data?.message)
          ? data.message.join(" ")
          : data?.message;
        const details = data?.fields
          ? Object.values(data.fields).join(" ")
          : "";
        throw new ApiError(
          [message, details].filter(Boolean).join(" ") ||
            `Không thực hiện được yêu cầu (${response.status}).`,
          response.status,
          data?.fields,
        );
      }
      return body as T;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (input.signal?.aborted) throw error;
      throw new ApiError(
        path === "/auth/login"
          ? "Không kết nối được máy chủ đăng nhập. Kiểm tra địa chỉ máy chủ và kết nối mạng với máy tính rồi thử lại."
          : timedOut && input.method && input.method !== "GET"
            ? "Máy chủ phản hồi quá lâu. Yêu cầu có thể đã được ghi; tải lại để kiểm tra trước khi gửi lại."
            : input.method && input.method !== "GET"
              ? "Không nhận được xác nhận từ máy chủ. Hãy tải lại danh sách để kiểm tra trước khi gửi lại, tránh tạo trùng dữ liệu."
              : "Không kết nối được máy chủ. Kiểm tra mạng và địa chỉ API rồi thử lại.",
        0,
        {},
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      clearTimeout(timer);
      input.signal?.removeEventListener("abort", abort);
    }
  };
}
export const messageOf = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Không thực hiện được thao tác. Vui lòng thử lại.";
