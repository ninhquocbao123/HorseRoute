import React, { useEffect, useState } from "react";
import { ScrollView } from "react-native";
import { Banner, Button, Field, Txt, useTheme } from "../ui";
import { useSession } from "../session";
import { messageOf } from "../api/http";
import type { IUser } from "../api/types";

const RESEND_SECONDS = 60;
/** Mã 6 số gửi qua email: chỉ giữ chữ số, tối đa 6. */
export const cleanCode = (value: string) => value.replace(/\D/g, "").slice(0, 6);

function useCooldown(start: boolean) {
  const [left, setLeft] = useState(start ? RESEND_SECONDS : 0);
  useEffect(() => {
    if (left <= 0) return;
    const timer = setTimeout(() => setLeft((v) => v - 1), 1000);
    return () => clearTimeout(timer);
  }, [left]);
  return [left, () => setLeft(RESEND_SECONDS)] as const;
}

/** Nhập mã xác minh sau khi đăng ký, hoặc khi đăng nhập tài khoản chưa xác minh. Đúng mã thì vào app luôn. */
export function VerifyEmailScreen({ email, sent, onBack }: { email: string; sent: boolean; onBack: () => void }) {
  const { request, adopt } = useSession();
  const { colors: c } = useTheme();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(sent ? `Đã gửi mã gồm 6 số tới ${email}. Mã có hiệu lực trong 15 phút.` : "");
  const [left, restart] = useCooldown(sent);
  const submit = async () => {
    if (code.length !== 6) { setError("Nhập mã gồm 6 chữ số."); return; }
    setBusy(true); setError("");
    try {
      await adopt(await request<{ accessToken: string; user: IUser }>("/auth/verify-email", { method: "POST", anonymous: true, body: { email, code } }));
    } catch (e) { setError(messageOf(e)); setBusy(false); }
  };
  const resend = async () => {
    setBusy(true); setError("");
    try {
      setNotice((await request<{ message: string }>("/auth/resend-verification", { method: "POST", anonymous: true, body: { email } })).message);
      restart();
    } catch (e) { setError(messageOf(e)); }
    finally { setBusy(false); }
  };
  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, gap: 16 }}>
      <Txt size={24} bold>Xác minh email</Txt>
      <Txt color={c.textSecondary}>Tài khoản {email} cần xác minh email trước khi dùng. Kiểm tra hộp thư, kể cả mục Thư rác.</Txt>
      {notice ? <Banner text={notice} /> : null}
      <Field label="Mã xác minh" value={code} onChangeText={(v) => setCode(cleanCode(v))} keyboardType="number-pad"
        autoComplete="one-time-code" textContentType="oneTimeCode" maxLength={6} placeholder="6 chữ số" editable={!busy} />
      {error ? <Banner warning text={error} /> : null}
      <Button title={busy ? "Đang xác minh…" : "Xác minh"} disabled={busy} onPress={() => void submit()} />
      <Button title={left > 0 ? `Gửi lại mã (${left}s)` : "Gửi lại mã"} kind="secondary" disabled={busy || left > 0} onPress={() => void resend()} />
      <Button title="Quay lại đăng nhập" kind="tertiary" disabled={busy} onPress={onBack} />
    </ScrollView>
  );
}

/** Quên mật khẩu: nhận mã qua email rồi đặt mật khẩu mới. */
export function ForgotPasswordScreen({ initialEmail, onDone }: { initialEmail: string; onDone: (message?: string) => void }) {
  const { request } = useSession();
  const { colors: c } = useTheme();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [left, restart] = useCooldown(false);
  const send = async () => {
    const target = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(target)) { setError("Email chưa đúng định dạng."); return; }
    setBusy(true); setError("");
    try {
      setNotice((await request<{ message: string }>("/auth/forgot-password", { method: "POST", anonymous: true, body: { email: target } })).message);
      setEmail(target); setStep("code"); restart();
    } catch (e) { setError(messageOf(e)); }
    finally { setBusy(false); }
  };
  const reset = async () => {
    if (code.length !== 6) { setError("Nhập mã gồm 6 chữ số."); return; }
    if (password.length < 8 || !password.trim()) { setError("Mật khẩu mới cần ít nhất 8 ký tự."); return; }
    if (password !== confirm) { setError("Mật khẩu nhập lại chưa khớp."); return; }
    setBusy(true); setError("");
    try {
      onDone((await request<{ message: string }>("/auth/reset-password", { method: "POST", anonymous: true, body: { email, code, password } })).message);
    } catch (e) { setError(messageOf(e)); setBusy(false); }
  };
  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, gap: 16 }}>
      <Txt size={24} bold>Quên mật khẩu</Txt>
      {notice ? <Banner text={notice} /> : null}
      {step === "email" ? (
        <>
          <Txt color={c.textSecondary}>Nhập email của tài khoản. Hệ thống gửi một mã gồm 6 số để bạn đặt mật khẩu mới.</Txt>
          <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false}
            keyboardType="email-address" autoComplete="email" editable={!busy} />
          {error ? <Banner warning text={error} /> : null}
          <Button title={busy ? "Đang gửi…" : "Gửi mã"} disabled={busy} onPress={() => void send()} />
        </>
      ) : (
        <>
          <Txt color={c.textSecondary}>Nhập mã đã gửi tới {email} và mật khẩu mới. Đặt lại xong, mọi thiết bị đang đăng nhập sẽ bị đăng xuất.</Txt>
          <Field label="Mã xác nhận" value={code} onChangeText={(v) => setCode(cleanCode(v))} keyboardType="number-pad"
            autoComplete="one-time-code" textContentType="oneTimeCode" maxLength={6} placeholder="6 chữ số" editable={!busy} />
          <Field label="Mật khẩu mới" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password"
            hint="Ít nhất 8 ký tự." editable={!busy} />
          <Field label="Nhập lại mật khẩu mới" value={confirm} onChangeText={setConfirm} secureTextEntry autoComplete="new-password" editable={!busy} />
          {error ? <Banner warning text={error} /> : null}
          <Button title={busy ? "Đang đặt lại…" : "Đặt mật khẩu mới"} disabled={busy} onPress={() => void reset()} />
          <Button title={left > 0 ? `Gửi lại mã (${left}s)` : "Gửi lại mã"} kind="secondary" disabled={busy || left > 0} onPress={() => void send()} />
        </>
      )}
      <Button title="Quay lại đăng nhập" kind="tertiary" disabled={busy} onPress={() => onDone()} />
    </ScrollView>
  );
}
