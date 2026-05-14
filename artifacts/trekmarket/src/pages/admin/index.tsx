import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@workspace/replit-auth-web";
import { useGetMyProfile } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Users, DollarSign, ShieldCheck, AlertTriangle, Mountain, FileText, BarChart3, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Tab = "overview" | "users" | "bookings" | "verifications" | "sos" | "offline-permits" | "revenue";

export default function AdminDashboard() {
  const { isAuthenticated } = useAuth();
  const { data: profile, isLoading: profileLoading } = useGetMyProfile({ query: { enabled: isAuthenticated } });
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<Tab>("overview");

  if (profileLoading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!profile || profile.role !== "admin") { setLocation("/"); return null; }

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "overview", label: "Overview", icon: <BarChart3 className="w-4 h-4" /> },
    { key: "users", label: "Users", icon: <Users className="w-4 h-4" /> },
    { key: "bookings", label: "Bookings", icon: <DollarSign className="w-4 h-4" /> },
    { key: "verifications", label: "Verifications", icon: <ShieldCheck className="w-4 h-4" /> },
    { key: "sos", label: "SOS Alerts", icon: <AlertTriangle className="w-4 h-4" /> },
    { key: "offline-permits", label: "Offline Permits", icon: <FileText className="w-4 h-4" /> },
    { key: "revenue", label: "Revenue", icon: <DollarSign className="w-4 h-4" /> },
  ];

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      {/* Sidebar */}
      <aside className="w-56 border-r border-border bg-muted/30 p-4 space-y-1 hidden md:block">
        <h2 className="font-bold text-sm text-muted-foreground uppercase tracking-wider mb-4 px-2">Admin</h2>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
              tab === t.key ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </aside>

      {/* Main content */}
      <main className="flex-1 p-6 overflow-y-auto">
        {tab === "overview" && <OverviewTab />}
        {tab === "users" && <UsersTab />}
        {tab === "bookings" && <BookingsTab />}
        {tab === "verifications" && <VerificationsTab />}
        {tab === "sos" && <SosTab />}
        {tab === "offline-permits" && <OfflinePermitsTab />}
        {tab === "revenue" && <RevenueTab />}
      </main>
    </div>
  );
}

function OverviewTab() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { fetch("/api/admin/overview", { credentials: "include" }).then((r) => r.json()).then(setData); }, []);
  if (!data) return <Loader2 className="w-6 h-6 animate-spin" />;
  const stats = [
    { label: "Total Users", value: data.totalUsers },
    { label: "Bookings This Month", value: data.totalBookingsThisMonth },
    { label: "Commission This Month", value: `NPR ${Number(data.totalCommissionThisMonth).toLocaleString()}` },
    { label: "Pending Verifications", value: data.pendingVerificationsCount },
    { label: "Unresolved SOS", value: data.unresolvedSosCount },
    { label: "Active Treks", value: data.totalActiveTreks },
  ];
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard Overview</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((s) => (
          <Card key={s.label}><CardContent className="p-5"><p className="text-xs text-muted-foreground uppercase tracking-wider">{s.label}</p><p className="text-2xl font-bold mt-1">{s.value}</p></CardContent></Card>
        ))}
      </div>
    </div>
  );
}

function UsersTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const load = (q = "") => {
    setLoading(true);
    fetch(`/api/admin/users?limit=50&search=${encodeURIComponent(q)}`, { credentials: "include" })
      .then((r) => r.json()).then((d) => setUsers(d.data ?? [])).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const handleBan = async (id: string) => {
    await fetch(`/api/admin/users/${id}/ban`, { method: "POST", credentials: "include" });
    toast({ title: "User ban status toggled" });
    load(search);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Users</h1>
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search username or email..." value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load(search)} />
        </div>
        <Button variant="secondary" onClick={() => load(search)}>Search</Button>
      </div>
      {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : (
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-muted/50"><tr><th className="px-3 py-2 text-left">Username</th><th className="px-3 py-2 text-left">Email</th><th className="px-3 py-2">Role</th><th className="px-3 py-2">Verified</th><th className="px-3 py-2">Banned</th><th className="px-3 py-2">Joined</th><th className="px-3 py-2"></th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t">
                  <td className="px-3 py-2 font-medium">{u.username ? `@${u.username}` : "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{u.email ?? "—"}</td>
                  <td className="px-3 py-2 text-center"><Badge variant="secondary" className="text-[10px] capitalize">{u.role ?? "—"}</Badge></td>
                  <td className="px-3 py-2 text-center">{u.isVerified ? "✓" : "—"}</td>
                  <td className="px-3 py-2 text-center">{u.isBanned ? <Badge variant="destructive" className="text-[10px]">Banned</Badge> : "—"}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="px-3 py-2"><Button size="sm" variant={u.isBanned ? "outline" : "destructive"} onClick={() => handleBan(u.id)}>{u.isBanned ? "Unban" : "Ban"}</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function BookingsTab() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetch("/api/admin/bookings?limit=50", { credentials: "include" }).then((r) => r.json()).then((d) => setBookings(d.data ?? [])).finally(() => setLoading(false)); }, []);
  if (loading) return <Loader2 className="w-6 h-6 animate-spin" />;
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Bookings</h1>
      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-muted/50"><tr><th className="px-3 py-2 text-left">Trekker</th><th className="px-3 py-2 text-left">Trek</th><th className="px-3 py-2 text-left">Agency</th><th className="px-3 py-2">Amount</th><th className="px-3 py-2">Fee</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Date</th></tr></thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b.id} className="border-t">
                <td className="px-3 py-2">{b.trekkerUsername}</td>
                <td className="px-3 py-2">{b.trekTitle}</td>
                <td className="px-3 py-2">{b.agencyName ?? "—"}</td>
                <td className="px-3 py-2 text-center">${b.totalAmount}</td>
                <td className="px-3 py-2 text-center">${b.platformFeeAmount}</td>
                <td className="px-3 py-2 text-center"><Badge variant="secondary" className="text-[10px] capitalize">{b.status}</Badge></td>
                <td className="px-3 py-2 text-xs">{new Date(b.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function VerificationsTab() {
  const [pending, setPending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const { toast } = useToast();

  const load = () => { fetch("/api/admin/verifications", { credentials: "include" }).then((r) => r.json()).then(setPending).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const approve = async (id: string) => {
    await fetch(`/api/admin/verifications/${id}/approve`, { method: "POST", credentials: "include" });
    toast({ title: "Agency approved" }); load();
  };
  const reject = async () => {
    if (!rejectId || !rejectNote.trim()) return;
    await fetch(`/api/admin/verifications/${rejectId}/reject`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ note: rejectNote.trim() }) });
    toast({ title: "Agency rejected" }); setRejectId(null); setRejectNote(""); load();
  };

  if (loading) return <Loader2 className="w-6 h-6 animate-spin" />;
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Pending Verifications ({pending.length})</h1>
      {pending.length === 0 ? <p className="text-muted-foreground">No pending verifications.</p> : (
        <div className="space-y-3">
          {pending.map((p) => (
            <Card key={p.id}>
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{p.agencyName ?? p.username}</p>
                  <p className="text-xs text-muted-foreground">NTB: {p.ntbRegistrationNumber}</p>
                  <a href={p.licenseDocumentUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">View License Document</a>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => approve(p.id)}>Approve</Button>
                  <Button size="sm" variant="destructive" onClick={() => setRejectId(p.id)}>Reject</Button>
                </div>
              </CardContent>
              {rejectId === p.id && (
                <div className="px-4 pb-4 flex gap-2">
                  <Input placeholder="Rejection reason..." value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} className="flex-1" />
                  <Button size="sm" variant="destructive" onClick={reject} disabled={!rejectNote.trim()}>Confirm</Button>
                  <Button size="sm" variant="ghost" onClick={() => setRejectId(null)}>Cancel</Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function SosTab() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const load = () => { fetch("/api/admin/sos", { credentials: "include" }).then((r) => r.json()).then(setAlerts).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);
  const resolve = async (id: string) => {
    await fetch(`/api/admin/sos/${id}/resolve`, { method: "POST", credentials: "include" });
    toast({ title: "Alert resolved" }); load();
  };
  if (loading) return <Loader2 className="w-6 h-6 animate-spin" />;
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">SOS Alerts</h1>
      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-muted/50"><tr><th className="px-3 py-2 text-left">Trekker</th><th className="px-3 py-2 text-left">Trek</th><th className="px-3 py-2 text-left">Destination</th><th className="px-3 py-2">Time</th><th className="px-3 py-2">Status</th><th className="px-3 py-2"></th></tr></thead>
          <tbody>
            {alerts.map((a) => (
              <tr key={a.id} className="border-t">
                <td className="px-3 py-2">{a.trekkerUsername}</td>
                <td className="px-3 py-2">{a.trekName}</td>
                <td className="px-3 py-2">{a.destination}</td>
                <td className="px-3 py-2 text-xs">{new Date(a.triggeredAt).toLocaleString()}</td>
                <td className="px-3 py-2 text-center">{a.resolved ? <Badge className="bg-green-100 text-green-800 text-[10px]">Resolved</Badge> : <Badge variant="destructive" className="text-[10px]">Active</Badge>}</td>
                <td className="px-3 py-2">{!a.resolved && <Button size="sm" variant="outline" onClick={() => resolve(a.id)}>Resolve</Button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OfflinePermitsTab() {
  const [permits, setPermits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const load = () => { fetch("/api/admin/offline-permits", { credentials: "include" }).then((r) => r.json()).then(setPermits).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);
  const confirm = async (id: string) => {
    await fetch(`/api/admin/offline-permits/${id}/confirm`, { method: "POST", credentials: "include" });
    toast({ title: "Payment confirmed" }); load();
  };
  if (loading) return <Loader2 className="w-6 h-6 animate-spin" />;
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Offline Permits ({permits.length})</h1>
      {permits.length === 0 ? <p className="text-muted-foreground">No pending offline permits.</p> : (
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-muted/50"><tr><th className="px-3 py-2 text-left">Trekker</th><th className="px-3 py-2 text-left">Permit</th><th className="px-3 py-2 text-left">Destination</th><th className="px-3 py-2">Amount</th><th className="px-3 py-2">Date</th><th className="px-3 py-2"></th></tr></thead>
            <tbody>
              {permits.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="px-3 py-2">{p.trekkerUsername}</td>
                  <td className="px-3 py-2">{p.permitName}</td>
                  <td className="px-3 py-2">{p.destination}</td>
                  <td className="px-3 py-2 text-center">NPR {p.priceNPR}</td>
                  <td className="px-3 py-2 text-xs">{new Date(p.createdAt).toLocaleDateString()}</td>
                  <td className="px-3 py-2"><Button size="sm" onClick={() => confirm(p.id)}>Confirm Payment</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RevenueTab() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { fetch("/api/admin/revenue", { credentials: "include" }).then((r) => r.json()).then(setData); }, []);
  if (!data) return <Loader2 className="w-6 h-6 animate-spin" />;
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Revenue</h1>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Card><CardContent className="p-5"><p className="text-xs text-muted-foreground uppercase">Total Commission</p><p className="text-2xl font-bold">NPR {Number(data.totalCommission).toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-xs text-muted-foreground uppercase">This Month</p><p className="text-2xl font-bold">NPR {Number(data.monthlyCommission).toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-xs text-muted-foreground uppercase">Total Bookings</p><p className="text-2xl font-bold">{data.totalBookings}</p></CardContent></Card>
      </div>

      {/* Monthly chart (simple bar chart using divs) */}
      <Card className="mb-8">
        <CardHeader><CardTitle className="text-sm">Monthly Commission (Last 6 Months)</CardTitle></CardHeader>
        <CardContent>
          {data.monthlyChart?.length > 0 ? (
            <div className="flex items-end gap-2 h-40">
              {data.monthlyChart.map((m: any) => {
                const maxVal = Math.max(...data.monthlyChart.map((x: any) => x.commission), 1);
                const height = (m.commission / maxVal) * 100;
                return (
                  <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] text-muted-foreground">NPR {Number(m.commission).toLocaleString()}</span>
                    <div className="w-full bg-primary rounded-t" style={{ height: `${Math.max(height, 4)}%` }} />
                    <span className="text-[10px] text-muted-foreground">{m.month.slice(5)}</span>
                  </div>
                );
              })}
            </div>
          ) : <p className="text-muted-foreground text-sm">No data yet.</p>}
        </CardContent>
      </Card>

      {/* Top agencies */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Top 10 Agencies by Booking Volume</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr><th className="px-3 py-2 text-left">Agency</th><th className="px-3 py-2">Bookings</th><th className="px-3 py-2">Total Value</th></tr></thead>
              <tbody>
                {data.topAgencies?.map((a: any) => (
                  <tr key={a.agencyId} className="border-t">
                    <td className="px-3 py-2 font-medium">{a.agencyName ?? a.username ?? a.agencyId}</td>
                    <td className="px-3 py-2 text-center">{a.bookingCount}</td>
                    <td className="px-3 py-2 text-center">${Number(a.totalValue).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
