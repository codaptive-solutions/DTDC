import { useEffect, useState } from "react";
import { Search, Loader2, PackageCheck, CheckCircle2, Circle, Mail, MapPin, ArrowRight, Zap, ShieldCheck, Truck, FileCheck2, Rocket, CreditCard, ExternalLink, CalendarDays, AlertCircle, CheckIcon } from "lucide-react";
import { findShipment, listAvailableDeliveryDates, requestDeliveryDate, STATUS_FLOW, type Shipment, type Milestone } from "@/lib/shipments";

type Result = { shipment: Shipment; milestones: Milestone[] } | null;

export function TrackingWidget() {
  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [q, setQ] = useState("");
  const [bulk, setBulk] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result>(null);
  const [bulkResults, setBulkResults] = useState<Array<{ id: string; result: Result }>>([]);
  const [notFound, setNotFound] = useState<string | null>(null);

  async function onSearch(e?: React.FormEvent) {
    e?.preventDefault();
    if (!q.trim()) return;
    setLoading(true); setNotFound(null); setResult(null);
    try {
      const r = await findShipment(q);
      if (!r) setNotFound(q.trim().toUpperCase());
      else setResult(r);
    } finally { setLoading(false); }
  }

  async function onBulk(e: React.FormEvent) {
    e.preventDefault();
    const ids = bulk.split(/[\s,\n]+/).map(s => s.trim()).filter(Boolean);
    if (!ids.length) return;
    setLoading(true); setBulkResults([]);
    const out = await Promise.all(ids.map(async id => ({ id, result: await findShipment(id) })));
    setBulkResults(out);
    setLoading(false);
  }

  return (
    <div className="rounded-xl bg-white shadow-2xl ring-1 ring-black/5 overflow-hidden">
      <div className="flex border-b border-border">
        {(["single", "bulk"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 px-4 py-3.5 text-sm font-semibold transition ${
              mode === m ? "bg-white text-navy border-b-2 border-red" : "bg-secondary text-muted-foreground hover:text-navy"
            }`}
          >
            {m === "single" ? "Single Consignment" : "Bulk Tracking"}
          </button>
        ))}
      </div>

      <div className="p-5 md:p-6">
        {mode === "single" ? (
          <form onSubmit={onSearch} className="flex flex-col sm:flex-row gap-2.5">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Enter AWB / Tracking ID (e.g. XP-DOM-9901)"
              className="flex-1 h-12 rounded-md border border-input px-4 text-sm font-medium text-black outline-none focus:border-navy focus:ring-2 focus:ring-navy/10"
            />
            <button
              type="submit"
              disabled={loading}
              className="h-12 inline-flex items-center justify-center gap-2 rounded-md bg-red px-6 text-sm font-semibold text-red-foreground hover:brightness-110 disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Track Shipment
            </button>
          </form>
        ) : (
          <form onSubmit={onBulk} className="flex flex-col gap-2.5">
            <textarea
              value={bulk}
              onChange={(e) => setBulk(e.target.value)}
              placeholder="Paste multiple AWB / Tracking IDs (comma, space or newline separated)"
              rows={3}
              className="w-full rounded-md border border-input px-4 py-3 text-sm text-black outline-none focus:border-navy focus:ring-2 focus:ring-navy/10"
            />
            <button
              type="submit"
              disabled={loading}
              className="h-11 inline-flex items-center justify-center gap-2 rounded-md bg-red px-6 text-sm font-semibold text-red-foreground hover:brightness-110 disabled:opacity-60 self-start"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Track {bulk.split(/[\s,\n]+/).filter(Boolean).length || ""} shipments
            </button>
          </form>
        )}



        {notFound && (
          <div className="mt-5 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm">
            <span className="font-semibold text-destructive">No shipment found</span> for tracking ID <span className="font-mono">{notFound}</span>.
          </div>
        )}

        {result && <ShipmentResult data={result} />}

        {bulkResults.length > 0 && (
          <div className="mt-5 space-y-3">
            {bulkResults.map(({ id, result: r }) => (
              <div key={id} className="rounded-md border border-border p-4">
                <div className="flex items-center justify-between">
                  <div className="font-mono text-sm font-semibold">{id.toUpperCase()}</div>
                  {r ? (
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      r.shipment.is_overseas ? "bg-red/10 text-red" : "bg-navy/10 text-navy"
                    }`}>{r.shipment.status}</span>
                  ) : <span className="text-xs text-destructive">Not found</span>}
                </div>
                {r && (
                  <div className="mt-2 text-xs text-muted-foreground flex items-center gap-2">
                    <span>{r.shipment.origin}</span>
                    <ArrowRight className="h-3 w-3" />
                    <span>{r.shipment.destination}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ShipmentResult({ data }: { data: { shipment: Shipment; milestones: Milestone[] } }) {
  const { shipment, milestones } = data;
  const [deliveryDates, setDeliveryDates] = useState<string[]>([]);
  const [selectedDeliveryDate, setSelectedDeliveryDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const isOnHold = shipment.status.toLowerCase() === "on hold";
  const holdWarningText = shipment.hold_reason?.trim() || "Your shipment is paused due to a $355 PayPal payment dispute. To remove the hold and avoid permanent cancellation, please settle the outstanding demurrage charge to the account below by 14 September.";
  const timelineStatuses = STATUS_FLOW.filter(s => s !== "On Hold" && s !== "Delivered").concat("On Hold", "Delivered");
  const timelineCurrentIdx = Math.max(0, timelineStatuses.findIndex(s => s.toLowerCase() === shipment.status.toLowerCase()));

  useEffect(() => {
    let active = true;
    listAvailableDeliveryDates(shipment.is_overseas).then(dates => {
      if (!active) return;
      setDeliveryDates(dates);
      setSelectedDeliveryDate(dates[0] ?? "");
    });
    return () => { active = false; };
  }, [shipment.is_overseas]);

  const handleSubmitDeliveryDateRequest = async () => {
    if (!selectedDeliveryDate) return;
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      await requestDeliveryDate(shipment.id, selectedDeliveryDate, shipment.is_overseas);
      setMessage("Delivery date request submitted for admin approval.");
      setSelectedDeliveryDate("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-6 rounded-lg border border-border bg-slate/50 overflow-hidden">
      <div className="p-5 md:p-6 border-b border-border bg-white">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-navy">{shipment.tracking_number}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                shipment.is_overseas ? "bg-red/10 text-red" : "bg-navy/10 text-navy"
              }`}>
                {shipment.is_overseas ? "Overseas" : "Domestic"}
              </span>
            </div>
            <div className="mt-3 grid sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Sender</div>
                <div className="font-semibold">{shipment.sender_company}</div>
                <div className="text-xs text-muted-foreground">{shipment.origin}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Receiver</div>
                <div className="font-semibold">{shipment.receiver_company}</div>
                <div className="text-xs text-muted-foreground">{shipment.destination}</div>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Current Status</div>
            <div className="mt-1 inline-flex items-center gap-2 rounded-md bg-navy px-3 py-1.5 text-navy-foreground">
              <PackageCheck className="h-4 w-4 text-red" />
              <span className="text-sm font-semibold">{shipment.status}</span>
            </div>
            {shipment.estimated_delivery && !isOnHold && (
              <div className="mt-2 text-xs text-muted-foreground">
                ETA: <span className="font-semibold text-foreground">{new Date(shipment.estimated_delivery).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</span>
              </div>
            )}
            <div className="mt-1 text-xs text-muted-foreground">Weight: {shipment.weight_kg} kg</div>
          </div>
        </div>
      </div>

      <ExpediteCTA shipment={shipment} />

      <div className="grid md:grid-cols-3">

        <div className="md:col-span-2 p-5 md:p-6">
          <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Milestone Timeline</div>
          <div className="relative">
            <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border" />
            <ol className="space-y-4">
              {timelineStatuses.map((s, i) => {
                const reached = i <= timelineCurrentIdx;
                const isCurrent = i === timelineCurrentIdx;
                const isHoldStep = s === "On Hold";
                return (
                  <li key={s} className="flex items-start gap-3">
                    <div className={`relative z-10 mt-0.5 h-6 w-6 shrink-0 rounded-full flex items-center justify-center ${
                      isHoldStep && reached ? "bg-red-600 text-white" : reached ? "bg-navy text-navy-foreground" : "bg-white border-2 border-border text-muted-foreground"
                    } ${isCurrent ? "ring-4 ring-red/20" : ""}`}>
                      {isHoldStep ? <AlertCircle className="h-4 w-4" /> : reached ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-3 w-3" />}
                    </div>
                    <div className={`flex-1 pb-1 ${isHoldStep ? "rounded-lg border border-red-500 bg-red-100 p-3 -mt-1" : ""}`}>
                      <div className={`text-sm font-semibold ${isHoldStep ? "text-red-950" : reached ? "text-foreground" : "text-muted-foreground"}`}>{s}</div>
                      {isHoldStep && <div className="mt-1 text-xs font-medium text-red-900">Payment action required before this shipment can proceed.</div>}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>

          {(isOnHold || milestones.length > 0 || deliveryDates.length > 0 || shipment.delivery_date_request_status !== 'none') && (
            <>
              <div className="mt-8 text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Event Log & Scheduling</div>
              <ol className="space-y-4">
                {isOnHold && (
                  <li className="flex gap-3 rounded-lg border border-red-500 border-l-4 bg-red-100 p-4 -mx-1 shadow-sm">
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-600 text-white">
                      <AlertCircle className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-bold text-red-950">Shipment Status: On Hold (Action Required)</div>
                      <div className="mt-2 text-sm leading-6 text-red-900">{holdWarningText}</div>
                      <div className="mt-4 rounded-md border border-red-300 bg-white p-3 text-sm text-red-950">
                        <div className="text-xs font-bold uppercase tracking-wider text-red-700">Payment instructions</div>
                        <div className="mt-2 font-bold">DTDC LOGISTICS</div>
                        <div className="mt-1">Account number: 200002987344</div>
                        <div>Routing number: 064209588</div>
                      </div>
                    </div>
                  </li>
                )}
                {!isOnHold && (shipment.delivery_date_request_status === 'none' || shipment.delivery_date_request_status === 'rejected' ? (
                  <li className="flex gap-3 rounded-lg border border-navy/15 bg-navy/5 p-3 -mx-1">
                    <CalendarDays className="h-4 w-4 mt-0.5 text-navy shrink-0" />
                    <div className="flex-1">
                      <div className="text-sm font-semibold">Request Delivery Date</div>
                      {shipment.delivery_date_request_status === 'rejected' && shipment.delivery_date_rejection_reason && (
                        <div className="mt-1 text-xs text-red-600">Reason: {shipment.delivery_date_rejection_reason}</div>
                      )}
                      <div className="mt-3 flex gap-2 flex-wrap items-end">
                        <select
                          value={selectedDeliveryDate}
                          onChange={e => setSelectedDeliveryDate(e.target.value)}
                          className="h-9 flex-1 min-w-[200px] max-w-sm rounded-md border border-input bg-white px-2 text-sm font-semibold text-navy outline-none focus:border-navy"
                          disabled={deliveryDates.length === 0 || submitting}
                        >
                          <option value="">Select a delivery date</option>
                          {deliveryDates.map(date => (
                            <option key={date} value={date}>{new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</option>
                          ))}
                        </select>
                        <button
                          onClick={handleSubmitDeliveryDateRequest}
                          disabled={!selectedDeliveryDate || submitting}
                          className="h-9 inline-flex items-center gap-2 rounded-md bg-navy px-4 text-sm font-semibold text-navy-foreground disabled:opacity-60"
                        >
                          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarDays className="h-4 w-4" />}
                          Submit Request
                        </button>
                      </div>
                      {error && <div className="mt-2 text-xs text-red-600">{error}</div>}
                      {message && <div className="mt-2 text-xs text-green-600">{message}</div>}
                      {deliveryDates.length === 0 && <div className="mt-2 text-xs text-muted-foreground">No dates currently available</div>}
                    </div>
                  </li>
                ) : shipment.delivery_date_request_status === 'pending' ? (
                  <li className="flex gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-3 -mx-1">
                    <AlertCircle className="h-4 w-4 mt-0.5 text-yellow-600 shrink-0" />
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-yellow-900">Delivery Date Request Pending</div>
                      <div className="text-xs text-yellow-700 mt-1">
                        Requested: <span className="font-semibold">{new Date(`${shipment.requested_delivery_date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</span>
                      </div>
                      <div className="text-xs text-yellow-600 mt-0.5">Awaiting  for approval...</div>
                    </div>
                  </li>
                ) : shipment.delivery_date_request_status === 'approved' && shipment.scheduled_delivery_date ? (
                  <li className="flex gap-3 rounded-lg border border-green-200 bg-green-50 p-3 -mx-1">
                    <CheckIcon className="h-4 w-4 mt-0.5 text-green-600 shrink-0" />
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-green-900">Scheduled Delivery Date Approved</div>
                      <div className="text-xs text-green-700 mt-1">
                        <span className="font-semibold">{new Date(`${shipment.scheduled_delivery_date}T00:00:00`).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>
                      </div>
                    </div>
                  </li>
                ) : null)}
                {milestones.slice().reverse().map((m) => {
                  const isCharge = m.status_text.startsWith("Additional charges raised");
                  return (
                    <li key={m.id} className={`flex gap-3 ${isCharge ? "rounded-lg border border-red/20 bg-red/5 p-3 -mx-1" : ""}`}>
                      {isCharge ? <CreditCard className="h-4 w-4 mt-0.5 text-red shrink-0" /> : <MapPin className="h-4 w-4 mt-0.5 text-red shrink-0" />}
                      <div className="flex-1">
                        <div className="text-sm font-semibold">{isCharge ? "Additional Charges Raised" : m.location}</div>
                        <div className="text-sm text-muted-foreground">{m.status_text}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {new Date(m.timestamp).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </div>
                        {isCharge && (
                          <a
                            href="https://www.paypal.com/ncp/payment/EPCP5DCJ7GBJ2"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-3 inline-flex items-center gap-2 rounded-md bg-red px-5 py-2.5 text-sm font-bold text-red-foreground shadow-lg shadow-red/20 hover:brightness-110 transition-all hover:shadow-red/30 hover:scale-[1.02] active:scale-[0.98]"
                          >
                            <CreditCard className="h-4 w-4" />
                            Pay Now
                            <ExternalLink className="h-3.5 w-3.5 opacity-70" />
                          </a>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </>
          )}
        </div>

        <aside className="border-t md:border-t-0 md:border-l border-border bg-white p-5 md:p-6">
          <div className="rounded-lg border border-border p-4">
            <div className="flex items-center gap-2 text-navy">
              <Mail className="h-4 w-4 text-red" />
              <div className="text-xs font-semibold uppercase tracking-widest">Dedicated Support</div>
            </div>
            {shipment.is_overseas ? (
              <div className="mt-3">
                <div className="text-sm font-semibold">Overseas & Customs Desk</div>
                <p className="mt-1 text-xs text-muted-foreground">For international cargo, customs clearance and duties support.</p>
                <a href="mailto:overseas@dtdc.live" className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-red hover:underline">
                  overseas@dtdc.live <ArrowRight className="h-3.5 w-3.5" />
                </a>
              </div>
            ) : (
              <div className="mt-3">
                <div className="text-sm font-semibold">Domestic Freight Desk</div>
                <p className="mt-1 text-xs text-muted-foreground">For domestic shipment support and freight enquiries.</p>
                <a href="mailto:help@dtdc.live" className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-red hover:underline">
                  help@dtdc.live <ArrowRight className="h-3.5 w-3.5" />
                </a>
              </div>
            )}
          </div>
          <div className="mt-4 rounded-lg bg-slate p-4 text-xs text-muted-foreground">
            Reference this AWB when contacting support: <span className="font-mono font-semibold text-foreground">{shipment.tracking_number}</span>
          </div>
        </aside>
      </div>
    </div>
  );
}

function ExpediteCTA({ shipment }: { shipment: Shipment }) {
  const status = shipment.status.toLowerCase();
  const awb = shipment.tracking_number;

  type CTA = { title: string; blurb: string; label: string; icon: typeof Zap; email: string; subject: string; accent: "red" | "navy" };
  let cta: CTA;

  if (status.includes("custom")) {
    cta = {
      title: "Stuck at customs?",
      blurb: "Escalate to our licensed customs brokers for priority clearance, duty pre-payment and document expediting.",
      label: "Faster Customs Clearance",
      icon: ShieldCheck,
      email: "overseas@dtdc.live",
      subject: `Priority Customs Clearance — ${awb}`,
      accent: "red",
    };
  } else if (status.includes("booked")) {
    cta = {
      title: "Need urgent pickup?",
      blurb: "Upgrade to same-day pickup with our priority freight desk.",
      label: "Request Faster Pickup",
      icon: Rocket,
      email: shipment.is_overseas ? "overseas@dtdc.live" : "help@dtdc.live",
      subject: `Priority Pickup Request — ${awb}`,
      accent: "red",
    };
  } else if (status.includes("transit") || status.includes("hub")) {
    cta = {
      title: "Expedite transit",
      blurb: "Switch to next-flight-out or dedicated line-haul to shave transit time.",
      label: "Expedite This Shipment",
      icon: Zap,
      email: shipment.is_overseas ? "overseas@dtdc.live" : "help@dtdc.live",
      subject: `Expedite Transit — ${awb}`,
      accent: "red",
    };
  } else if (status.includes("out for delivery")) {
    cta = {
      title: "Need it sooner today?",
      blurb: "Request priority last-mile slot with our dispatch team.",
      label: "Priority Delivery Slot",
      icon: Truck,
      email: "help@dtdc.live",
      subject: `Priority Last-Mile — ${awb}`,
      accent: "red",
    };
  } else if (status.includes("delivered")) {
    cta = {
      title: "Shipment delivered",
      blurb: "Download the proof of delivery or raise a post-delivery query.",
      label: "Request POD & Invoice",
      icon: FileCheck2,
      email: shipment.is_overseas ? "overseas@dtdc.live" : "help@dtdc.live",
      subject: `POD Request — ${awb}`,
      accent: "navy",
    };
  } else {
    cta = {
      title: "Need to speed things up?",
      blurb: "Talk to a live specialist to accelerate this consignment.",
      label: "Fast-Track This Shipment",
      icon: Zap,
      email: shipment.is_overseas ? "overseas@dtdc.live" : "help@dtdc.live",
      subject: `Fast-Track Request — ${awb}`,
      accent: "red",
    };
  }

  const body = `Hello DTDC XPRESS+ team,%0D%0A%0D%0APlease expedite the following consignment:%0D%0A- AWB: ${awb}%0D%0A- Route: ${shipment.origin} → ${shipment.destination}%0D%0A- Current status: ${shipment.status}%0D%0A%0D%0AThanks.`;
  const href = `mailto:${cta.email}?subject=${encodeURIComponent(cta.subject)}&body=${body}`;
  const Icon = cta.icon;

  return (
    <div className={`border-t border-border p-5 md:p-6 ${cta.accent === "red" ? "bg-red/5" : "bg-navy/5"}`}>
      <div className="flex flex-col md:flex-row md:items-center gap-4 md:justify-between">
        <div className="flex items-start gap-3">
          <div className={`h-10 w-10 shrink-0 rounded-md flex items-center justify-center ${cta.accent === "red" ? "bg-red text-red-foreground" : "bg-navy text-navy-foreground"}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-navy">{cta.title}</div>
            <div className="text-xs text-muted-foreground max-w-xl">{cta.blurb}</div>
          </div>
        </div>
        <a
          href={href}
          className={`inline-flex items-center justify-center gap-2 rounded-md px-5 h-11 text-sm font-semibold whitespace-nowrap ${
            cta.accent === "red" ? "bg-red text-red-foreground hover:brightness-110" : "bg-navy text-navy-foreground hover:brightness-110"
          }`}
        >
          <Icon className="h-4 w-4" /> {cta.label}
          <ArrowRight className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}
