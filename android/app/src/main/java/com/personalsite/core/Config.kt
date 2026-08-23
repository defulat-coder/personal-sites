package com.personalsite.core

import com.personalsite.BuildConfig

/**
 * 运行所需的外部配置，经 local.properties → BuildConfig 注入。
 * 缺失时直接抛错，启动即暴露配置问题（对齐 iOS Config 的 fatalError）。
 */
object Config {
    val supabaseUrl: String by lazy { required("SUPABASE_URL", BuildConfig.SUPABASE_URL) }
    val supabasePublishableKey: String by lazy {
        required("SUPABASE_PUBLISHABLE_KEY", BuildConfig.SUPABASE_PUBLISHABLE_KEY)
    }
    val siteBaseUrl: String by lazy { required("SITE_BASE_URL", BuildConfig.SITE_BASE_URL) }

    private fun required(key: String, value: String): String {
        require(value.isNotBlank()) {
            "缺少配置 $key：请确认已按 local.properties.example 复制并填写 local.properties。"
        }
        return value.removeSuffix("/")
    }
}
