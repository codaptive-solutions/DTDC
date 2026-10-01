import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const payload = await request.json();
    const requiredFields = ["fullName", "businessEmail", "companyName"];
    const missingField = requiredFields.find((field) => !String(payload[field] ?? "").trim());

    if (missingField) {
      return new Response(JSON.stringify({ error: `${missingField} is required` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Supabase environment variables are missing");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { error: insertError } = await supabase
      .from("merchant_enquiries")
      .insert({
        full_name: String(payload.fullName).trim(),
        business_email: String(payload.businessEmail).trim(),
        company_name: String(payload.companyName).trim(),
        tax_id: payload.taxId ? String(payload.taxId).trim() : null,
        volume: payload.volume ? String(payload.volume).trim() : null,
        trade_type: payload.tradeType ? String(payload.tradeType).trim() : null,
        details: payload.details ? String(payload.details).trim() : null,
      });

    if (insertError) {
      console.error("Supabase insert error:", insertError);
      return new Response(JSON.stringify({ error: "Failed to store enquiry in database" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("send-enquiry error:", error);
    return new Response(JSON.stringify({ error: "Unable to send enquiry" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
