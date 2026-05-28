import { useEffect, useState } from "react";
import { Bell, Check, CheckCheck } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { toast } from "sonner";

type Notif = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link_url: string | null;
  read_at: string | null;
  created_at: string;
  metadata: any;
};

export function NotificationsBell() {
  const { user } = useAuth();
  const [items, setItems] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);

  async function load() {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("id,type,title,body,link_url,read_at,created_at,metadata")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setItems((data ?? []) as Notif[]);
  }

  useEffect(() => {
    if (!user) return;
    load();
    const channel = supabase
      .channel(`notif-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const n = payload.new as Notif;
          setItems((prev) => [n, ...prev].slice(0, 20));
          toast.info(n.title, { description: n.body ?? undefined });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const unread = items.filter((n) => !n.read_at).length;

  async function markRead(id: string) {
    await supabase.from("notifications").update({ read_at: new Date().toISOString() } as never).eq("id", id);
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
  }

  async function markAllRead() {
    if (!user) return;
    const now = new Date().toISOString();
    await supabase.from("notifications").update({ read_at: now } as never).eq("user_id", user.id).is("read_at", null);
    setItems((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })));
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative w-full flex items-center justify-center py-2 rounded-md text-xs hover:bg-white/10 transition"
          aria-label="Notifikasi"
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute top-1 right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent side="right" align="end" className="w-96 p-0">
        <div className="px-3 py-2 border-b flex items-center justify-between">
          <div className="font-semibold text-sm">Notifikasi</div>
          {unread > 0 && (
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={markAllRead}>
              <CheckCheck className="h-3 w-3 mr-1" /> Tandai semua dibaca
            </Button>
          )}
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          {items.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">Belum ada notifikasi.</div>
          ) : (
            items.map((n) => (
              <div key={n.id} className={`px-3 py-2 border-b last:border-0 ${!n.read_at ? "bg-sky-50" : ""}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium leading-tight">{n.title}</div>
                    {n.body && <div className="text-xs text-muted-foreground mt-0.5">{n.body}</div>}
                    {n.metadata?.note && (
                      <div className="text-[11px] text-orange-700 mt-1 italic">"{n.metadata.note}"</div>
                    )}
                    <div className="text-[10px] text-muted-foreground mt-1">
                      {new Date(n.created_at).toLocaleString("id-ID")}
                    </div>
                    {n.link_url && (
                      <Link
                        to={n.link_url}
                        onClick={() => { markRead(n.id); setOpen(false); }}
                        className="text-xs text-sky-600 hover:underline mt-1 inline-block"
                      >
                        Buka detail →
                      </Link>
                    )}
                  </div>
                  {!n.read_at && (
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => markRead(n.id)} title="Tandai dibaca">
                      <Check className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}