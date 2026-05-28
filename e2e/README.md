# End-to-End Tests (Playwright)

Smoke test suite untuk alur Hari-H RIKKES.

## Cara menjalankan

```bash
bun run dev                              # terminal 1
bunx playwright install chromium         # sekali saja
E2E_BASE_URL=http://localhost:8080 \
E2E_EMAIL=tester@rikkes.test \
E2E_PASSWORD='Tester#2026!' \
bunx playwright test
```

## Env vars
| Var | Default |
|---|---|
| `E2E_BASE_URL` | `http://localhost:8080` |
| `E2E_EMAIL` | `tester@rikkes.test` |
| `E2E_PASSWORD` | `Tester#2026!` |
| `E2E_SEED_NAME` | `SEED Adi Pratama` |

## Suite
- `smoke.spec.ts` — login → dashboard → buka peserta seed.
- `screening.spec.ts` — validasi sanity TB/BB.
- `bypass.spec.ts` — halaman bypass review.
- `mobile.spec.ts` — viewport mobile (Pixel 7).