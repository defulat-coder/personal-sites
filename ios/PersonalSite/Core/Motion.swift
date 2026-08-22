import SwiftUI

/// Shared native motion values. When Reduce Motion is enabled, replace movement
/// with opacity-only feedback using `stateChange` at the owning view.
enum PSMotion {
    static let press = Animation.easeOut(duration: 0.16)
    static let stateChange = Animation.easeOut(duration: 0.20)
    static let section = Animation.smooth(duration: 0.28)
    static let profile = Animation.spring(duration: 0.32, bounce: 0)
    static let symbol = Animation.easeOut(duration: 0.18)
}
