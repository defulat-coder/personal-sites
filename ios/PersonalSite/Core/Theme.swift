import SwiftUI
import UIKit

/// 站点配色：对齐 globals.css 的 light/dark 两组变量。
extension Color {
    /// --ink：#1c1c1e / #f4f4f4
    static let psInk = Color(uiColor: UIColor { $0.userInterfaceStyle == .dark
        ? UIColor(red: 244/255, green: 244/255, blue: 244/255, alpha: 1)
        : UIColor(red: 28/255, green: 28/255, blue: 30/255, alpha: 1) })
    /// --quiet（meta 灰）：#767676 / #999
    static let psQuiet = Color(uiColor: UIColor { $0.userInterfaceStyle == .dark
        ? UIColor(red: 153/255, green: 153/255, blue: 153/255, alpha: 1)
        : UIColor(red: 118/255, green: 118/255, blue: 118/255, alpha: 1) })
    /// 链接灰：#6f6f72 / #b8b8bb
    static let psLink = Color(uiColor: UIColor { $0.userInterfaceStyle == .dark
        ? UIColor(red: 184/255, green: 184/255, blue: 187/255, alpha: 1)
        : UIColor(red: 111/255, green: 111/255, blue: 114/255, alpha: 1) })
    /// --line（hairline）：#eee / #333
    static let psLine = Color(uiColor: UIColor { $0.userInterfaceStyle == .dark
        ? UIColor(red: 51/255, green: 51/255, blue: 51/255, alpha: 1)
        : UIColor(red: 238/255, green: 238/255, blue: 238/255, alpha: 1) })
    /// --surface：#fff / #181818
    static let psSurface = Color(uiColor: UIColor { $0.userInterfaceStyle == .dark
        ? UIColor(red: 24/255, green: 24/255, blue: 24/255, alpha: 1)
        : .white })

    static let psBatteryRed = Color(red: 239/255, green: 68/255, blue: 68/255) // #ef4444
    static let psBatteryYellow = Color(red: 242/255, green: 201/255, blue: 76/255) // #f2c94c
    static let psBatteryGreen = Color(red: 36/255, green: 203/255, blue: 113/255) // #24cb71
    static let psBatteryStroke = Color(red: 22/255, green: 22/255, blue: 22/255) // #161616
}
