import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { Link, Navigate } from "react-router-dom";
import { auth } from "../../../lib/firebase";
import { useAuth } from "../hooks/useAuth";
import { Brand } from "../../home/LandingPage";

const schema = z.object({
  email: z.string().trim().email("Vui lòng nhập email hợp lệ."),
  password: z.string().min(6, "Mật khẩu cần ít nhất 6 ký tự."),
});
type FormData = z.infer<typeof schema>;
function message(error: unknown) {
  const code = (error as { code?: string }).code;
  const messages: Record<string, string> = {
    "auth/invalid-credential":
      "Email hoặc mật khẩu chưa đúng. Vui lòng thử lại.",
    "auth/wrong-password": "Email hoặc mật khẩu chưa đúng. Vui lòng thử lại.",
    "auth/email-already-in-use":
      "Email đã được đăng ký. Hãy đăng nhập hoặc khôi phục mật khẩu.",
    "auth/weak-password": "Mật khẩu chưa đủ mạnh. Vui lòng chọn mật khẩu khác.",
    "auth/too-many-requests":
      "Có quá nhiều lần thử. Vui lòng đợi một lát rồi thử lại.",
    "auth/network-request-failed": "Không thể kết nối. Vui lòng kiểm tra mạng.",
    "auth/user-disabled": "Tài khoản đã bị vô hiệu hóa.",
  };
  return (
    messages[code || ""] ||
    "Chưa thể thực hiện yêu cầu. Vui lòng kiểm tra thông tin và thử lại."
  );
}
export default function LoginPage() {
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<"login" | "register" | "reset">("login");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [resetting, setResetting] = useState(false);
  const {
    register,
    handleSubmit,
    trigger,
    getValues,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });
  if (user) return <Navigate to="/dashboard" replace />;
  const busy = loading || isSubmitting || resetting;
  const changeMode = (next: typeof mode) => {
    setMode(next);
    setError("");
    setNotice("");
    clearErrors();
  };
  const submit = handleSubmit(async ({ email, password }) => {
    setError("");
    setNotice("");
    try {
      if (mode === "register")
        await createUserWithEmailAndPassword(auth, email, password);
      else await signInWithEmailAndPassword(auth, email, password);
    } catch (e) {
      setError(message(e));
    }
  });
  async function resetPassword() {
    if (!(await trigger("email"))) return;
    setResetting(true);
    setError("");
    setNotice("");
    try {
      await sendPasswordResetEmail(auth, getValues("email").trim());
      setNotice(
        "Nếu email có tài khoản phù hợp, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu. Hãy kiểm tra cả thư mục spam.",
      );
    } catch (e) {
      setError(message(e));
    } finally {
      setResetting(false);
    }
  }
  return (
    <main className="auth-page">
      <section className="auth-story">
        <div className="auth-story-content">
          <Brand />
          <div>
            <p className="eyebrow">HorseSystem EQUINE TRANSPORT</p>
            <h1>
              Mọi chặng đường,
              <br />
              luôn có người
              <br />
              <em>đồng hành.</em>
            </h1>
            <p>
              Kết nối với hành trình của ngựa.
              <br />
              An tâm từ lúc chuẩn bị đến khi bàn giao.
            </p>
          </div>
          <small>CHĂM SÓC · KẾT NỐI · ĐỒNG HÀNH</small>
        </div>
      </section>
      <section className="auth-panel">
        <Link className="back-link" to="/">
          ← Về trang chủ
        </Link>
        <div className="auth-form-wrap">
          <p className="eyebrow">KHÔNG GIAN CỦA BẠN</p>
          <h2>
            {mode === "login"
              ? "Chào mừng trở lại."
              : mode === "register"
                ? "Bắt đầu cùng HorseSystem."
                : "Quên mật khẩu?"}
          </h2>
          <p className="auth-description">
            {mode === "login"
              ? "Đăng nhập để tiếp tục hành trình cùng HorseSystem."
              : mode === "register"
                ? "Tạo tài khoản để kết nối với dịch vụ vận chuyển."
                : "Nhập email đăng ký để nhận hướng dẫn khôi phục."}
          </p>
          <form
            noValidate
            onSubmit={
              mode === "reset"
                ? (e) => {
                    e.preventDefault();
                    void resetPassword();
                  }
                : submit
            }
          >
            <label htmlFor="email">Địa chỉ email</label>
            <input
              id="email"
              type="email"
              placeholder="Email"
              autoComplete="email"
              disabled={busy}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "email-error" : undefined}
              {...register("email")}
            />
            {errors.email && (
              <p id="email-error" className="error">
                {errors.email.message}
              </p>
            )}
            {mode !== "reset" && (
              <>
                <div className="password-label">
                  <label htmlFor="password">Mật khẩu</label>
                  {mode === "login" && (
                    <button
                      className="inline-button"
                      type="button"
                      disabled={busy}
                      onClick={() => changeMode("reset")}
                    >
                      Quên mật khẩu?
                    </button>
                  )}
                </div>
                <div className="password-input">
                  <input
                    id="password"
                    type={visible ? "text" : "password"}
                    placeholder="Nhập mật khẩu của bạn"
                    autoComplete={
                      mode === "register" ? "new-password" : "current-password"
                    }
                    disabled={busy}
                    aria-invalid={!!errors.password}
                    aria-describedby={
                      errors.password ? "password-error" : undefined
                    }
                    {...register("password")}
                  />
                  <button
                    type="button"
                    className="visibility-button"
                    aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                    aria-pressed={visible}
                    onClick={() => setVisible(!visible)}
                  >
                    {visible ? "Ẩn" : "Hiện"}
                  </button>
                </div>
                {errors.password && (
                  <p id="password-error" className="error">
                    {errors.password.message}
                  </p>
                )}
              </>
            )}
            {error && (
              <p className="form-message error" role="alert">
                {error}
              </p>
            )}
            {notice && (
              <p className="form-message success" role="status">
                {notice}
              </p>
            )}
            <button
              className="button submit-button"
              disabled={busy}
              type="submit"
            >
              {busy
                ? "Đang xử lý…"
                : mode === "login"
                  ? "Đăng nhập"
                  : mode === "register"
                    ? "Tạo tài khoản"
                    : "Gửi hướng dẫn"}{" "}
              <span aria-hidden="true">↗</span>
            </button>
          </form>
          <div className="auth-switch">
            {mode === "login" ? "Bạn chưa có tài khoản? " : "Đã có tài khoản? "}
            <button
              className="inline-button"
              disabled={busy}
              onClick={() =>
                changeMode(mode === "login" ? "register" : "login")
              }
            >
              {mode === "login" ? "Tạo tài khoản" : "Đăng nhập"}
            </button>
          </div>
          <div className="auth-assurance">
            <span>◇</span>
            <p>
              Một tài khoản.
              <br />
              <strong>Kết nối trọn vẹn hành trình.</strong>
            </p>
          </div>
        </div>
        <p className="auth-copyright">
          © {new Date().getFullYear()} HorseSystem Equine Transport
        </p>
      </section>
    </main>
  );
}
