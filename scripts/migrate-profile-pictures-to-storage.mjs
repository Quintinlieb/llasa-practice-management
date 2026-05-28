import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucketName = process.env.PROFILE_PICTURES_BUCKET || "profile-pictures";
const shouldWrite = process.argv.includes("--write");

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const isDataUrl = (value) => /^data:image\/[a-z0-9.+-]+;base64,/i.test(String(value || "").trim());

const getExtensionFromDataUrl = (value) => {
  const match = String(value || "").match(/^data:image\/([a-z0-9.+-]+);base64,/i);
  const subtype = String(match?.[1] || "").toLowerCase();
  if (subtype === "jpeg") return "jpg";
  if (subtype === "svg+xml") return "svg";
  return subtype || "bin";
};

const decodeDataUrl = (value) => {
  const trimmed = String(value || "").trim();
  const commaIndex = trimmed.indexOf(",");
  if (commaIndex < 0) throw new Error("Invalid data URL.");
  return Buffer.from(trimmed.slice(commaIndex + 1), "base64");
};

const uploadLegacyProfilePicture = async (storagePath, dataUrl) => {
  const fileBuffer = decodeDataUrl(dataUrl);
  const mimeType = String(dataUrl).slice(5, String(dataUrl).indexOf(";")) || "image/png";
  const { error } = await supabase.storage.from(bucketName).upload(storagePath, fileBuffer, {
    upsert: true,
    contentType: mimeType,
  });
  if (error) throw error;
};

const migrateProfiles = async () => {
  const { data, error } = await supabase.from("profiles").select("id, profile_picture");
  if (error) throw error;

  const rows = Array.isArray(data) ? data : [];
  let migratedCount = 0;

  for (const row of rows) {
    const profilePicture = String(row?.profile_picture || "").trim();
    if (!isDataUrl(profilePicture)) continue;

    const storagePath = `users/${row.id}/legacy-${Date.now()}-${migratedCount}.${getExtensionFromDataUrl(profilePicture)}`;
    console.log(`[profiles] ${row.id} -> ${storagePath}`);

    if (!shouldWrite) continue;

    await uploadLegacyProfilePicture(storagePath, profilePicture);
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ profile_picture: storagePath })
      .eq("id", row.id);

    if (updateError) {
      await supabase.storage.from(bucketName).remove([storagePath]);
      throw updateError;
    }

    migratedCount += 1;
  }

  return { scanned: rows.length, migrated: migratedCount };
};

const migrateSubusers = async () => {
  const { data, error } = await supabase.from("subusers").select("id, auth_user_id, email, profile_picture");
  if (error) throw error;

  const rows = Array.isArray(data) ? data : [];
  let migratedCount = 0;

  for (const row of rows) {
    const profilePicture = String(row?.profile_picture || "").trim();
    if (!isDataUrl(profilePicture)) continue;

    const ownerKey = String(row?.auth_user_id || row?.id || row?.email || `subuser-${migratedCount}`).trim();
    const safeOwnerKey = ownerKey.replace(/[^a-zA-Z0-9_-]/g, "_");
    const storagePath = `subusers/${safeOwnerKey}/legacy-${Date.now()}-${migratedCount}.${getExtensionFromDataUrl(profilePicture)}`;
    console.log(`[subusers] ${row.id} -> ${storagePath}`);

    if (!shouldWrite) continue;

    await uploadLegacyProfilePicture(storagePath, profilePicture);
    const { error: updateError } = await supabase
      .from("subusers")
      .update({ profile_picture: storagePath })
      .eq("id", row.id);

    if (updateError) {
      await supabase.storage.from(bucketName).remove([storagePath]);
      throw updateError;
    }

    migratedCount += 1;
  }

  return { scanned: rows.length, migrated: migratedCount };
};

try {
  console.log(shouldWrite ? "Running live migration." : "Dry run only. Re-run with --write to apply changes.");

  const profileResult = await migrateProfiles();
  const subuserResult = await migrateSubusers();

  console.log("Done.");
  console.log(
    JSON.stringify(
      {
        profiles: profileResult,
        subusers: subuserResult,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error("Migration failed.");
  console.error(error);
  process.exit(1);
}
