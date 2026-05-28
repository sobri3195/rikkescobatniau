import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import rikkesLogo from "@/assets/rikkes-logo.png";
import {
  ShieldCheck,
  Stethoscope,
  ClipboardList,
  BarChart3,
  Lock,
  FileText,
  Users,
  Activity,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

function LandingPage() {
  const navigate = useNavigate();
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <img src={rikkesLogo} alt="Rikkes TNI AU" className="h-10 w-10 object-contain" />
            <div>
              <div className="text-sm font-bold leading-tight">SIM RIKKES</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">TNI Angkatan Udara</div>
            </div>
          </div>
          <nav className="hidden items-center gap-6 text-sm md:flex">
            <a href="#fitur" className="text-muted-foreground hover:text-foreground">Fitur</a>
            <a href="#alur" className="text-muted-foreground hover:text-foreground">Alur Kerja</a>
            <a href="#statistik" className="text-muted-foreground hover:text-foreground">Statistik</a>
            <a href="#faq" className="text-muted-foreground hover:text-foreground">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            {authed ? (
              <Button onClick={() => navigate({ to: "/dashboard" })}>Buka Dashboard</Button>
            ) : (
              <>
                <Link to="/login"><Button variant="ghost">Masuk</Button></Link>
                <Link to="/login"><Button>Mulai</Button></Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 -z-10 opacity-60"
          style={{
            background:
              "radial-gradient(60% 50% at 20% 0%, color-mix(in oklab, var(--accent) 25%, transparent), transparent), radial-gradient(50% 50% at 90% 10%, color-mix(in oklab, var(--primary) 25%, transparent), transparent)",
          }}
        />
        <div className="mx-auto max-w-7xl px-6 pb-20 pt-16 md:pt-24">
          <div className="grid items-center gap-12 md:grid-cols-2">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-accent" />
                Sistem Internal Pemeriksaan Kesehatan
              </div>
              <h1 className="mt-5 text-4xl font-bold leading-tight tracking-tight md:text-6xl">
                Digitalisasi <span className="text-accent">RIKKES</span> TNI Angkatan Udara
              </h1>
              <p className="mt-5 max-w-xl text-lg text-muted-foreground">
                Sistem manajemen pemeriksaan kesehatan personel dan calon — terintegrasi, aman, dan
                tertelusur dari pendaftaran hingga finalisasi rekomendasi.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/login">
                  <Button size="lg" className="gap-2">
                    Masuk Sistem <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <a href="#fitur">
                  <Button size="lg" variant="outline">Pelajari Fitur</Button>
                </a>
              </div>
              <div className="mt-8 flex flex-wrap items-center gap-6 text-xs text-muted-foreground">
                <div className="flex items-center gap-2"><Lock className="h-4 w-4" /> Data Terenkripsi</div>
                <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Audit Trail Lengkap</div>
                <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Role-based Access</div>
              </div>
            </div>
            <div className="relative">
              <div className="rounded-3xl border border-border bg-card p-8 shadow-2xl">
                <div className="flex items-center justify-between border-b border-border pb-4">
                  <div className="flex items-center gap-3">
                    <img src={rikkesLogo} alt="" className="h-12 w-12 object-contain" />
                    <div>
                      <div className="text-sm font-semibold">RIKKES Personel</div>
                      <div className="text-xs text-muted-foreground">T-2026-001 · Adi Pranata</div>
                    </div>
                  </div>
                  <span className="rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent">In Progress</span>
                </div>
                <div className="mt-5 space-y-3">
                  {[
                    ["Identitas", 100],
                    ["Anamnesa", 100],
                    ["Pemeriksaan Umum", 70],
                    ["Laboratorium", 40],
                    ["Resume", 0],
                  ].map(([label, pct]) => (
                    <div key={label as string}>
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-medium">{pct}%</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="absolute -bottom-6 -left-6 hidden rounded-2xl border border-border bg-card p-4 shadow-xl md:block">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-accent/15 p-2"><Activity className="h-5 w-5 text-accent" /></div>
                  <div>
                    <div className="text-2xl font-bold">98.7%</div>
                    <div className="text-xs text-muted-foreground">Akurasi Data</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Fitur */}
      <section id="fitur" className="border-t border-border bg-card/40">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold md:text-4xl">Modul Lengkap untuk RIKKES</h2>
            <p className="mt-3 text-muted-foreground">
              Mulai dari pendataan peserta hingga finalisasi rekomendasi medis — semua dalam satu platform.
            </p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              { i: Users, t: "Manajemen Peserta", d: "Kelola data calon, pangkat, satuan, dan dokumen pendukung secara terpusat." },
              { i: Stethoscope, t: "Pemeriksaan 67 Item", d: "Form lengkap mengikuti standar RIKKES TNI AU dengan validasi otomatis." },
              { i: ClipboardList, t: "Master Seleksi", d: "Atur panitia, jadwal, dan tahapan seleksi dengan workflow yang jelas." },
              { i: BarChart3, t: "Dashboard & Analitik", d: "Pantau progres, distribusi kualifikasi, dan statistik real-time." },
              { i: FileText, t: "Export PDF & Laporan", d: "Cetak resume kesehatan, kualifikasi akhir, dan laporan tahap." },
              { i: ShieldCheck, t: "Audit Trail", d: "Setiap perubahan tercatat dengan aktor, waktu, dan konteks lengkap." },
            ].map((f) => (
              <div key={f.t} className="rounded-2xl border border-border bg-background p-6 transition hover:border-accent/50 hover:shadow-lg">
                <div className="mb-4 inline-flex rounded-xl bg-accent/10 p-3">
                  <f.i className="h-6 w-6 text-accent" />
                </div>
                <h3 className="font-semibold">{f.t}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Alur Kerja */}
      <section id="alur" className="border-t border-border">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold md:text-4xl">Alur Kerja Sederhana</h2>
            <p className="mt-3 text-muted-foreground">Empat langkah dari registrasi sampai finalisasi.</p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-4">
            {[
              ["01", "Registrasi Peserta", "Input data calon & generate nomor tes otomatis."],
              ["02", "Pemeriksaan", "Tim medis mengisi 25 section pemeriksaan."],
              ["03", "Review & Paraf", "Kepala Sub Tim memverifikasi dan memberikan paraf."],
              ["04", "Finalisasi", "Kualifikasi akhir dikunci dan resume dicetak."],
            ].map(([n, t, d]) => (
              <div key={n} className="relative rounded-2xl border border-border bg-card p-6">
                <div className="text-3xl font-bold text-accent/30">{n}</div>
                <h3 className="mt-2 font-semibold">{t}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Statistik */}
      <section id="statistik" className="border-t border-border bg-primary text-primary-foreground">
        <div className="mx-auto max-w-7xl px-6 py-16">
          <div className="grid gap-8 text-center md:grid-cols-4">
            {[
              ["67+", "Item Pemeriksaan"],
              ["25", "Section RIKKES"],
              ["5", "Peran & Akses"],
              ["100%", "Tertelusur"],
            ].map(([n, l]) => (
              <div key={l}>
                <div className="text-4xl font-bold md:text-5xl">{n}</div>
                <div className="mt-2 text-sm opacity-80">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t border-border">
        <div className="mx-auto max-w-4xl px-6 py-20">
          <h2 className="text-center text-3xl font-bold md:text-4xl">Pertanyaan Umum</h2>
          <div className="mt-10 space-y-4">
            {[
              ["Siapa yang dapat mengakses sistem?", "Hanya personel yang diberi akun oleh administrator dengan peran sesuai (Admin, Dokter, Kepala Sub Tim, Registrasi, Viewer)."],
              ["Apakah data tersimpan dengan aman?", "Ya. Seluruh data tersimpan terenkripsi dan setiap akses tercatat dalam audit log."],
              ["Bagaimana proses finalisasi?", "Kualifikasi akhir hanya dapat dikunci oleh Kepala Sub Tim setelah semua section terverifikasi."],
              ["Apakah hasil dapat diekspor?", "Resume kesehatan dan laporan tahap dapat diunduh dalam format PDF."],
            ].map(([q, a]) => (
              <details key={q} className="group rounded-xl border border-border bg-card p-5">
                <summary className="cursor-pointer list-none font-medium">
                  <span className="inline-flex w-full items-center justify-between">
                    {q}
                    <span className="text-muted-foreground group-open:rotate-45 transition">+</span>
                  </span>
                </summary>
                <p className="mt-3 text-sm text-muted-foreground">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-7xl px-6 py-20 text-center">
          <h2 className="text-3xl font-bold md:text-4xl">Siap memulai pemeriksaan?</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Masuk dengan akun resmi Anda untuk mengakses dashboard dan modul RIKKES.
          </p>
          <div className="mt-8">
            <Link to="/login">
              <Button size="lg" className="gap-2">Masuk Sekarang <ArrowRight className="h-4 w-4" /></Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-border bg-card/40">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-6 py-6 text-xs text-muted-foreground md:flex-row">
          <div className="flex items-center gap-2">
            <img src={rikkesLogo} alt="" className="h-6 w-6 object-contain" />
            <span>© {new Date().getFullYear()} SIM RIKKES TNI Angkatan Udara</span>
          </div>
          <div>Sistem internal — hanya untuk personel terotorisasi.</div>
        </div>
      </footer>
    </div>
  );
}
