// Renders the "Claude is finished working" notification as images for the
// README and for sharing. Usage:
//   swift scripts/make-notification-image.swift <out-dir>
// Writes notification.png (banner only, transparent) and
// notification-social.png (1200x627, for LinkedIn and other posts).
import AppKit

let outDir = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "."
let here = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
let icon = NSImage(contentsOf: here.appendingPathComponent("../helper/icon.png"))!

func rgb(_ r: CGFloat, _ g: CGFloat, _ b: CGFloat, _ a: CGFloat = 1) -> NSColor {
    NSColor(srgbRed: r / 255, green: g / 255, blue: b / 255, alpha: a)
}

// Draws at 2x pixel density; all coordinates below are in points.
func render(width: CGFloat, height: CGFloat, to name: String, _ draw: (CGContext) -> Void) {
    let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: Int(width * 2), pixelsHigh: Int(height * 2),
                               bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
                               colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
    rep.size = NSSize(width: width, height: height)
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
    draw(NSGraphicsContext.current!.cgContext)
    NSGraphicsContext.restoreGraphicsState()
    let url = URL(fileURLWithPath: outDir).appendingPathComponent(name)
    try! rep.representation(using: .png, properties: [:])!.write(to: url)
    print("wrote \(url.path)")
}

func text(_ s: String, size: CGFloat, weight: NSFont.Weight, color: NSColor) -> NSAttributedString {
    NSAttributedString(string: s, attributes: [
        .font: NSFont.systemFont(ofSize: size, weight: weight),
        .foregroundColor: color,
    ])
}

// The macOS notification banner, bottom-left corner at `o`, `s` = scale.
let bannerW: CGFloat = 400, bannerH: CGFloat = 76
func drawBanner(_ ctx: CGContext, at o: CGPoint, scale s: CGFloat) {
    let rect = CGRect(x: o.x, y: o.y, width: bannerW * s, height: bannerH * s)
    let shape = NSBezierPath(roundedRect: rect, xRadius: 20 * s, yRadius: 20 * s)

    ctx.saveGState()
    ctx.setShadow(offset: CGSize(width: 0, height: -6 * s), blur: 24 * s,
                  color: NSColor.black.withAlphaComponent(0.35).cgColor)
    rgb(44, 44, 46).setFill()
    shape.fill()
    ctx.restoreGState()
    rgb(255, 255, 255, 0.12).setStroke()
    shape.lineWidth = 1 * s
    shape.stroke()

    // App icon (the PNG has a 10% transparent margin, so draw it a bit larger).
    let iconSize = 52 * s
    icon.draw(in: CGRect(x: o.x + 10 * s, y: o.y + (bannerH * s - iconSize) / 2, width: iconSize, height: iconSize))

    let textX = o.x + 70 * s
    text("Claude is finished working", size: 15 * s, weight: .semibold, color: .white)
        .draw(at: CGPoint(x: textX, y: o.y + 39 * s))
    text("Back to work, for real this time.", size: 14 * s, weight: .regular, color: rgb(255, 255, 255, 0.82))
        .draw(at: CGPoint(x: textX, y: o.y + 18 * s))

    // Close button, overlapping the top-left corner.
    let c = CGPoint(x: o.x + 4 * s, y: o.y + bannerH * s - 4 * s)
    let r = 11 * s
    let circle = NSBezierPath(ovalIn: CGRect(x: c.x - r, y: c.y - r, width: r * 2, height: r * 2))
    rgb(66, 66, 69).setFill()
    circle.fill()
    rgb(255, 255, 255, 0.15).setStroke()
    circle.lineWidth = 1 * s
    circle.stroke()
    let x = NSBezierPath()
    let k = 4 * s
    x.move(to: CGPoint(x: c.x - k, y: c.y - k)); x.line(to: CGPoint(x: c.x + k, y: c.y + k))
    x.move(to: CGPoint(x: c.x - k, y: c.y + k)); x.line(to: CGPoint(x: c.x + k, y: c.y - k))
    x.lineWidth = 1.6 * s
    x.lineCapStyle = .round
    rgb(255, 255, 255, 0.7).setStroke()
    x.stroke()
}

// 1. README: just the banner, transparent around it (works in light and dark mode).
let pad: CGFloat = 28
render(width: bannerW + pad * 2, height: bannerH + pad * 2, to: "notification.png") { ctx in
    drawBanner(ctx, at: CGPoint(x: pad, y: pad), scale: 1)
}

// 2. Social: 1200x627 card with the banner and a caption.
render(width: 1200, height: 627, to: "notification-social.png") { ctx in
    let space = CGColorSpace(name: CGColorSpace.sRGB)!
    let bg = CGGradient(colorsSpace: space, colors: [rgb(30, 34, 44).cgColor, rgb(14, 16, 21).cgColor] as CFArray,
                        locations: [0, 1])!
    ctx.drawLinearGradient(bg, start: CGPoint(x: 0, y: 627), end: CGPoint(x: 0, y: 0), options: [])
    let glow = CGGradient(colorsSpace: space, colors: [rgb(52, 199, 89, 0.22).cgColor, rgb(52, 199, 89, 0).cgColor] as CFArray,
                          locations: [0, 1])!
    ctx.drawRadialGradient(glow, startCenter: CGPoint(x: 600, y: 400), startRadius: 0,
                           endCenter: CGPoint(x: 600, y: 400), endRadius: 420, options: [])

    let s: CGFloat = 1.75
    drawBanner(ctx, at: CGPoint(x: 600 - bannerW * s / 2, y: 330), scale: s)

    func centered(_ a: NSAttributedString, y: CGFloat) {
        a.draw(at: CGPoint(x: 600 - a.size().width / 2, y: y))
    }
    centered(text("Artificially Industrious", size: 44, weight: .bold, color: .white), y: 200)
    centered(text("Keeps your Teams and Slack status Available while your AI is still working.",
                  size: 22, weight: .regular, color: rgb(255, 255, 255, 0.72)), y: 150)
    centered(text("github.com/Izkumberdu/artificially-industrious",
                  size: 18, weight: .medium, color: rgb(52, 199, 89)), y: 80)
}
