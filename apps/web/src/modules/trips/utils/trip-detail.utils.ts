// Same bounds as the API's BIGINT UNSIGNED ID; never convert IDs to Number.
export function isValidTripId(id: string | undefined): id is string {
  return !!id && /^[1-9]\d{0,19}$/.test(id)
    && (id.length < 20 || id <= '18446744073709551615');
}
