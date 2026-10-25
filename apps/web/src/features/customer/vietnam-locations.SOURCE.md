# Vietnam address catalog

- Source: https://provinces.open-api.vn/api/v2/?depth=2
- Provider: Province Open API / VietnamProvinces, Nguyễn Hồng Quân.
- Documentation: https://provinces.open-api.vn/
- Retrieved: 2026-10-23.
- API v2 contains the two-level administrative divisions after July 2025.
- Snapshot: 34 provinces/municipalities, 3,321 wards/communes/special zones.

Only province names and their ward names are retained, sorted in Vietnamese order.
The bundled snapshot avoids sending customer data to an address service and keeps
the selectors working without an external request. Refresh it from the same
endpoint when the administrative catalog changes. For CN and TH, see international-locations.SOURCE.md. This dataset is only used
when country is VN.
