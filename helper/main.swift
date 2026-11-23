// Industrious Nudge: the only part of Artificially Industrious that holds
// macOS's Accessibility ("Device Control") permission. It can do exactly one
// thing — post a mouse-moved event to where the cursor already is — then quits.
//
// Launched by the keeper with `open -g -W <app> --args <mode> <status-file>`:
//   nudge   send one zero-distance mouse move (if permitted)
//   check   only report whether permission is granted
//   prompt  ask macOS for permission (shows the system dialog)
// The result is written as JSON to <status-file>, since `open` can't pass
// back an exit code.
import ApplicationServices
import Foundation

let args = CommandLine.arguments
let mode = args.count > 1 ? args[1] : "nudge"
let statusPath = args.count > 2 ? args[2] : nil

func isTrusted(prompt: Bool) -> Bool {
    let key = kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String
    return AXIsProcessTrustedWithOptions([key: prompt] as CFDictionary)
}

let trusted = isTrusted(prompt: mode == "prompt")
var nudged = false

if mode == "nudge" && trusted {
    let here = CGEvent(source: nil)?.location ?? .zero
    if let move = CGEvent(mouseEventSource: nil, mouseType: .mouseMoved,
                          mouseCursorPosition: here, mouseButton: .left) {
        move.post(tap: .cghidEventTap)
        nudged = true
    }
}

if let path = statusPath {
    let status: [String: Any] = [
        "trusted": trusted,
        "mode": mode,
        "nudged": nudged,
        "at": Int(Date().timeIntervalSince1970 * 1000),
    ]
    if let data = try? JSONSerialization.data(withJSONObject: status) {
        try? data.write(to: URL(fileURLWithPath: path))
    }
}

// Give macOS a moment to show its permission dialog before we exit.
if mode == "prompt" && !trusted {
    RunLoop.current.run(until: Date().addingTimeInterval(2))
}
