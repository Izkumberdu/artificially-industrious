// Draws the Industrious Nudge icon: a flat "available" green tile with a
// single white mouse pointer. Nothing else.
// Usage: swift scripts/make-icon.swift <out.png>   (1024x1024)
import AppKit

let size: CGFloat = 1024
let out = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "icon.png"

let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: Int(size), pixelsHigh: Int(size),
                           bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
                           colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
let ctx = NSGraphicsContext.current!.cgContext

// Tile on the macOS icon grid (824pt inside a 1024 canvas).
let tile = CGRect(x: 100, y: 100, width: 824, height: 824)
ctx.addPath(CGPath(roundedRect: tile, cornerWidth: 185, cornerHeight: 185, transform: nil))
ctx.setFillColor(CGColor(srgbRed: 52 / 255, green: 199 / 255, blue: 89 / 255, alpha: 1))
ctx.fillPath()

// Classic arrow pointer, drawn in a 12x19 unit box (y up), then centered.
let unit: [(CGFloat, CGFloat)] = [
    (0, 19), (0, 2.5), (4, 6.2), (6.6, 0), (9, 1), (6.5, 7.2), (12, 7.2),
]
let scale: CGFloat = 25
let boxW = 12 * scale, boxH = 19 * scale
let origin = CGPoint(x: 512 - boxW / 2 + 10, y: 512 - boxH / 2)
let pointer = CGMutablePath()
pointer.addLines(between: unit.map { CGPoint(x: origin.x + $0.0 * scale, y: origin.y + $0.1 * scale) })
pointer.closeSubpath()

ctx.addPath(pointer)
ctx.setFillColor(CGColor(srgbRed: 1, green: 1, blue: 1, alpha: 1))
ctx.fillPath()
// Round the corners slightly with a same-colour stroke.
ctx.addPath(pointer)
ctx.setStrokeColor(CGColor(srgbRed: 1, green: 1, blue: 1, alpha: 1))
ctx.setLineWidth(28)
ctx.setLineJoin(.round)
ctx.strokePath()

NSGraphicsContext.restoreGraphicsState()
try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: out))
print("wrote \(out)")
