import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import rikkesLogo from "@/assets/rikkes-logo.png";

export const Route = createFileRoute("/login")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      const { data: roleRows } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.session.user.id);
      const roles = (roleRows ?? []).map((r: any) => r.role as string);
      const isPatientOnly =
        roles.length > 0 && roles.every((r) => r === "peserta" || r === "casis");
      throw redirect({ to: isPatientOnly ? "/my-anamnesis" : "/dashboard" });
    }
  },
  component: LoginPage,
});

function LoginPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        toast.success("Pendaftaran berhasil. Silakan masuk.");
        setMode("login");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Berhasil masuk");
        // Tentukan tujuan berdasarkan role
        const { data: sess } = await supabase.auth.getSession();
        const uid = sess.session?.user?.id;
        if (uid) {
          const { data: roleRows } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", uid);
          const roles = (roleRows ?? []).map((r: any) => r.role as string);
          const isPatientOnly =
            roles.length > 0 && roles.every((r) => r === "peserta" || r === "casis");
          nav({ to: isPatientOnly ? "/my-anamnesis" : "/dashboard" });
        } else {
          nav({ to: "/" });
        }
      }
    } catch (err: any) {
      toast.error(err.message ?? "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-primary p-4">
      <div className="w-full max-w-md bg-card rounded-lg shadow-xl overflow-hidden">
        <div className="bg-primary text-primary-foreground px-6 py-5 border-b border-white/10 flex items-center gap-4">
          <img src={rikkesLogo} alt="Logo RIKKES TNI AU" width={56} height={56} className="h-14 w-14 object-contain drop-shadow" />
          <div>
            <div className="text-xs tracking-widest uppercase opacity-80">Sistem Digital</div>
            <h1 className="text-xl font-bold leading-tight">RIKKES TNI AU</h1>
            <p className="text-xs opacity-80 mt-1">Pemeriksaan Kesehatan Seleksi</p>
          </div>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div className="flex gap-2 text-sm font-medium border-b border-border">
            {(["login", "signup"] as const).map((m) => (
              <button
                type="button"
                key={m}
                onClick={() => setMode(m)}
                className={`px-3 py-2 -mb-px border-b-2 ${
                  mode === m ? "border-accent text-foreground" : "border-transparent text-muted-foreground"
                }`}
              >
                {m === "login" ? "Masuk" : "Daftar"}
              </button>
            ))}
          </div>
          {mode === "signup" && (
            <div className="space-y-1.5">
              <Label htmlFor="fullName">Nama Lengkap</Label>
              <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Kata Sandi</Label>
            <Input id="password" type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Memproses..." : mode === "login" ? "Masuk" : "Daftar"}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Akses dibatasi untuk petugas resmi. Peran default akan ditetapkan setelah pendaftaran.
          </p>
        </form>
      </div>
    </div>
  );
}