import React, { useState } from "react";
import { View } from "react-native";
import { FileWarning } from "lucide-react-native";
import { Banner, Button, Card, Txt, useTheme } from "../ui";
import { useResource, useSession } from "../session";
import { useOverlay } from "../overlay";
import { NotFound, ResourceState } from "../live-ui";
import { messageOf } from "../api/http";
import { asId } from "../live-domain";
import { DocumentSlot, uploadWithProgress, type SlotState } from "../doc-upload";
import type { Navigate } from "../api/types";

type Checklist = {
  order: { id: string; order_code?: string };
  documents: {
    id: string;
    horse_id: string;
    horse_name: string;
    document_name: string;
    status: "NOT_SUBMITTED" | "SUBMITTED" | "VALID" | "INVALID" | "EXPIRED";
    invalid_reason?: string | null;
  }[];
};

const STATUS: Record<string, string> = {
  NOT_SUBMITTED: "Chưa nộp",
  SUBMITTED: "Đã nộp, chờ thẩm định",
  VALID: "Hợp lệ",
  INVALID: "Cần nộp lại",
  EXPIRED: "Hết hạn, cần nộp lại",
};
const NEEDS = new Set(["NOT_SUBMITTED", "INVALID", "EXPIRED"]);

/**
 * Nộp lại giấy tờ của MỘT con ngựa trong đơn (mục 2). Mở thẳng từ thông báo "Yêu cầu bổ sung giấy tờ":
 * hiện sẵn lý do, giấy tờ cần nộp lại có viền đỏ (giấy tờ trong thông báo nằm đầu). Dùng chung API với web:
 * POST /documents/orders/:orderId/items/:id/upload, nộp xong giấy tờ về "chờ thẩm định", người thẩm định và quản lý nhận thông báo.
 */
export function DocResubmitScreen({
  orderId,
  horseId,
  documentId,
  go,
}: {
  orderId: string;
  horseId: string;
  documentId?: string;
  go: Navigate;
}) {
  const resource = useResource<Checklist>(`/documents/orders/${asId(orderId)}`);
  const { token, writing, write, refresh } = useSession();
  const { notify } = useOverlay();
  const { colors: c } = useTheme();
  const [slots, setSlots] = useState<Record<string, SlotState>>({});
  const [error, setError] = useState("");
  const set = (id: string, next: SlotState) => setSlots((old) => ({ ...old, [id]: next }));
  const docs = (resource.data?.documents ?? [])
    .filter((d) => String(d.horse_id) === String(horseId))
    .sort((a, b) => (String(a.id) === documentId ? -1 : String(b.id) === documentId ? 1 : 0));
  const needed = docs.filter((d) => NEEDS.has(d.status) && !slots[d.id]?.done);
  const picked = needed.filter((d) => slots[d.id]?.picked);
  const submit = async () => {
    setError("");
    try {
      await write(async () => {
        if (!picked.length) throw new Error("Chọn tệp cho giấy tờ cần nộp lại trước khi gửi.");
        let failed = 0;
        for (const d of picked) {
          const state = slots[d.id];
          set(d.id, { ...state, progress: 0, error: undefined });
          try {
            await uploadWithProgress(
              `/documents/orders/${asId(orderId)}/items/${asId(d.id)}/upload`,
              token,
              {},
              state.picked!,
              (progress) => setSlots((old) => ({ ...old, [d.id]: { ...old[d.id], progress } })),
            );
            set(d.id, { ...state, progress: 1, done: true });
          } catch (e) {
            failed++;
            set(d.id, { ...state, progress: undefined, error: messageOf(e) });
          }
        }
        refresh();
        if (failed) throw new Error(`${failed} giấy tờ chưa gửi được. Xem lỗi ở từng giấy tờ rồi thử lại.`);
        notify("Đã nộp lại giấy tờ", "Giấy tờ đang chờ thẩm định. Bạn sẽ nhận thông báo khi có kết quả.");
      });
    } catch (e) {
      setError(messageOf(e));
    }
  };
  return (
    <ResourceState resource={resource} what="giấy tờ của ngựa" skeleton="detail">
      {resource.data && !docs.length ? (
        <NotFound title="Không tìm thấy giấy tờ của ngựa này" detail="Ngựa có thể đã được bỏ khỏi đơn. Mở chi tiết đơn để xem lại." />
      ) : resource.data ? (
        <>
          <Card>
            <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
              <FileWarning size={24} color={needed.length ? c.dangerFg : c.successFg} />
              <View style={{ flex: 1 }}>
                <Txt size={17} bold>
                  {docs[0].horse_name}
                </Txt>
                <Txt size={15} color={c.textSecondary}>
                  Đơn {resource.data.order.order_code ?? orderId} ·{" "}
                  {needed.length ? `${needed.length} giấy tờ cần nộp lại` : "Không còn giấy tờ cần nộp"}
                </Txt>
              </View>
            </View>
          </Card>
          {docs.map((d) => (
            <DocumentSlot
              key={d.id}
              label={d.document_name}
              status={STATUS[d.status]}
              reason={NEEDS.has(d.status) ? d.invalid_reason || (d.status === "NOT_SUBMITTED" ? "Chưa nộp giấy tờ này." : "Giấy tờ đã hết hạn.") : null}
              state={slots[d.id] ?? (NEEDS.has(d.status) ? {} : { done: d.status !== "NOT_SUBMITTED" })}
              disabled={writing || !NEEDS.has(d.status)}
              onPick={(file, err) => set(d.id, file ? { picked: file } : { ...slots[d.id], error: err })}
              onRemove={() => set(d.id, {})}
            />
          ))}
          {error ? <Banner warning text={error} /> : null}
          {needed.length ? (
            <Button
              title={writing ? "Đang gửi giấy tờ…" : `Gửi ${picked.length || ""} giấy tờ nộp lại`.replace("  ", " ")}
              disabled={writing || !picked.length}
              onPress={() => void submit()}
            />
          ) : (
            <Button title="Xem chi tiết đơn" kind="secondary" onPress={() => go("documents", { id: orderId })} />
          )}
        </>
      ) : null}
    </ResourceState>
  );
}
