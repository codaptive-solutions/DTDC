import { supabase } from "@/integrations/supabase/client";

export type Shipment = {
  id: string;
  tracking_number: string;
  sender_company: string;
  receiver_company: string;
  origin: string;
  destination: string;
  is_overseas: boolean;
  status: string;
  hold_reason: string | null;
  weight_kg: number;
  estimated_delivery: string | null;
  requested_delivery_date: string | null;
  delivery_date_request_status: string;
  scheduled_delivery_date: string | null;
  delivery_date_reviewed_at: string | null;
  delivery_date_rejection_reason: string | null;
  created_at: string;
  needs_reverification: boolean;
};

export type Milestone = {
  id: string;
  shipment_id: string;
  location: string;
  status_text: string;
  timestamp: string;
};

export type DeliveryDateAvailability = {
  id: string;
  delivery_date: string;
  is_overseas: boolean;
  is_available: boolean;
  created_at: string;
};

export const STATUS_FLOW = [
  "Booked",
  "Picked Up",
  "In Transit",
  "On Hold",
  "Customs Clearance",
  "Hub Arrival",
  "Out for Delivery",
  "Delivered",
] as const;

export async function listDeliveryDateAvailability() {
  const { data, error } = await supabase
    .from("delivery_date_availability")
    .select("*")
    .order("delivery_date", { ascending: true });
  if (error) throw error;
  return (data ?? []) as DeliveryDateAvailability[];
}

export async function listAvailableDeliveryDates(isOverseas: boolean) {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("delivery_date_availability")
    .select("delivery_date")
    .eq("is_overseas", isOverseas)
    .eq("is_available", true)
    .gte("delivery_date", today)
    .order("delivery_date", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(row => row.delivery_date);
}

export async function requestDeliveryDate(shipmentId: string, requestedDate: string, isOverseas: boolean) {
  const today = new Date().toISOString().slice(0, 10);
  const { data: available, error: checkError } = await supabase
    .from("delivery_date_availability")
    .select("id")
    .eq("delivery_date", requestedDate)
    .eq("is_overseas", isOverseas)
    .eq("is_available", true)
    .gte("delivery_date", today)
    .maybeSingle();
  if (checkError) throw checkError;
  if (!available) throw new Error("Requested delivery date is not available");

  const { error } = await supabase
    .from("shipments")
    .update({ requested_delivery_date: requestedDate, delivery_date_request_status: "pending" })
    .eq("id", shipmentId);
  if (error) throw error;
}

export async function approveDeliveryDateRequest(shipmentId: string) {
  const { data: shipment, error: fetchError } = await supabase
    .from("shipments")
    .select("requested_delivery_date")
    .eq("id", shipmentId)
    .maybeSingle();
  if (fetchError) throw fetchError;
  if (!shipment?.requested_delivery_date) throw new Error("No delivery date request to approve");

  const { error } = await supabase
    .from("shipments")
    .update({
      delivery_date_request_status: "approved",
      scheduled_delivery_date: shipment.requested_delivery_date,
      delivery_date_reviewed_at: new Date().toISOString(),
    })
    .eq("id", shipmentId);
  if (error) throw error;
}

export async function rejectDeliveryDateRequest(shipmentId: string, reason?: string) {
  const { error } = await supabase
    .from("shipments")
    .update({
      delivery_date_request_status: "rejected",
      scheduled_delivery_date: null,
      delivery_date_reviewed_at: new Date().toISOString(),
      delivery_date_rejection_reason: reason || null,
    })
    .eq("id", shipmentId);
  if (error) throw error;
}

export async function listPendingDeliveryDateRequests() {
  const { data, error } = await supabase
    .from("shipments")
    .select("*")
    .eq("delivery_date_request_status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Shipment[];
}

export async function findShipment(trackingNumber: string) {
  const tn = trackingNumber.trim().toUpperCase();
  const { data: shipment, error } = await supabase
    .from("shipments")
    .select("*")
    .ilike("tracking_number", tn)
    .maybeSingle();
  if (error) throw error;
  if (!shipment) return null;
  const { data: milestones } = await supabase
    .from("milestones")
    .select("*")
    .eq("shipment_id", shipment.id)
    .order("timestamp", { ascending: true });
  return { shipment: shipment as Shipment, milestones: (milestones ?? []) as Milestone[] };
}

export async function listShipments() {
  const { data, error } = await supabase
    .from("shipments")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Shipment[];
}

export async function listMilestones(shipmentId: string) {
  const { data, error } = await supabase
    .from("milestones")
    .select("*")
    .eq("shipment_id", shipmentId)
    .order("timestamp", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Milestone[];
}
