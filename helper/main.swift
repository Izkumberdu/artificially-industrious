// Industrious Nudge: the only part of Artificially Industrious that holds
// macOS's Accessibility ("Device Control") permission. It does two small
// things and quits: post a mouse-moved event to where the cursor already is,
// and show the "<tool> is finished working" notification under its own name.
//
// Launched by the keeper with `open -g [-W] <app> --args <mode> <status-file> [title body]`:
//   nudge   send one zero-distance mouse move (if permitted)
//   check   only report whether Accessibility is granted
//   prompt  ask macOS for Accessibility and notification permission
//   notify  show a notification with <title> and <body>
// With no mode (e.g. you clicked one of its notifications) it just quits.
// The result is written as JSON to <status-file>, since `open` can't pass
// back an exit code.
import ApplicationServices
import Foundation
import UserNotifications

let args = CommandLine.arguments
let mode = args.count > 1 ? args[1] : "none"
let statusPath = args.count > 2 ? args[2] : nil

func isTrusted(prompt: Bool) -> Bool {
    let key = kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String
    return AXIsProcessTrustedWithOptions([key: prompt] as CFDictionary)
}

// Asks for notification permission (only prompts the first time), then posts.
// Waits so the process doesn't quit before macOS has taken the notification.
func notify(title: String?, body: String?, wait: TimeInterval) -> Bool {
    let center = UNUserNotificationCenter.current()
    let done = DispatchSemaphore(value: 0)
    var posted = false
    center.requestAuthorization(options: [.alert, .sound]) { granted, _ in
        guard granted, let title = title else { done.signal(); return }
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body ?? ""
        content.sound = .default
        let request = UNNotificationRequest(identifier: UUID().uuidString, content: content, trigger: nil)
        center.add(request) { error in
            posted = error == nil
            done.signal()
        }
    }
    _ = done.wait(timeout: .now() + wait)
    return posted
}

if mode == "none" { exit(0) }

var status: [String: Any] = ["mode": mode]

switch mode {
case "notify":
    let title = args.count > 3 ? args[3] : "Artificially Industrious"
    let body = args.count > 4 ? args[4] : nil
    status["notified"] = notify(title: title, body: body, wait: 10)
case "prompt":
    let trusted = isTrusted(prompt: true)
    status["trusted"] = trusted
    // nil title: only asks for notification permission, posts nothing.
    _ = notify(title: nil, body: nil, wait: 60)
    if !trusted { RunLoop.current.run(until: Date().addingTimeInterval(2)) }
default: // nudge, check
    let trusted = isTrusted(prompt: false)
    status["trusted"] = trusted
    var nudged = false
    if mode == "nudge" && trusted {
        let here = CGEvent(source: nil)?.location ?? .zero
        if let move = CGEvent(mouseEventSource: nil, mouseType: .mouseMoved,
                              mouseCursorPosition: here, mouseButton: .left) {
            move.post(tap: .cghidEventTap)
            nudged = true
        }
    }
    status["nudged"] = nudged
}

if let path = statusPath {
    status["at"] = Int(Date().timeIntervalSince1970 * 1000)
    if let data = try? JSONSerialization.data(withJSONObject: status) {
        try? data.write(to: URL(fileURLWithPath: path))
    }
}
