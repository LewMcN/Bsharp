import { supabase } from "./supabase";

/* Social layer client: feed, posts, likes, profile. All functions assume
   supabase is configured; callers guard with isConfigured. */

export async function fetchFeed() {
  const { data, error } = await supabase
    .from("posts")
    .select("id, caption, media_url, media_type, created_at, user_id, profiles(username, display_name, avatar_url, instagram), likes(user_id)")
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) throw error;
  return data || [];
}

export async function createPost(userId, file, caption) {
  const isVideo = file.type.startsWith("video/");
  if (!isVideo && !file.type.startsWith("image/")) throw new Error("Pick an image or a video");
  if (file.size > 25 * 1024 * 1024) throw new Error("Max file size is 25 MB");
  const ext = (file.name.split(".").pop() || (isVideo ? "mp4" : "jpg")).toLowerCase();
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage.from("media").upload(path, file, {
    cacheControl: "31536000",
    contentType: file.type,
  });
  if (upErr) throw upErr;
  const { data: pub } = supabase.storage.from("media").getPublicUrl(path);
  const { error } = await supabase.from("posts").insert({
    user_id: userId,
    caption: caption.trim(),
    media_url: pub.publicUrl,
    media_type: isVideo ? "video" : "image",
  });
  if (error) throw error;
}

export async function deletePost(post) {
  // remove the storage object too (path = everything after /media/)
  try {
    const idx = post.media_url.indexOf("/media/");
    if (idx >= 0) await supabase.storage.from("media").remove([post.media_url.slice(idx + 7)]);
  } catch (e) {}
  const { error } = await supabase.from("posts").delete().eq("id", post.id);
  if (error) throw error;
}

export async function toggleLike(postId, userId, liked) {
  if (liked) {
    const { error } = await supabase.from("likes").delete()
      .eq("post_id", postId).eq("user_id", userId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("likes").insert({ post_id: postId, user_id: userId });
    if (error) throw error;
  }
}

export async function updateProfile(userId, { display_name, instagram }) {
  const { error } = await supabase.from("profiles")
    .update({ display_name: display_name || null, instagram: instagram || null })
    .eq("id", userId);
  if (error) throw error;
}

export async function uploadAvatar(userId, file) {
  if (!file.type.startsWith("image/")) throw new Error("Avatar must be an image");
  if (file.size > 5 * 1024 * 1024) throw new Error("Max avatar size is 5 MB");
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${userId}/avatar-${Date.now()}.${ext}`;
  const { error: upErr } = await supabase.storage.from("media").upload(path, file, {
    cacheControl: "31536000", contentType: file.type,
  });
  if (upErr) throw upErr;
  const { data: pub } = supabase.storage.from("media").getPublicUrl(path);
  const { error } = await supabase.from("profiles")
    .update({ avatar_url: pub.publicUrl }).eq("id", userId);
  if (error) throw error;
  return pub.publicUrl;
}

export const timeAgo = (iso) => {
  const s = Math.max(1, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}d`;
  return new Date(iso).toLocaleDateString();
};

export const igUrl = (handle) =>
  handle ? `https://instagram.com/${handle.replace(/^@/, "").trim()}` : null;
