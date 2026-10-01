import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Lock, Plus, Edit3, ListChecks, CalendarDays, Clock, CheckCircle2, XCircle, Zap, RefreshCw, Search, Trash2, X, LogOut, FileText, Share2, Printer, Copy, Mail, MessageCircle, Save, Receipt, RotateCcw, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { listDeliveryDateAvailability, listPendingDeliveryDateRequests, approveDeliveryDateRequest, rejectDeliveryDateRequest, STATUS_FLOW, type Shipment, type Milestone, type DeliveryDateAvailability, listShipments, listMilestones } from "@/lib/shipments";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Control Center — DTDC XPRESS+" },
      { name: "description", content: "Operations control center for DTDC XPRESS+ B2B shipment management." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Admin,
});

const ADMIN_PASSWORD = "dtdc-admin-2026";

function Admin() {
  const [unlocked, setUnlocked] = useState(false);
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem("dtdc_admin") === "1") setUnlocked(true);
  }, []);

  if (!unlocked) {
    return (
      <section className="container-x py-24 flex items-center justify-center">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (pw === ADMIN_PASSWORD) {
              sessionStorage.setItem("dtdc_admin", "1");
              setUnlocked(true); setErr(false);
            } else { setErr(true); }
          }}
          className="w-full max-w-md rounded-xl border border-border bg-white p-8 shadow-lg"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-md bg-navy text-navy-foreground">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xl font-bold text-navy">Admin Control Center</div>
              <div className="text-xs text-muted-foreground uppercase tracking-widest">Operations Access</div>
            </div>
          </div>
          <div className="mt-6">
            <label className="text-xs font-semibold text-navy uppercase tracking-wide">Access Password</label>
            <input
              autoFocus type="password" value={pw} onChange={(e) => setPw(e.target.value)}
              placeholder="Enter admin password"
              className="mt-2 w-full h-11 rounded-md border border-input px-3 text-sm outline-none focus:border-navy focus:ring-2 focus:ring-navy/10"
            />
            {err && <div className="mt-2 text-xs text-destructive font-semibold">Incorrect password.</div>}
          </div>
          <button className="mt-6 w-full inline-flex items-center justify-center rounded-md bg-red py-2.5 text-sm font-semibold text-red-foreground">
            Unlock Control Center
          </button>

        </form>
      </section>
    );
  }

  return <AdminDashboard onLock={() => { sessionStorage.removeItem("dtdc_admin"); setUnlocked(false); setPw(""); }} />;
}

type Tab = "create" | "manage" | "all" | "availability" | "pending";

