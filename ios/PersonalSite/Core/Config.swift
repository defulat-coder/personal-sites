import Foundation

/// 运行所需的外部配置，经 Secrets.xcconfig → Info.plist 注入。
/// 缺失或未展开时直接 fatalError，启动即暴露配置问题。
enum Config {
    static let supabaseURL: URL = {
        let raw = requiredValue("SUPABASE_URL")
        guard let url = URL(string: raw) else {
            fatalError("配置 SUPABASE_URL 不是合法 URL：\(raw)")
        }
        return url
    }()

    static let supabasePublishableKey = requiredValue("SUPABASE_PUBLISHABLE_KEY")

    static let siteBaseURL: URL = {
        let raw = requiredValue("SITE_BASE_URL")
        guard let url = URL(string: raw) else {
            fatalError("配置 SITE_BASE_URL 不是合法 URL：\(raw)")
        }
        return url
    }()

    private static func requiredValue(_ key: String) -> String {
        guard let value = Bundle.main.object(forInfoDictionaryKey: key) as? String,
              !value.isEmpty,
              !value.hasPrefix("$(") else {
            fatalError("缺少配置 \(key)：请确认已按 Secrets.xcconfig.example 复制并填写 Secrets.xcconfig。")
        }
        return value
    }
}
