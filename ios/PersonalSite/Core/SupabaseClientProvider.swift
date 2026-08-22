import Supabase

/// 公开投影只读客户端：仅 publishable key，站点侧三张公开表（RLS 放开 anon 读）都走它。
enum SupabaseClientProvider {
    static let shared = SupabaseClient(
        supabaseURL: Config.supabaseURL,
        supabaseKey: Config.supabasePublishableKey
    )
}