function AdminDashboard({ onLock }: { onLock: () => void }) {
  const [tab, setTab] = useState<Tab>("create");
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try { setShipments(await listShipments()); } finally { setLoading(false); }
  }
  useEffect(() => { refresh(); }, []);

  return (
    <section className="container-x py-10">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-navy">Admin Control Center</h1>
          <p className="text-sm text-muted-foreground">Manage consignments and simulate live tracking updates.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refresh} className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-semibold">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
          <button onClick={onLock} className="inline-flex items-center gap-2 rounded-md bg-navy px-3 py-2 text-sm font-semibold text-navy-foreground">
            <LogOut className="h-4 w-4" /> Lock
          </button>
        </div>
      </div>

      <div className="flex flex-wrap border-b border-border">
        {[
          { k: "create", label: "Create Consignment", icon: Plus },
          { k: "manage", label: "Manage Milestones", icon: Edit3 },
          { k: "pending", label: "Pending Requests", icon: Clock },
          { k: "all", label: "All Consignments", icon: ListChecks },
          { k: "availability", label: "Delivery Dates", icon: CalendarDays },
        ].map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k as Tab)}
            className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 -mb-px transition ${
              tab === t.k ? "border-red text-navy" : "border-transparent text-muted-foreground hover:text-navy"
            }`}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "create" && <CreateTab onCreated={refresh} />}
        {tab === "manage" && <ManageTab shipments={shipments} onChange={refresh} />}
        {tab === "pending" && <PendingRequestsTab onChange={refresh} />}
        {tab === "all" && <AllTab shipments={shipments} onChange={refresh} />}
        {tab === "availability" && <AvailabilityTab />}
      </div>
    </section>
  );
}

/* ---------- Create Tab ---------- */

function generateAWB(overseas: boolean) {
  const n = Math.floor(1000 + Math.random() * 9000);
  return overseas ? `XP-${n}-INT` : `XP-DOM-${n}`;
}

function CreateTab({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState({
    tracking_number: "", sender_company: "", receiver_company: "",
    origin: "", destination: "", is_overseas: false, status: "Booked" as string,
    hold_reason: "", weight_kg: 100, estimated_delivery: "",
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm(f => ({ ...f, [k]: v }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const payload = {
      ...form,
      tracking_number: (form.tracking_number || generateAWB(form.is_overseas)).toUpperCase(),
      estimated_delivery: form.estimated_delivery || null,
      hold_reason: form.status === "On Hold" ? (form.hold_reason || null) : null,
    };
    const { data, error } = await supabase.from("shipments").insert(payload).select().single();
    if (error) { setMsg("Error: " + error.message); setBusy(false); return; }
    await supabase.from("milestones").insert({
      shipment_id: data.id,
      location: form.origin,
      status_text: `Consignment ${form.status.toLowerCase()} — manifest generated`,
    });
    setMsg(`✓ Consignment ${payload.tracking_number} created.`);
    setForm({ tracking_number: "", sender_company: "", receiver_company: "", origin: "", destination: "", is_overseas: false, status: "Booked", hold_reason: "", weight_kg: 100, estimated_delivery: "" });
    onCreated(); setBusy(false);
  }

  return (
    <form onSubmit={onSubmit} className="rounded-xl border border-border bg-white p-6 md:p-8 grid gap-5 md:grid-cols-2">
      <F label="Tracking / AWB ID">
        <div className="flex gap-2">
          <input value={form.tracking_number} onChange={e => set("tracking_number", e.target.value)} placeholder="Auto-generate or enter manually" className="input" />
          <button type="button" onClick={() => set("tracking_number", generateAWB(form.is_overseas))} className="rounded-md border border-input px-3 text-xs font-semibold whitespace-nowrap">Auto</button>
        </div>
      </F>
      <F label="Service Type">
        <div className="flex rounded-md border border-input overflow-hidden">
          <button type="button" onClick={() => set("is_overseas", false)} className={`flex-1 h-10 text-sm font-semibold ${!form.is_overseas ? "bg-navy text-navy-foreground" : "bg-white"}`}>Domestic Freight</button>
          <button type="button" onClick={() => set("is_overseas", true)} className={`flex-1 h-10 text-sm font-semibold ${form.is_overseas ? "bg-red text-red-foreground" : "bg-white"}`}>Overseas Cargo</button>
        </div>
      </F>
      <F label="Sender Company"><input required value={form.sender_company} onChange={e => set("sender_company", e.target.value)} className="input" /></F>
      <F label="Receiver Company"><input required value={form.receiver_company} onChange={e => set("receiver_company", e.target.value)} className="input" /></F>
      <F label="Origin (City, Country)"><input required value={form.origin} onChange={e => set("origin", e.target.value)} placeholder="e.g. Mumbai, IN" className="input" /></F>
      <F label="Destination (City, Country)"><input required value={form.destination} onChange={e => set("destination", e.target.value)} placeholder="e.g. Hamburg, DE" className="input" /></F>
      <F label="Total Weight (kg)"><input required type="number" min={1} value={form.weight_kg} onChange={e => set("weight_kg", Number(e.target.value))} className="input" /></F>
      <F label="Estimated Delivery Date"><input type="date" value={form.estimated_delivery} onChange={e => set("estimated_delivery", e.target.value)} className="input" /></F>
      <F label="Initial Status" span2>
        <select value={form.status} onChange={e => set("status", e.target.value)} className="input">
          {STATUS_FLOW.map(s => <option key={s}>{s}</option>)}
        </select>
      </F>
      {form.status === "On Hold" && (
        <F label="Hold Warning / Reason" span2>
          <textarea value={form.hold_reason} onChange={e => set("hold_reason", e.target.value)} placeholder="Explain why this shipment is on hold..." className="input min-h-[80px] h-auto py-2 resize-y" />
        </F>
      )}
      <div className="md:col-span-2 flex items-center gap-3 pt-2 border-t border-border">
        <button disabled={busy} className="inline-flex items-center gap-2 rounded-md bg-red px-5 py-2.5 text-sm font-semibold text-red-foreground disabled:opacity-60">
          <Plus className="h-4 w-4" /> Create Consignment
        </button>
        {msg && <div className="text-sm font-semibold text-navy">{msg}</div>}
      </div>
    </form>
  );
}

/* ---------- Manage Tab ---------- */

function ManageTab({ shipments, onChange }: { shipments: Shipment[]; onChange: () => void }) {
  const [selectedId, setSelectedId] = useState<string>("");
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("");
  const [holdReason, setHoldReason] = useState("");
  const [newMs, setNewMs] = useState({ location: "", status_text: "", timestamp: "" });
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<null | "edit" | "invoice" | "share" | "charges">(null);

  const shipment = shipments.find(s => s.id === selectedId);
  const filtered = shipments.filter(s => s.tracking_number.toLowerCase().includes(q.toLowerCase()));

  useEffect(() => {
    if (!selectedId) { setMilestones([]); return; }
    listMilestones(selectedId).then(setMilestones);
    const s = shipments.find(x => x.id === selectedId);
    if (s) {
      setStatus(s.status);
      setHoldReason(s.hold_reason ?? "");
    }
  }, [selectedId, shipments]);

  async function updateStatus() {
    if (!shipment) return;
    setBusy(true);
    await supabase.from("shipments").update({
      status,
      hold_reason: status === "On Hold" ? (holdReason.trim() || null) : null,
    }).eq("id", shipment.id);
    onChange(); setBusy(false);
  }

  async function toggleReverification() {
    if (!shipment) return;
    setBusy(true);
    const nextVal = shipment.needs_reverification === false ? true : false;
    await supabase.from("shipments").update({
      needs_reverification: nextVal,
    }).eq("id", shipment.id);
    onChange(); setBusy(false);
  }

  async function addMilestone() {
    if (!shipment || !newMs.location || !newMs.status_text) return;
    setBusy(true);
    await supabase.from("milestones").insert({
      shipment_id: shipment.id,
      location: newMs.location,
      status_text: newMs.status_text,
      timestamp: newMs.timestamp ? new Date(newMs.timestamp).toISOString() : new Date().toISOString(),
    });
    setNewMs({ location: "", status_text: "", timestamp: "" });
    setMilestones(await listMilestones(shipment.id));
    setBusy(false);
  }

  async function addSampleStep() {
    if (!shipment) return;
    setBusy(true);
    const idx = STATUS_FLOW.findIndex(s => s.toLowerCase() === shipment.status.toLowerCase());
    const nextStatus = STATUS_FLOW[Math.min(idx + 1, STATUS_FLOW.length - 1)];
    const samples: Record<string, { loc: string; text: string }> = {
      "Picked Up": { loc: shipment.origin, text: "Picked up from sender facility, en route to origin hub" },
      "In Transit": { loc: shipment.is_overseas ? "JNPT Mumbai Port" : "Nagpur Interchange Hub", text: "In transit — arrived at regional hub" },
      "Customs Clearance": { loc: "Frankfurt Customs Hub", text: "Under customs clearance — awaiting inspection" },
      "Hub Arrival": { loc: shipment.destination, text: "Arrived at destination hub, sorted for last-mile" },
      "Out for Delivery": { loc: shipment.destination, text: "Out for delivery with local B2B partner" },
      "Delivered": { loc: shipment.destination, text: "Delivered — POD signed by receiver" },
    };
    const sample = samples[nextStatus] ?? { loc: shipment.destination, text: `Status updated to ${nextStatus}` };
    await supabase.from("shipments").update({ status: nextStatus }).eq("id", shipment.id);
    await supabase.from("milestones").insert({ shipment_id: shipment.id, location: sample.loc, status_text: sample.text });
    setStatus(nextStatus);
    setMilestones(await listMilestones(shipment.id));
    onChange(); setBusy(false);
  }

  return (
    <div className="grid lg:grid-cols-[320px_1fr] gap-6">
      <aside className="rounded-xl border border-border bg-white p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search tracking ID…" className="input pl-9" />
        </div>
        <div className="mt-3 max-h-[500px] overflow-y-auto space-y-1">
          {filtered.map(s => (
            <button
              key={s.id}
              onClick={() => setSelectedId(s.id)}
              className={`w-full text-left px-3 py-2.5 rounded-md text-sm ${selectedId === s.id ? "bg-navy text-navy-foreground" : "hover:bg-secondary"}`}
            >
              <div className="font-mono font-semibold">{s.tracking_number}</div>
              <div className={`text-xs ${selectedId === s.id ? "text-white/70" : "text-muted-foreground"}`}>{s.status} · {s.is_overseas ? "Overseas" : "Domestic"}</div>
            </button>
          ))}
          {filtered.length === 0 && <div className="text-sm text-muted-foreground p-3">No shipments.</div>}
        </div>
      </aside>

      <div className="space-y-5">
        {!shipment ? (
          <div className="rounded-xl border border-border bg-white p-10 text-center text-muted-foreground">Select a consignment to manage.</div>
        ) : (
          <>
            <div className="rounded-xl border border-border bg-white p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="font-mono text-sm font-bold text-navy">{shipment.tracking_number}</div>
                  <div className="mt-1 font-semibold">{shipment.sender_company} → {shipment.receiver_company}</div>
                  <div className="text-xs text-muted-foreground">{shipment.origin} → {shipment.destination}</div>
                  {shipment.estimated_delivery && <div className="text-xs text-muted-foreground mt-1">ETA: {new Date(shipment.estimated_delivery).toLocaleDateString()}</div>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setModal("edit")} className="inline-flex items-center gap-2 rounded-md border border-input bg-white px-3 py-2 text-xs font-semibold hover:bg-secondary">
                    <Edit3 className="h-3.5 w-3.5" /> Edit Details
                  </button>
                  <button onClick={() => setModal("invoice")} className="inline-flex items-center gap-2 rounded-md border border-input bg-white px-3 py-2 text-xs font-semibold hover:bg-secondary">
                    <FileText className="h-3.5 w-3.5" /> Invoice
                  </button>
                  <button onClick={() => setModal("share")} className="inline-flex items-center gap-2 rounded-md border border-input bg-white px-3 py-2 text-xs font-semibold hover:bg-secondary">
                    <Share2 className="h-3.5 w-3.5" /> Share
                  </button>
                  <button onClick={() => setModal("charges")} className="inline-flex items-center gap-2 rounded-md bg-navy px-3 py-2 text-xs font-semibold text-navy-foreground hover:brightness-110">
                    <Receipt className="h-3.5 w-3.5" /> Raise Charge
                  </button>
                  <button
                    onClick={toggleReverification} disabled={busy}
                    title={shipment.needs_reverification !== false ? "Verification form is currently active for this consignment. Click to bypass." : "Consignment already verified. Click to require re-verification and redisplay the form to user."}
                    className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition ${
                      shipment.needs_reverification !== false
                        ? "bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200"
                        : "border border-input bg-white hover:bg-secondary text-navy"
                    }`}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    {shipment.needs_reverification !== false ? "Form Active" : "Re-verify"}
                  </button>
                  <button
                    onClick={addSampleStep} disabled={busy}
                    className="inline-flex items-center gap-2 rounded-md bg-red px-3 py-2 text-xs font-semibold text-red-foreground disabled:opacity-60"
                  >
                    <Zap className="h-3.5 w-3.5" /> Sample Next Step
                  </button>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap items-end gap-3">
                <F label="Current Status">
                  <select value={status} onChange={e => setStatus(e.target.value)} className="input">
                    {STATUS_FLOW.map(s => <option key={s}>{s}</option>)}
                  </select>
                </F>
                <button onClick={updateStatus} disabled={busy} className="h-10 rounded-md bg-navy px-4 text-sm font-semibold text-navy-foreground">Update Status</button>
              </div>
              {status === "On Hold" && (
                <div className="mt-4 max-w-xl">
                  <F label="Hold Warning / Reason">
                    <textarea
                      value={holdReason}
                      onChange={e => setHoldReason(e.target.value)}
                      placeholder="Explain why this shipment is on hold..."
                      className="input min-h-[80px] h-auto py-2 resize-y"
                    />
                  </F>
                </div>
              )}
            </div>

            {modal === "edit" && <EditShipmentModal shipment={shipment} onClose={() => setModal(null)} onSaved={() => { setModal(null); onChange(); }} />}
            {modal === "invoice" && <InvoiceModal shipment={shipment} milestones={milestones} onClose={() => setModal(null)} />}
            {modal === "share" && <ShareModal shipment={shipment} onClose={() => setModal(null)} />}
            {modal === "charges" && <RaiseChargeModal shipment={shipment} onClose={() => setModal(null)} onLogged={async () => { setMilestones(await listMilestones(shipment.id)); }} />}

            <div className="rounded-xl border border-border bg-white p-6">
              <div className="font-bold text-navy mb-4">Add Milestone Event</div>
              <div className="grid gap-4 md:grid-cols-3">
                <F label="Current Location"><input value={newMs.location} onChange={e => setNewMs(s => ({ ...s, location: e.target.value }))} placeholder="e.g. Frankfurt Customs Hub" className="input" /></F>
                <F label="Status Description"><input value={newMs.status_text} onChange={e => setNewMs(s => ({ ...s, status_text: e.target.value }))} placeholder="e.g. Cleared import customs" className="input" /></F>
                <F label="Date & Time"><input type="datetime-local" value={newMs.timestamp} onChange={e => setNewMs(s => ({ ...s, timestamp: e.target.value }))} className="input" /></F>
              </div>
              <button onClick={addMilestone} disabled={busy} className="mt-4 inline-flex items-center gap-2 rounded-md bg-red px-4 py-2.5 text-sm font-semibold text-red-foreground disabled:opacity-60">
                <Plus className="h-4 w-4" /> Add Milestone
              </button>
            </div>

            <div className="rounded-xl border border-border bg-white p-6">
              <div className="font-bold text-navy mb-4">Milestone History ({milestones.length})</div>
              <ol className="space-y-3">
                {milestones.slice().reverse().map(m => (
                  <li key={m.id} className="flex items-start justify-between gap-3 border-b border-border pb-3 last:border-0">
                    <div>
                      <div className="text-sm font-semibold">{m.location}</div>
                      <div className="text-sm text-muted-foreground">{m.status_text}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{new Date(m.timestamp).toLocaleString()}</div>
                    </div>
                    <button
                      onClick={async () => { await supabase.from("milestones").delete().eq("id", m.id); setMilestones(await listMilestones(shipment.id)); }}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Delete milestone"
                    ><X className="h-4 w-4" /></button>
                  </li>
                ))}
                {milestones.length === 0 && <li className="text-sm text-muted-foreground">No milestones yet.</li>}
              </ol>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- Delivery Date Availability ---------- */

