/* Seed test users, profiles and friendships for the Social tab.
 *
 * Run LOCALLY only — needs the service-role (secret) key, which must
 * never be committed or shipped to the client:
 *
 *   SUPABASE_URL=https://<ref>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=sb_secret_... \
 *   FRIEND_EMAIL=you@example.com \
 *   node scripts/seed-social.mjs
 *
 * FRIEND_EMAIL (optional): your real account's email — test users will
 * send you requests / be your friends so the tab has content instantly.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.");
  process.exit(1);
}
const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

const USERS = [
  ["srv_lenny",    "Stevie Tester"],
  ["bb_boxone",    "Bea Bender"],
  ["pent_a_tonic", "Penny Tonic"],
  ["dorian_gray",  "Dorian Grey"],
  ["twelve_barry", "Barry Zwölf"],
  ["capo_verde",   "Cap O'Verde"],
  ["shred_ward",   "Ed Shredward"],
  ["luthier_lu",   "Lu Thier"],
];
const PASSWORD = "bsharp-test-1234";
const hoursAgo = (h) => new Date(Date.now() - h * 3600 * 1000).toISOString();

async function main() {
  const ids = {};
  for (const [username, display] of USERS) {
    const email = `${username}@bsharp.test`;
    const { data, error } = await admin.auth.admin.createUser({
      email, password: PASSWORD, email_confirm: true,
      user_metadata: { username },
    });
    if (error) {
      if (/already/i.test(error.message)) {
        const { data: list } = await admin.auth.admin.listUsers({ perPage: 200 });
        const u = list?.users?.find((x) => x.email === email);
        if (u) { ids[username] = u.id; console.log("exists:", username); continue; }
      }
      console.error("createUser failed:", username, error.message);
      continue;
    }
    ids[username] = data.user.id;
    console.log("created:", username);
  }

  // profile polish: display names + staggered last-seen times
  const seen = [0.01, 0.2, 1, 3, 9, 26, 30, 80];
  let i = 0;
  for (const [username, display] of USERS) {
    if (!ids[username]) continue;
    await admin.from("profiles").update({
      display_name: display,
      last_active_at: hoursAgo(seen[i++ % seen.length]),
    }).eq("id", ids[username]);
  }

  // friendships among the test users, mixed states
  const pairs = [
    ["srv_lenny", "bb_boxone", "accepted"],
    ["srv_lenny", "pent_a_tonic", "accepted"],
    ["dorian_gray", "srv_lenny", "pending"],
    ["twelve_barry", "capo_verde", "accepted"],
    ["shred_ward", "luthier_lu", "pending"],
  ];
  for (const [a, b, status] of pairs) {
    if (!ids[a] || !ids[b]) continue;
    const { error } = await admin.from("friendships")
      .insert({ requester_id: ids[a], addressee_id: ids[b], status });
    if (error && !/duplicate|unique/i.test(error.message)) console.error("friendship:", a, b, error.message);
  }

  // hook the real account in so the tab has content immediately
  const friendEmail = process.env.FRIEND_EMAIL;
  if (friendEmail) {
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 200 });
    const me = list?.users?.find((x) => x.email === friendEmail);
    if (!me) console.log(`FRIEND_EMAIL ${friendEmail} not found — sign up first, then re-run.`);
    else {
      const mine = [
        ["srv_lenny", "accepted"], ["bb_boxone", "accepted"], ["pent_a_tonic", "accepted"],
        ["dorian_gray", "pending"], ["shred_ward", "pending"],
      ];
      for (const [u, status] of mine) {
        if (!ids[u]) continue;
        const { error } = await admin.from("friendships")
          .insert({ requester_id: ids[u], addressee_id: me.id, status });
        if (error && !/duplicate|unique/i.test(error.message)) console.error("link:", u, error.message);
      }
      console.log("linked test users to", friendEmail, "(3 friends + 2 incoming requests)");
    }
  }

  console.log("\nDone. Test users sign in with password:", PASSWORD);
}

main();
