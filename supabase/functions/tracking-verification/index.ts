import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const bucketName = "tracking-verifications";
const policyVersion = "tracking-verification-2026-10-01";
const maxFileSize = 5 * 1024 * 1024;
const allowedMimeTypes = new Set(["image/jpeg", "image/png", "application/pdf"]);

function allowedOrigins(): string[] {
  return (
    Deno.env.get("TRACKING_VERIFICATION_ALLOWED_ORIGINS") ??
    "https://www.dtdc.live"
  )
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (allowedOrigins().includes(origin)) return true;
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

function corsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function jsonResponse(body: unknown, status: number, origin: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}

function formString(form: FormData, name: string, maxLength = 500): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function fileExtension(file: File): string | null {
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/png") return "png";
  if (file.type === "application/pdf") return "pdf";
  return null;
}

async function hasValidSignature(file: File): Promise<boolean> {
  const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  if (file.type === "image/jpeg")
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (file.type === "image/png")
    return [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte);
  if (file.type === "application/pdf")
    return new TextDecoder().decode(bytes.slice(0, 4)) === "%PDF";
  return false;
}

Deno.serve(async (request) => {
  const origin = request.headers.get("Origin");
  if (!origin || !isAllowedOrigin(origin))
    return new Response("Origin not allowed", { status: 403 });

  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(origin) });
  }

  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405, origin);

  let frontPath = "";
  let backPath = "";
  try {
    const form = await request.formData();
    const fullName = formString(form, "fullName", 160);
    const contactNumber = formString(form, "phone", 40);
    const deliveryAddress = formString(form, "deliveryAddress", 500);
    const companyName = formString(form, "companyName", 200);
    const ein = formString(form, "ein", 20);
    const ssn = formString(form, "ssn", 20);
    const dba = formString(form, "dba", 200);
    const registrationType = formString(form, "registrationType", 80);
    const registrationNumber = formString(form, "registrationNumber", 100);
    const consented = formString(form, "consented", 5) === "true";
    const frontId = form.get("frontId");
    const backId = form.get("backId");

    let trackingNumbers: unknown;
    try {
      trackingNumbers = JSON.parse(formString(form, "trackingNumbers", 2000));
    } catch {
      return jsonResponse({ error: "Invalid tracking numbers" }, 400, origin);
    }

    if (
      !fullName ||
      !contactNumber ||
      !deliveryAddress ||
      !companyName ||
      !ein ||
      !ssn ||
      !consented ||
      !Array.isArray(trackingNumbers) ||
      trackingNumbers.length < 1 ||
      trackingNumbers.length > 25 ||
      !trackingNumbers.every(
        (number) => typeof number === "string" && number.trim().length > 0 && number.length <= 80,
      ) ||
      !(frontId instanceof File) ||
      !(backId instanceof File)
    ) {
      return jsonResponse(
        { error: "Complete all required fields and attach both ID sides" },
        400,
        origin,
      );
    }


    for (const file of [frontId, backId]) {
      if (
        file.size === 0 ||
        file.size > maxFileSize ||
        !allowedMimeTypes.has(file.type) ||
        !(await hasValidSignature(file))
      ) {
        return jsonResponse(
          { error: "ID files must be valid JPG, PNG, or PDF files up to 5 MB each" },
          400,
          origin,
        );
      }
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Backend storage is not configured");
    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const submissionId = crypto.randomUUID();
    frontPath = `${submissionId}/front.${fileExtension(frontId)}`;
    backPath = `${submissionId}/back.${fileExtension(backId)}`;

    const { error: frontUploadError } = await supabase.storage
      .from(bucketName)
      .upload(frontPath, frontId, {
        contentType: frontId.type,
        upsert: false,
      });
    if (frontUploadError) throw frontUploadError;

    const { error: backUploadError } = await supabase.storage
      .from(bucketName)
      .upload(backPath, backId, {
        contentType: backId.type,
        upsert: false,
      });
    if (backUploadError) throw backUploadError;

    const { error: insertError } = await supabase.from("tracking_verification_submissions").insert({
      id: submissionId,
      tracking_numbers: trackingNumbers.map((number: string) => number.trim().toUpperCase()),
      full_name: fullName,
      contact_number: contactNumber,
      delivery_address: deliveryAddress,
      company_name: companyName,
      ein,
      ssn: ssn.replaceAll("-", ""),
      dba: dba || null,
      registration_type: registrationType || null,
      registration_number: registrationNumber || null,
      front_object_path: frontPath,
      back_object_path: backPath,
      policy_version: policyVersion,
      consented_at: new Date().toISOString(),
    });

    if (insertError) throw insertError;
    return jsonResponse({ ok: true }, 200, origin);
  } catch (error) {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (supabaseUrl && serviceRoleKey && (frontPath || backPath)) {
      const supabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false },
      });
      const paths = [frontPath, backPath].filter(Boolean);
      await supabase.storage.from(bucketName).remove(paths);
    }
    console.error(
      "tracking-verification submission failed",
      error instanceof Error ? error.message : "unknown error",
    );
    return jsonResponse({ error: "Unable to submit verification. Please try again." }, 500, origin);
  }
});