function AvailabilityTab() {
  const [dates, setDates] = useState<DeliveryDateAvailability[]>([]);
  const [deliveryDate, setDeliveryDate] = useState("");
  const [isOverseas, setIsOverseas] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    setDates(await listDeliveryDateAvailability());
  }

  useEffect(() => { refresh(); }, []);

  async function addDate(e: React.FormEvent) {
    e.preventDefault();
    if (!deliveryDate) return;
    setBusy(true); setMessage(null);
    const { error } = await supabase.from("delivery_date_availability").insert({ delivery_date: deliveryDate, is_overseas: isOverseas });
    if (error) setMessage(error.code === "23505" ? "That date is already configured for this service." : error.message);
    else { setDeliveryDate(""); setMessage("Delivery date added."); await refresh(); }
    setBusy(false);
  }

  async function toggleDate(date: DeliveryDateAvailability) {
    await supabase.from("delivery_date_availability").update({ is_available: !date.is_available }).eq("id", date.id);
    await refresh();
  }

  async function removeDate(id: string) {
    await supabase.from("delivery_date_availability").delete().eq("id", id);
    await refresh();
  }

  return (
    <div className="space-y-5">
      <form onSubmit={addDate} className="rounded-xl border border-border bg-white p-6">
        <div className="flex items-center gap-2 font-bold text-navy"><CalendarDays className="h-5 w-5 text-red" /> Add Delivery Date</div>
        <p className="mt-1 text-sm text-muted-foreground">Only enabled future dates appear in the customer delivery-date selector.</p>
        <div className="mt-5 flex flex-wrap items-end gap-3">
          <F label="Delivery Date"><input required type="date" min={new Date().toISOString().slice(0, 10)} value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} className="input" /></F>
          <F label="Service Type">
            <select value={isOverseas ? "overseas" : "domestic"} onChange={e => setIsOverseas(e.target.value === "overseas")} className="input">
              <option value="domestic">Domestic Freight</option>
              <option value="overseas">Overseas Cargo</option>
            </select>
          </F>
          <button disabled={busy} className="h-10 inline-flex items-center gap-2 rounded-md bg-red px-4 text-sm font-semibold text-red-foreground disabled:opacity-60"><Plus className="h-4 w-4" /> Add Date</button>
        </div>
        {message && <div className="mt-3 text-sm font-semibold text-navy">{message}</div>}
      </form>

      <div className="rounded-xl border border-border bg-white overflow-hidden">
        <div className="border-b border-border px-6 py-4 font-bold text-navy">Configured Delivery Dates</div>
        <div className="divide-y divide-border">
          {dates.map(date => (
            <div key={date.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
              <div>
                <div className="font-semibold">{new Date(`${date.delivery_date}T00:00:00`).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short", year: "numeric" })}</div>
                <div className="text-xs text-muted-foreground">{date.is_overseas ? "Overseas Cargo" : "Domestic Freight"}</div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => toggleDate(date)} className={`rounded-md px-3 py-2 text-xs font-semibold ${date.is_available ? "bg-navy text-navy-foreground" : "border border-input text-muted-foreground"}`}>
                  {date.is_available ? "Available" : "Unavailable"}
                </button>
                <button onClick={() => removeDate(date.id)} aria-label={`Remove ${date.delivery_date}`} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
          {dates.length === 0 && <div className="px-6 py-10 text-center text-sm text-muted-foreground">No delivery dates configured.</div>}
        </div>
      </div>
    </div>
  );
}

/* ---------- Pending Requests Tab ---------- */

function PendingRequestsTab({ onChange }: { onChange: () => void }) {
  const [requests, setRequests] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(false);
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      setRequests(await listPendingDeliveryDateRequests());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  async function approve(shipment: Shipment) {
    setBusy(true);
    try {
      await approveDeliveryDateRequest(shipment.id);
      await refresh();
      onChange();
    } finally {
      setBusy(false);
    }
  }

  async function reject(shipment: Shipment) {
    setBusy(true);
    try {
      await rejectDeliveryDateRequest(shipment.id, rejectionReasons[shipment.id] || "");
      setRejectionReasons(s => { const copy = { ...s }; delete copy[shipment.id]; return copy; });
      await refresh();
      onChange();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-white overflow-hidden">
      <div className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="font-bold text-navy flex items-center gap-2">
          <Clock className="h-5 w-5 text-red" /> Pending Delivery Date Requests
        </div>
        <button onClick={() => refresh()} className="inline-flex items-center gap-2 rounded-md border border-input px-3 py-2 text-xs font-semibold">
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>
      <div className="divide-y divide-border">
        {requests.map(request => (
          <div key={request.id} className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 px-6 py-4">
            <div className="flex-1">
              <div className="font-mono text-sm font-bold text-navy">{request.tracking_number}</div>
              <div className="text-xs text-muted-foreground mt-1">
                <span className="font-semibold">{request.sender_company}</span> → <span className="font-semibold">{request.receiver_company}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {request.origin} → {request.destination} <span className="mx-2">·</span>
                <span className={`font-semibold ${request.is_overseas ? "text-red" : "text-navy"}`}>{request.is_overseas ? "Overseas" : "Domestic"}</span>
              </div>
              <div className="text-sm font-semibold mt-2">
                Requested: <span className="text-navy">{new Date(`${request.requested_delivery_date}T00:00:00`).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Requested: {new Date(request.created_at).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <textarea
                placeholder="Optional rejection reason"
                value={rejectionReasons[request.id] || ""}
                onChange={e => setRejectionReasons(s => ({ ...s, [request.id]: e.target.value }))}
                className="w-full md:w-48 rounded-md border border-input px-2 py-1 text-xs outline-none focus:border-navy resize-none"
                rows={2}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => approve(request)}
                  disabled={busy}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-md bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-60"
                >
                  <CheckCircle2 className="h-4 w-4" /> Approve
                </button>
                <button
                  onClick={() => reject(request)}
                  disabled={busy}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-md bg-destructive px-3 py-2 text-xs font-semibold text-destructive-foreground hover:brightness-110 disabled:opacity-60"
                >
                  <XCircle className="h-4 w-4" /> Reject
                </button>
              </div>
            </div>
          </div>
        ))}
        {requests.length === 0 && !loading && <div className="px-6 py-10 text-center text-sm text-muted-foreground">No pending delivery date requests.</div>}
      </div>
    </div>
  );
}

/* ---------- All Tab ---------- */

function AllTab({ shipments, onChange }: { shipments: Shipment[]; onChange: () => void }) {
  const [filter, setFilter] = useState<"all" | "domestic" | "overseas">("all");
  const [q, setQ] = useState("");
  const rows = shipments.filter(s => {
    if (filter === "domestic" && s.is_overseas) return false;
    if (filter === "overseas" && !s.is_overseas) return false;
    if (q && !`${s.tracking_number} ${s.sender_company} ${s.receiver_company}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  async function del(id: string) {
    if (!confirm("Delete this consignment and all its milestones?")) return;
    await supabase.from("shipments").delete().eq("id", id);
    onChange();
  }

  return (
    <div className="rounded-xl border border-border bg-white overflow-hidden">
      <div className="p-4 border-b border-border flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search…" className="input pl-9" />
        </div>
        <div className="flex rounded-md border border-input overflow-hidden text-sm">
          {(["all", "domestic", "overseas"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3 py-2 font-semibold capitalize ${filter === f ? "bg-navy text-navy-foreground" : "bg-white"}`}>{f}</button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate">
            <tr className="text-left">
              <Th>Tracking</Th><Th>Sender</Th><Th>Receiver</Th><Th>Route</Th><Th>Status</Th><Th>Type</Th><Th>Verification</Th><Th>Weight</Th><Th>{""}</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map(s => (
              <tr key={s.id} className="border-t border-border hover:bg-secondary/40">
                <td className="px-4 py-3 font-mono font-semibold text-navy">{s.tracking_number}</td>
                <td className="px-4 py-3">{s.sender_company}</td>
                <td className="px-4 py-3">{s.receiver_company}</td>
                <td className="px-4 py-3 text-muted-foreground">{s.origin} → {s.destination}</td>
                <td className="px-4 py-3"><span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-navy/10 text-navy">{s.status}</span></td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${s.is_overseas ? "bg-red/10 text-red" : "bg-navy/10 text-navy"}`}>{s.is_overseas ? "Overseas" : "Domestic"}</span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={async () => {
                      const nextVal = s.needs_reverification === false ? true : false;
                      await supabase.from("shipments").update({ needs_reverification: nextVal }).eq("id", s.id);
                      onChange();
                    }}
                    title={s.needs_reverification !== false ? "Verification form is active for user. Click to mark verified." : "Consignment already verified. Click to require re-verification and redisplay the form to user."}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                      s.needs_reverification !== false
                        ? "bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200"
                        : "border border-input bg-white hover:bg-secondary text-navy"
                    }`}
                  >
                    <RotateCcw className="h-3 w-3" />
                    {s.needs_reverification !== false ? "Form Active" : "Re-verify"}
                  </button>
                </td>
                <td className="px-4 py-3">{s.weight_kg} kg</td>
                <td className="px-4 py-3">
                  <button onClick={() => del(s.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">No consignments.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const Th = ({ children }: { children: React.ReactNode }) => <th className="px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">{children}</th>;

function F({ label, children, span2 }: { label: string; children: React.ReactNode; span2?: boolean }) {
  return (
    <label className={`block ${span2 ? "md:col-span-2" : ""}`}>
      <div className="text-xs font-semibold text-navy mb-1.5 uppercase tracking-wide">{label}</div>
      {children}
      <style>{`.input{width:100%;border-radius:.375rem;border:1px solid var(--color-input);padding:0 .75rem;font-size:.875rem;background:white;color:black;outline:none;height:2.5rem}.input:focus{border-color:var(--color-navy);box-shadow:0 0 0 3px color-mix(in oklab, var(--color-navy) 10%, transparent)}`}</style>
    </label>
  );
}

/* ---------- Modal Shell ---------- */

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/60 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className={`w-full ${wide ? "max-w-3xl" : "max-w-lg"} max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-2xl`}>
        <div className="flex items-center justify-between border-b border-border px-6 py-4 sticky top-0 bg-white">
          <div className="font-bold text-navy">{title}</div>
          <button onClick={onClose} className="text-muted-foreground hover:text-navy" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

/* ---------- Edit Shipment ---------- */

function EditShipmentModal({ shipment, onClose, onSaved }: { shipment: Shipment; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    tracking_number: shipment.tracking_number,
    sender_company: shipment.sender_company,
    receiver_company: shipment.receiver_company,
    origin: shipment.origin,
    destination: shipment.destination,
    is_overseas: shipment.is_overseas,
    status: shipment.status,
    hold_reason: shipment.hold_reason ?? "",
    weight_kg: shipment.weight_kg,
    estimated_delivery: shipment.estimated_delivery ?? "",
    booking_date: shipment.created_at ? shipment.created_at.slice(0, 10) : "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF(s => ({ ...s, [k]: v }));

  async function save() {
    setBusy(true); setErr(null);
    const { booking_date, ...rest } = f;
    const payload: TablesUpdate<"shipments"> = {
      ...rest,
      tracking_number: f.tracking_number.toUpperCase(),
      estimated_delivery: f.estimated_delivery || null,
      hold_reason: f.status === "On Hold" ? (f.hold_reason.trim() || null) : null,
    };
    if (booking_date) {
      const orig = shipment.created_at ? new Date(shipment.created_at) : new Date();
      const [y, m, d] = booking_date.split("-").map(Number);
      const next = new Date(orig);
      next.setFullYear(y, (m ?? 1) - 1, d ?? 1);
      payload.created_at = next.toISOString();
    }
    const { error } = await supabase.from("shipments").update(payload).eq("id", shipment.id);
    setBusy(false);
    if (error) { setErr(error.message); return; }
    onSaved();
  }

  return (
    <Modal title="Edit Consignment Details" onClose={onClose} wide>
      <div className="grid gap-4 md:grid-cols-2">
        <F label="Tracking / AWB ID"><input value={f.tracking_number} onChange={e => set("tracking_number", e.target.value)} className="input" /></F>
        <F label="Service Type">
          <div className="flex rounded-md border border-input overflow-hidden">
            <button type="button" onClick={() => set("is_overseas", false)} className={`flex-1 h-10 text-sm font-semibold ${!f.is_overseas ? "bg-navy text-navy-foreground" : "bg-white"}`}>Domestic</button>
            <button type="button" onClick={() => set("is_overseas", true)} className={`flex-1 h-10 text-sm font-semibold ${f.is_overseas ? "bg-red text-red-foreground" : "bg-white"}`}>Overseas</button>
          </div>
        </F>
        <F label="Sender Company"><input value={f.sender_company} onChange={e => set("sender_company", e.target.value)} className="input" /></F>
        <F label="Receiver Company"><input value={f.receiver_company} onChange={e => set("receiver_company", e.target.value)} className="input" /></F>
        <F label="Origin"><input value={f.origin} onChange={e => set("origin", e.target.value)} className="input" /></F>
        <F label="Destination"><input value={f.destination} onChange={e => set("destination", e.target.value)} className="input" /></F>
        <F label="Weight (kg)"><input type="number" min={1} value={f.weight_kg} onChange={e => set("weight_kg", Number(e.target.value))} className="input" /></F>
        <F label="Booking Date"><input type="date" value={f.booking_date} onChange={e => set("booking_date", e.target.value)} className="input" /></F>
        <F label="Estimated Delivery Date"><input type="date" value={f.estimated_delivery} onChange={e => set("estimated_delivery", e.target.value)} className="input" /></F>
        <F label="Status" span2>
          <select value={f.status} onChange={e => set("status", e.target.value)} className="input">
            {STATUS_FLOW.map(s => <option key={s}>{s}</option>)}
          </select>
        </F>
        {f.status === "On Hold" && (
          <F label="Hold Warning / Reason" span2>
            <textarea value={f.hold_reason} onChange={e => set("hold_reason", e.target.value)} placeholder="Explain why this shipment is on hold..." className="input min-h-[80px] h-auto py-2 resize-y" />
          </F>
        )}
      </div>
      {err && <div className="mt-4 text-sm text-destructive font-semibold">{err}</div>}
      <div className="mt-6 flex items-center justify-end gap-2 border-t border-border pt-4">
        <button onClick={onClose} className="rounded-md border border-input px-4 py-2 text-sm font-semibold">Cancel</button>
        <button onClick={save} disabled={busy} className="inline-flex items-center gap-2 rounded-md bg-red px-4 py-2 text-sm font-semibold text-red-foreground disabled:opacity-60">
          <Save className="h-4 w-4" /> Save Changes
        </button>
      </div>
    </Modal>
  );
}

/* ---------- Invoice ---------- */

function InvoiceModal({ shipment, milestones, onClose }: { shipment: Shipment; milestones: Milestone[]; onClose: () => void }) {
  const invoiceNo = `INV-${shipment.tracking_number}`;
  const issueDate = new Date().toLocaleDateString();
  const bookingDate = shipment.created_at ? new Date(shipment.created_at).toLocaleDateString() : issueDate;
  const [rate, setRate] = useState<number>(shipment.is_overseas ? 285 : 42);
  const [payStatus, setPayStatus] = useState<"paid" | "unpaid">("unpaid");
  const subtotal = shipment.weight_kg * rate;
  const fuel = subtotal * 0.14;
  const gst = (subtotal + fuel) * 0.18;
  const total = subtotal + fuel + gst;
  const currency = shipment.is_overseas ? "USD" : "INR";
  const fmt = (n: number) => `${currency === "USD" ? "$" : "₹"}${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

  function printInvoice() {
    const html = document.getElementById("invoice-print")?.innerHTML;
    if (!html) return;
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>${invoiceNo}</title>
      <style>body{font-family:system-ui,sans-serif;color:#0B1C3E;padding:32px;max-width:800px;margin:auto}h1{color:#E31E24;margin:0}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{text-align:left;padding:8px;border-bottom:1px solid #e5e7eb;font-size:14px}th{background:#0B1C3E;color:white}.tot{font-weight:700}.right{text-align:right}.badge{display:inline-block;padding:6px 12px;border-radius:999px;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.08em}.paid{background:#dcfce7;color:#166534;border:1px solid #16a34a}.unpaid{background:#fee2e2;color:#991b1b;border:1px solid #dc2626}</style>
      </head><body>${html}</body></html>`);
    w.document.close(); w.focus(); setTimeout(() => w.print(), 300);
  }

  return (
    <Modal title="Invoice Preview" onClose={onClose} wide>
      <div className="mb-5 grid gap-3 sm:grid-cols-2 rounded-md border border-border bg-slate/40 p-4">
        <F label={`Rate per kg (${currency})`}>
          <input type="number" min={0} step="0.01" value={rate} onChange={e => setRate(Number(e.target.value) || 0)} className="input" />
        </F>
        <F label="Payment Status">
          <div className="flex rounded-md border border-input overflow-hidden">
            <button type="button" onClick={() => setPayStatus("unpaid")} className={`flex-1 h-10 text-sm font-semibold ${payStatus === "unpaid" ? "bg-red text-red-foreground" : "bg-white"}`}>Unpaid</button>
            <button type="button" onClick={() => setPayStatus("paid")} className={`flex-1 h-10 text-sm font-semibold ${payStatus === "paid" ? "bg-navy text-navy-foreground" : "bg-white"}`}>Paid</button>
          </div>
        </F>
      </div>

      <div id="invoice-print">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <h1 style={{ margin: 0, color: "#E31E24", fontSize: 28 }}>DTDC XPRESS+</h1>
            <div style={{ fontSize: 12, color: "#64748b" }}>Global B2B Freight & Logistics</div>
            <div style={{ fontSize: 12, marginTop: 8 }}>help@dtdc.live · overseas@dtdc.live</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontWeight: 700, color: "#0B1C3E" }}>{invoiceNo}</div>
            <div style={{ fontSize: 12, color: "#64748b" }}>Booking Date: {bookingDate}</div>
            <div style={{ fontSize: 12, color: "#64748b" }}>Issued: {issueDate}</div>
            <div style={{ fontSize: 12, color: "#64748b" }}>AWB: {shipment.tracking_number}</div>
            <div style={{ marginTop: 8 }}>
              <span className={`badge ${payStatus}`} style={{
                display: "inline-block", padding: "6px 12px", borderRadius: 999, fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em",
                background: payStatus === "paid" ? "#dcfce7" : "#fee2e2",
                color: payStatus === "paid" ? "#166534" : "#991b1b",
                border: `1px solid ${payStatus === "paid" ? "#16a34a" : "#dc2626"}`,
              }}>{payStatus}</span>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 11, textTransform: "uppercase", color: "#64748b", fontWeight: 700 }}>Bill From</div>
            <div style={{ fontWeight: 600, marginTop: 4 }}>{shipment.sender_company}</div>
            <div style={{ fontSize: 13, color: "#64748b" }}>{shipment.origin}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, textTransform: "uppercase", color: "#64748b", fontWeight: 700 }}>Bill To</div>
            <div style={{ fontWeight: 600, marginTop: 4 }}>{shipment.receiver_company}</div>
            <div style={{ fontSize: 13, color: "#64748b" }}>{shipment.destination}</div>
          </div>
        </div>

        <table>
          <thead><tr><th>Description</th><th className="right" style={{ textAlign: "right" }}>Qty</th><th className="right" style={{ textAlign: "right" }}>Rate</th><th className="right" style={{ textAlign: "right" }}>Amount</th></tr></thead>
          <tbody>
            <tr><td>{shipment.is_overseas ? "Overseas Cargo Freight" : "Domestic B2B Freight"} — {shipment.origin} → {shipment.destination}</td><td style={{ textAlign: "right" }}>{shipment.weight_kg} kg</td><td style={{ textAlign: "right" }}>{fmt(rate)}</td><td style={{ textAlign: "right" }}>{fmt(subtotal)}</td></tr>
            <tr><td>Fuel & handling surcharge (14%)</td><td></td><td></td><td style={{ textAlign: "right" }}>{fmt(fuel)}</td></tr>
            <tr><td>GST / Duties (18%)</td><td></td><td></td><td style={{ textAlign: "right" }}>{fmt(gst)}</td></tr>
            <tr className="tot"><td colSpan={3} style={{ textAlign: "right", fontWeight: 700 }}>Total Payable</td><td style={{ textAlign: "right", fontWeight: 700, color: "#E31E24" }}>{fmt(total)}</td></tr>
          </tbody>
        </table>

        <div style={{ marginTop: 20, fontSize: 12, color: "#64748b" }}>
          Payment terms: Net 15 days. Current shipment status: <strong style={{ color: "#0B1C3E" }}>{shipment.status}</strong>. Total milestones logged: {milestones.length}.
        </div>
      </div>

      <div className="mt-6 flex items-center justify-end gap-2 border-t border-border pt-4">
        <button onClick={onClose} className="rounded-md border border-input px-4 py-2 text-sm font-semibold">Close</button>
        <button onClick={printInvoice} className="inline-flex items-center gap-2 rounded-md bg-navy px-4 py-2 text-sm font-semibold text-navy-foreground">
          <Printer className="h-4 w-4" /> Print / Save PDF
        </button>
      </div>
    </Modal>
  );
}

/* ---------- Share ---------- */

function ShareModal({ shipment, onClose }: { shipment: Shipment; onClose: () => void }) {
  const url = typeof window !== "undefined" ? `${window.location.origin}/?track=${encodeURIComponent(shipment.tracking_number)}` : "";
  const msg = `Tracking update from DTDC XPRESS+
AWB: ${shipment.tracking_number}
${shipment.sender_company} → ${shipment.receiver_company}
Route: ${shipment.origin} → ${shipment.destination}
Current status: ${shipment.status}
Track live: ${url}`;
  const [copied, setCopied] = useState(false);

  async function copy() {
    try { await navigator.clipboard.writeText(msg); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch {}
  }
  async function nativeShare() {
    if (navigator.share) { try { await navigator.share({ title: `DTDC XPRESS+ ${shipment.tracking_number}`, text: msg, url }); } catch {} }
    else copy();
  }

  const wa = `https://wa.me/?text=${encodeURIComponent(msg)}`;
  const mail = `mailto:?subject=${encodeURIComponent(`DTDC XPRESS+ Tracking ${shipment.tracking_number}`)}&body=${encodeURIComponent(msg)}`;

  return (
    <Modal title="Share Tracking & Status" onClose={onClose}>
      <div className="text-sm text-muted-foreground">Send the current shipment status and live tracking link to your customer.</div>
      <div className="mt-4 rounded-md border border-border bg-slate/40 p-3 text-xs whitespace-pre-wrap font-mono text-navy">{msg}</div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button onClick={copy} className="inline-flex items-center justify-center gap-2 rounded-md border border-input bg-white px-3 py-2.5 text-sm font-semibold hover:bg-secondary">
          <Copy className="h-4 w-4" /> {copied ? "Copied!" : "Copy message"}
        </button>
        <button onClick={nativeShare} className="inline-flex items-center justify-center gap-2 rounded-md border border-input bg-white px-3 py-2.5 text-sm font-semibold hover:bg-secondary">
          <Share2 className="h-4 w-4" /> Native share
        </button>
        <a href={wa} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-md bg-[#25D366] px-3 py-2.5 text-sm font-semibold text-white">
          <MessageCircle className="h-4 w-4" /> WhatsApp
        </a>
        <a href={mail} className="inline-flex items-center justify-center gap-2 rounded-md bg-navy px-3 py-2.5 text-sm font-semibold text-navy-foreground">
          <Mail className="h-4 w-4" /> Email
        </a>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <input readOnly value={url} className="input flex-1 font-mono text-xs" />
        <button onClick={async () => { await navigator.clipboard.writeText(url); }} className="rounded-md border border-input px-3 py-2 text-xs font-semibold">Copy link</button>
      </div>
    </Modal>
  );
}

/* ---------- Raise Charge ---------- */

type ChargeKey = "customs" | "import_duty" | "storage" | "docs" | "handling" | "insurance" | "lastmile" | "reweigh" | "detention";

const CHARGE_CATALOG: Record<ChargeKey, { label: string; hint: string; defaultAmt: (s: Shipment) => number }> = {
  customs:     { label: "Customs Clearance Fee",     hint: "Broker + inspection charges",         defaultAmt: (s) => s.is_overseas ? 120 : 0 },
  import_duty: { label: "Import Duty",               hint: "Country-specific duty (auto-est.)",   defaultAmt: (s) => s.is_overseas ? Math.round(s.weight_kg * 4.5) : 0 },
  storage:     { label: "Storage / Demurrage",       hint: "Per day at bonded warehouse",         defaultAmt: () => 25 },
  docs:        { label: "Documentation Fee",         hint: "BoE / AWB / COO preparation",         defaultAmt: () => 18 },
  handling:    { label: "Special Handling",          hint: "Hazmat / fragile / oversize",         defaultAmt: () => 35 },
  insurance:   { label: "Cargo Insurance",           hint: "All-risk coverage (0.5% of value)",   defaultAmt: () => 40 },
  lastmile:    { label: "Last-Mile Surcharge",       hint: "Remote / tail-lift delivery",         defaultAmt: () => 22 },
  reweigh:     { label: "Reweigh / Volumetric Adj.", hint: "Chargeable-weight correction",        defaultAmt: (s) => Math.round(s.weight_kg * 0.8) },
  detention:   { label: "Detention Charges",         hint: "Container / vehicle detention",       defaultAmt: () => 60 },
};

const COUNTRY_DUTY: Record<string, number> = {
  "United States": 8.5, "United Kingdom": 12, "Germany": 19, "France": 20, "Netherlands": 21,
  "UAE": 5, "Saudi Arabia": 15, "Singapore": 7, "Australia": 10, "Japan": 10,
  "China": 13, "India": 18, "Canada": 5, "Brazil": 22, "South Africa": 15,
};

function RaiseChargeModal({ shipment, onClose, onLogged }: { shipment: Shipment; onClose: () => void; onLogged: () => void }) {
  const currency = shipment.is_overseas ? "USD" : "INR";
  const sym = currency === "USD" ? "$" : "₹";
  const fmt = (n: number) => `${sym}${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

  const [country, setCountry] = useState<string>(Object.keys(COUNTRY_DUTY)[0]);
  const [cargoValue, setCargoValue] = useState<number>(2500);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<Record<ChargeKey, { on: boolean; amt: number; qty: number }>>(() => {
    const init = {} as Record<ChargeKey, { on: boolean; amt: number; qty: number }>;
    (Object.keys(CHARGE_CATALOG) as ChargeKey[]).forEach(k => {
      init[k] = { on: false, amt: CHARGE_CATALOG[k].defaultAmt(shipment), qty: 1 };
    });
    return init;
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function setItem(k: ChargeKey, patch: Partial<{ on: boolean; amt: number; qty: number }>) {
    setItems(s => ({ ...s, [k]: { ...s[k], ...patch } }));
  }

  // recompute import duty when country/cargoValue changes
  const dutyPct = COUNTRY_DUTY[country] ?? 10;
  const dutyEstimate = Math.round(cargoValue * (dutyPct / 100));

  const active = (Object.keys(items) as ChargeKey[]).filter(k => items[k].on);
  const subtotal = active.reduce((sum, k) => {
    const amt = k === "import_duty" ? dutyEstimate : items[k].amt;
    return sum + amt * items[k].qty;
  }, 0);
  const gst = subtotal * 0.18;
  const total = subtotal + gst;

  async function logAsMilestone() {
    if (!active.length) { setMsg("Select at least one charge."); return; }
    setBusy(true); setMsg(null);
    const summary = active.map(k => `${CHARGE_CATALOG[k].label}: ${fmt((k === "import_duty" ? dutyEstimate : items[k].amt) * items[k].qty)}`).join(" · ");
    await supabase.from("milestones").insert({
      shipment_id: shipment.id,
      location: shipment.destination,
      status_text: `Additional charges raised — ${summary}. Total ${fmt(total)}${notes ? ` · ${notes}` : ""}`,
    });
    setBusy(false);
    setMsg(`✓ Charges logged to shipment timeline (${fmt(total)}).`);
    onLogged();
  }

  function printCharge() {
    const html = document.getElementById("charge-print")?.innerHTML;
    if (!html) return;
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>Charge Note ${shipment.tracking_number}</title>
      <style>body{font-family:system-ui,sans-serif;color:#0B1C3E;padding:32px;max-width:800px;margin:auto}h1{color:#E31E24;margin:0}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{text-align:left;padding:8px;border-bottom:1px solid #e5e7eb;font-size:14px}th{background:#0B1C3E;color:white}.right{text-align:right}</style>
      </head><body>${html}</body></html>`);
    w.document.close(); w.focus(); setTimeout(() => w.print(), 300);
  }

  return (
    <Modal title="Raise Additional Charges" onClose={onClose} wide>
      <div className="text-sm text-muted-foreground">
        Add extra billable line items such as customs clearance, country-specific import duties, storage, documentation and more. Log to the shipment timeline or print a charge note for the customer.
      </div>

      {shipment.is_overseas && (
        <div className="mt-5 grid gap-4 md:grid-cols-2 rounded-lg border border-border bg-slate/40 p-4">
          <F label="Destination Country (for import duty)">
            <select value={country} onChange={e => setCountry(e.target.value)} className="input">
              {Object.entries(COUNTRY_DUTY).map(([c, p]) => <option key={c} value={c}>{c} — {p}% duty</option>)}
            </select>
          </F>
          <F label={`Declared Cargo Value (${currency})`}>
            <input type="number" min={0} value={cargoValue} onChange={e => setCargoValue(Number(e.target.value))} className="input" />
          </F>
          <div className="md:col-span-2 text-xs text-muted-foreground">
            Estimated import duty for <strong className="text-navy">{country}</strong> @ {dutyPct}% = <strong className="text-red">{fmt(dutyEstimate)}</strong>
          </div>
        </div>
      )}

      <div className="mt-5 space-y-2">
        {(Object.keys(CHARGE_CATALOG) as ChargeKey[]).map(k => {
          const meta = CHARGE_CATALOG[k];
          const row = items[k];
          const isDuty = k === "import_duty";
          const amt = isDuty ? dutyEstimate : row.amt;
          return (
            <div key={k} className={`rounded-md border p-3 flex flex-wrap items-center gap-3 ${row.on ? "border-navy bg-navy/5" : "border-border bg-white"}`}>
              <label className="flex items-center gap-2 flex-1 min-w-[220px] cursor-pointer">
                <input type="checkbox" checked={row.on} onChange={e => setItem(k, { on: e.target.checked })} className="h-4 w-4 accent-red" />
                <div>
                  <div className="text-sm font-semibold text-navy">{meta.label}</div>
                  <div className="text-xs text-muted-foreground">{meta.hint}</div>
                </div>
              </label>
              <div className="flex items-center gap-2">
                <div className="text-[11px] font-semibold text-muted-foreground uppercase">Amt ({currency})</div>
                <input
                  type="number" min={0} value={amt} disabled={isDuty}
                  onChange={e => setItem(k, { amt: Number(e.target.value) })}
                  className="input !h-9 !w-28 disabled:opacity-60"
                />
                <div className="text-[11px] font-semibold text-muted-foreground uppercase">Qty</div>
                <input
                  type="number" min={1} value={row.qty}
                  onChange={e => setItem(k, { qty: Math.max(1, Number(e.target.value)) })}
                  className="input !h-9 !w-16"
                />
                <div className="w-24 text-right text-sm font-bold text-navy">{fmt(amt * row.qty)}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4">
        <F label="Notes (optional)">
          <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Awaiting BoE from consignee" className="input" />
        </F>
      </div>

      <div id="charge-print" className="mt-5 rounded-lg border border-border p-4 bg-white">
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <h1 style={{ margin: 0, color: "#E31E24", fontSize: 22 }}>DTDC XPRESS+ — Charge Note</h1>
            <div style={{ fontSize: 12, color: "#64748b" }}>AWB {shipment.tracking_number} · {shipment.origin} → {shipment.destination}</div>
          </div>
          <div style={{ fontSize: 12, color: "#64748b", textAlign: "right" }}>{new Date().toLocaleDateString()}</div>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: 6, background: "#0B1C3E", color: "white", fontSize: 12 }}>Charge</th>
              <th style={{ textAlign: "right", padding: 6, background: "#0B1C3E", color: "white", fontSize: 12 }}>Rate</th>
              <th style={{ textAlign: "right", padding: 6, background: "#0B1C3E", color: "white", fontSize: 12 }}>Qty</th>
              <th style={{ textAlign: "right", padding: 6, background: "#0B1C3E", color: "white", fontSize: 12 }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {active.length === 0 && <tr><td colSpan={4} style={{ padding: 10, color: "#64748b", fontSize: 13 }}>No charges selected.</td></tr>}
            {active.map(k => {
              const amt = k === "import_duty" ? dutyEstimate : items[k].amt;
              const label = k === "import_duty" ? `${CHARGE_CATALOG[k].label} (${country} @ ${dutyPct}%)` : CHARGE_CATALOG[k].label;
              return (
                <tr key={k}>
                  <td style={{ padding: 6, borderBottom: "1px solid #e5e7eb", fontSize: 13 }}>{label}</td>
                  <td style={{ padding: 6, textAlign: "right", borderBottom: "1px solid #e5e7eb", fontSize: 13 }}>{fmt(amt)}</td>
                  <td style={{ padding: 6, textAlign: "right", borderBottom: "1px solid #e5e7eb", fontSize: 13 }}>{items[k].qty}</td>
                  <td style={{ padding: 6, textAlign: "right", borderBottom: "1px solid #e5e7eb", fontSize: 13 }}>{fmt(amt * items[k].qty)}</td>
                </tr>
              );
            })}
            <tr><td colSpan={3} style={{ padding: 6, textAlign: "right", fontSize: 13 }}>Subtotal</td><td style={{ padding: 6, textAlign: "right", fontSize: 13 }}>{fmt(subtotal)}</td></tr>
            <tr><td colSpan={3} style={{ padding: 6, textAlign: "right", fontSize: 13 }}>GST / Tax (18%)</td><td style={{ padding: 6, textAlign: "right", fontSize: 13 }}>{fmt(gst)}</td></tr>
            <tr><td colSpan={3} style={{ padding: 8, textAlign: "right", fontWeight: 700 }}>Total Payable</td><td style={{ padding: 8, textAlign: "right", fontWeight: 700, color: "#E31E24" }}>{fmt(total)}</td></tr>
          </tbody>
        </table>
        {notes && <div style={{ marginTop: 10, fontSize: 12, color: "#64748b" }}>Notes: {notes}</div>}
      </div>

      {msg && <div className="mt-4 text-sm font-semibold text-navy">{msg}</div>}

      <div className="mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
        <button onClick={onClose} className="rounded-md border border-input px-4 py-2 text-sm font-semibold">Close</button>
        <button onClick={printCharge} className="inline-flex items-center gap-2 rounded-md border border-input bg-white px-4 py-2 text-sm font-semibold">
          <Printer className="h-4 w-4" /> Print Charge Note
        </button>
        <button onClick={logAsMilestone} disabled={busy || active.length === 0} className="inline-flex items-center gap-2 rounded-md bg-red px-4 py-2 text-sm font-semibold text-red-foreground disabled:opacity-60">
          <Receipt className="h-4 w-4" /> Log to Timeline · {fmt(total)}
        </button>
      </div>
    </Modal>
  );
}
