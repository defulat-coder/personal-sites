package com.personalsite.core

import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.postgrest.Postgrest
import io.ktor.client.engine.okhttp.OkHttp

/**
 * 公开投影只读客户端：仅 publishable key，站点侧三张公开表（RLS 放开 anon 读）都走它。
 */
object SupabaseClientProvider {
    val shared by lazy {
        createSupabaseClient(
            supabaseUrl = Config.supabaseUrl,
            supabaseKey = Config.supabasePublishableKey,
        ) {
            install(Postgrest)
            httpEngine = OkHttp.create()
        }
    }
}
