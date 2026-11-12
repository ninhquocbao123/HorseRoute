/** B13: thông quan của chuyến quốc tế ở chi tiết đơn (khách hàng): xem, bổ sung, sửa. Chuyến trong nước không hiện. */
import React, { useState } from "react";
import { View } from "react-native";
import { FileCheck } from "lucide-react-native";
import { Button, Card, Chip, Field, InfoLine, Section, Txt, s, useTheme } from "../ui";
import { useSession } from "../session";
import { useOverlay } from "../overlay";
import { messageOf } from "../api/http";
import { CUSTOMS_EDITABLE, borderGates, customsOf } from "../booking-domain";

export function CustomsCard({
  order,
  onSaved,
}: {
  order: { id: string; status: string; origin_country: string | null; destination_country: string | null; booking_details?: unknown };
  onSaved: () => void;
}) {
  const { colors: c } = useTheme();
  const { request, write, writing } = useSession();
  const { notify } = useOverlay();
  const saved = customsOf(order.booking_details);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(saved);
  const [error, setError] = useState("");
  const origin = order.origin_country ?? "", destination = order.destination_country ?? "";
  if (!origin || !destination || origin === destination) return null;
  const canEdit = CUSTOMS_EDITABLE.includes(order.status);
  const gates = borderGates(origin, destination);
  const save = async () => {
    setError("");
    try {
      await write(async () => {
        await request(`/orders/${order.id}/customs`, {
          method: "PUT",
          body: { customsCode: value.customsCode.trim(), importPermit: value.importPermit.trim(), border: value.border.trim() },
        });
        setEditing(false);
        notify("Đã lưu thông tin thông quan");
        onSaved();
      });
    } catch (e) {
      setError(messageOf(e));
    }
  };
  return (
    <>
      <Section title="Thông quan" />
      <Card>
        {!editing ? (
          <>
            <InfoLine label="Số tờ khai hải quan" value={saved.customsCode || "Chưa có"} />
            <InfoLine label="Giấy phép nhập khẩu" value={saved.importPermit || "Chưa có"} />
            <InfoLine label="Cửa khẩu dự kiến" value={saved.border || "Để điều phối chọn"} />
            {!saved.customsCode && canEdit ? (
              <Txt size={15} color={c.warningFg}>
                Chưa có số tờ khai. Bổ sung khi có (thường sau khi có giấy kiểm dịch); thiếu thì quản lý chưa chuyển chuyến cho tài xế.
              </Txt>
            ) : null}
            {canEdit ? (
              <Button
                title={saved.customsCode ? "Sửa thông tin thông quan" : "Bổ sung thông tin thông quan"}
                kind="secondary"
                icon={FileCheck}
                onPress={() => {
                  setValue(saved);
                  setEditing(true);
                }}
              />
            ) : null}
          </>
        ) : (
          <View style={{ gap: 12 }}>
            <Field label="Số tờ khai hải quan" maxLength={80} value={value.customsCode} onChangeText={(customsCode) => setValue({ ...value, customsCode })} />
            <Field label="Số giấy phép nhập khẩu" maxLength={80} value={value.importPermit} onChangeText={(importPermit) => setValue({ ...value, importPermit })} />
            <Txt size={15}>Cửa khẩu dự kiến</Txt>
            <View style={s.wrap}>
              {[...new Set(["", ...gates, ...(value.border ? [value.border] : [])])].map((gate) => (
                <Chip key={gate || "auto"} compact label={gate || "Để điều phối chọn"} selected={value.border === gate} onPress={() => setValue({ ...value, border: gate })} />
              ))}
            </View>
            {error ? <Txt size={15} color={c.dangerFg}>{error}</Txt> : null}
            <Button title="Lưu" disabled={writing} onPress={() => void save()} />
            <Button title="Hủy" kind="tertiary" disabled={writing} onPress={() => { setEditing(false); setError(""); }} />
          </View>
        )}
      </Card>
    </>
  );
}
