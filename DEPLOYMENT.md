# Deploy static SPA ke `public_html`

Project ini masih memakai TanStack Start untuk proses development dan integrasi server function, tetapi output untuk hosting statis bisa diambil dari bundle client.

## Build output statis

Jalankan:

```bash
bun run build:public_html
```

Perintah ini akan:

1. Menjalankan `bun run build`.
2. Menyalin isi `dist/client` ke `dist/public_html`.
3. Menggandakan `index.html` menjadi `404.html` supaya deep-link SPA tetap diarahkan ke app utama pada shared hosting biasa.

Folder upload ke hosting:

- `dist/public_html`

## Catatan penting

- Fitur yang bergantung ke endpoint server TanStack Start (server functions) tetap butuh backend aktif.
- Untuk hosting murni static tanpa backend, endpoint tersebut harus direfactor ke service eksternal/API terpisah.
