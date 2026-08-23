package com.personalsite.features.support

/** 五个主 Tab（对齐 iOS AppTab）。 */
enum class AppTab(val label: String, val systemImage: String) {
    HOME("首页", "house"),
    AI_NEWS("动态", "clock"),
    FOLLOWING("关注", "bookmark"),
    WORKS("构建", "cube"),
    ASK("问一问", "bubble.left"),
}

/** 「关注」内部的两个模式（对齐 iOS FollowingMode）。 */
enum class FollowingMode(val label: String) {
    RECOMMENDATIONS("推荐"),
    OPEN_SOURCE("开源"),
}
