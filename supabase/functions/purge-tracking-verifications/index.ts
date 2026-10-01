import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const bucketName = "tracking-verifications";

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey)
    return new Response("Backend storage is not configured", { status: 500 });

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  let deletedCount = 0;
  while (true) {
    const { data: expired, error: selectError } = await supabase
      .from("tracking_verification_submissions")
      .select("id, front_object_path, back_object_path")
      .lte("expires_at", new Date().toISOString())
      .order("expires_at", { ascending: true })
      .limit(100);

    if (selectError) {
      console.error("Unable to find expired verification records", selectError.message);
      return new Response("Cleanup failed", { status: 500 });
    }

    if (!expired?.length) break;

    for (const submission of expired) {
      const { error: storageError } = await supabase.storage
        .from(bucketName)
        .remove([submission.front_object_path, submission.back_object_path]);
      if (storageError) {
        console.error(
          "Unable to remove expired verification files",
          submission.id,
          storageError.message,
        );
        return new Response("Cleanup failed", { status: 500 });
      }

      const { error: deleteError } = await supabase
        .from("tracking_verification_submissions")
        .delete()
        .eq("id", submission.id);
      if (deleteError) {
        console.error(
          "Unable to remove expired verification record",
          submission.id,
          deleteError.message,
        );
        return new Response("Cleanup failed", { status: 500 });
      }
      deletedCount += 1;
    }
  }

  return Response.json({ ok: true, deletedCount });
});
