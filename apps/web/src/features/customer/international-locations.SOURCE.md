# International address catalogs

Retrieved 2026-10-23, bundled locally so selecting an address does not send
customer information to an external service.

## China

- Source: https://github.com/modood/Administrative-divisions-of-China
- File: https://raw.githubusercontent.com/modood/Administrative-divisions-of-China/master/dist/pca-code.json
- License: WTFPL; see china-locations.LICENSE.txt.
- Coverage of this source: 31 mainland provincial-level divisions.
- 3,056 county/district areas are grouped under their province. Prefecture names
  are retained in the area label to disambiguate names. Vietnamese province
  labels and a few common city translations are added alongside original names.
- This is an upstream snapshot, not a claim of real-time administrative accuracy.

## Thailand

- Source: https://github.com/kongvut/thai-province-data
- Files: api/latest/province.json and api/latest/district.json on the master branch.
- License: MIT; see thailand-locations.LICENSE.txt.
- 77 provinces and 930 district-level areas, with English and Thai labels.
- In the two-level UI, the area selector represents a district, not a tambon.
  The detailed address field holds the remaining address information.

Refresh the source snapshots when administrative data changes. Values must remain
within the booking API's 60-character city/area limit.
