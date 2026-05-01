import Foundation

enum PptxBuilder {
    private static let slideWidth = 13.333
    private static let slideHeight = 7.5
    private static let emuPerInch = 914_400.0

    enum ColorToken {
        static let navy = "0D1B2A"
        static let blue = "007AFF"
        static let white = "FFFFFF"
        static let text = "1A2233"
        static let muted = "5F6B7A"
        static let border = "D0D6DC"
        static let light = "F4F6F9"
        static let softBlue = "EAF3FF"
        static let softGreen = "EAF8EF"
        static let softYellow = "FFF7D6"
    }

    private struct Paragraph {
        let text: String
        let fontSize: Int
        let color: String
        var bold = false
        var align = "l"
    }

    static func build(data: PptData) throws -> Data {
        let slides = data.slides.isEmpty
            ? [PptSlide(layout: .title, title: data.title, subtitle: nil, bullets: nil, left: nil, right: nil, highlight: nil, steps: nil, note: nil)]
            : data.slides

        var entries: [(name: String, data: Data)] = [
            ("[Content_Types].xml", xmlData(contentTypes(slideCount: slides.count))),
            ("_rels/.rels", xmlData(packageRelationships())),
            ("docProps/core.xml", xmlData(coreProperties(title: data.title))),
            ("docProps/app.xml", xmlData(appProperties(slideCount: slides.count))),
            ("ppt/presentation.xml", xmlData(presentation(slideCount: slides.count))),
            ("ppt/_rels/presentation.xml.rels", xmlData(presentationRelationships(slideCount: slides.count))),
            ("ppt/slideMasters/slideMaster1.xml", xmlData(slideMaster())),
            ("ppt/slideMasters/_rels/slideMaster1.xml.rels", xmlData(slideMasterRelationships())),
            ("ppt/slideLayouts/slideLayout1.xml", xmlData(slideLayout())),
            ("ppt/slideLayouts/_rels/slideLayout1.xml.rels", xmlData(slideLayoutRelationships())),
            ("ppt/theme/theme1.xml", xmlData(theme()))
        ]

        for (index, slide) in slides.enumerated() {
            entries.append(("ppt/slides/slide\(index + 1).xml", xmlData(slideXml(slide))))
            entries.append(("ppt/slides/_rels/slide\(index + 1).xml.rels", xmlData(slideRelationships())))
        }

        return ZipArchiveWriter.archive(entries: entries)
    }

    private static func slideXml(_ slide: PptSlide) -> String {
        var shapeId = 2
        var shapes = rectShape(
            id: nextId(&shapeId),
            name: "Background",
            x: 0,
            y: 0,
            w: slideWidth,
            h: slideHeight,
            fill: ColorToken.light,
            line: nil
        )

        switch slide.layout {
        case .title:
            shapes += titleSlide(slide, shapeId: &shapeId)
        case .section:
            shapes += sectionSlide(slide, shapeId: &shapeId)
        case .content:
            shapes += contentSlide(slide, shapeId: &shapeId)
        case .two_column:
            shapes += twoColumnSlide(slide, shapeId: &shapeId)
        case .highlight:
            shapes += highlightSlide(slide, shapeId: &shapeId)
        case .timeline:
            shapes += timelineSlide(slide, shapeId: &shapeId)
        }

        return """
        <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
          <p:cSld>
            <p:spTree>
              \(groupShape())
              \(shapes)
            </p:spTree>
          </p:cSld>
          <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
        </p:sld>
        """
    }

    private static func titleSlide(_ slide: PptSlide, shapeId: inout Int) -> String {
        var xml = rectShape(id: nextId(&shapeId), name: "Title Base", x: 0, y: 0, w: slideWidth, h: slideHeight, fill: ColorToken.navy, line: nil)
        xml += rectShape(id: nextId(&shapeId), name: "Blue Wash", x: 0, y: 0, w: slideWidth, h: slideHeight, fill: ColorToken.blue, fillOpacity: 0.28, line: nil)
        xml += rectShape(id: nextId(&shapeId), name: "Footer Accent", x: 0, y: slideHeight - 0.18, w: slideWidth, h: 0.18, fill: ColorToken.blue, line: nil)
        xml += textShape(
            id: nextId(&shapeId),
            name: "Title",
            x: 1.2,
            y: 2.25,
            w: slideWidth - 2.4,
            h: 1.55,
            paragraphs: [Paragraph(text: slide.title, fontSize: 42, color: ColorToken.white, bold: true, align: "ctr")],
            anchor: "ctr"
        )
        if let subtitle = slide.subtitle {
            xml += textShape(
                id: nextId(&shapeId),
                name: "Subtitle",
                x: 1.35,
                y: 4.05,
                w: slideWidth - 2.7,
                h: 0.8,
                paragraphs: [Paragraph(text: subtitle, fontSize: 20, color: "AACCFF", align: "ctr")],
                anchor: "ctr"
            )
        }
        return xml
    }

    private static func sectionSlide(_ slide: PptSlide, shapeId: inout Int) -> String {
        var xml = rectShape(id: nextId(&shapeId), name: "Section Background", x: 0, y: 0, w: slideWidth, h: slideHeight, fill: ColorToken.blue, line: nil)
        xml += rectShape(id: nextId(&shapeId), name: "Section Rule", x: 0, y: 0, w: 0.12, h: slideHeight, fill: ColorToken.white, fillOpacity: 0.6, line: nil)
        xml += textShape(
            id: nextId(&shapeId),
            name: "Section Title",
            x: 0.8,
            y: 2.55,
            w: slideWidth - 1.6,
            h: 1.35,
            paragraphs: [Paragraph(text: slide.title, fontSize: 36, color: ColorToken.white, bold: true, align: "ctr")],
            anchor: "ctr"
        )
        if let subtitle = slide.subtitle {
            xml += textShape(
                id: nextId(&shapeId),
                name: "Section Subtitle",
                x: 0.8,
                y: 4.1,
                w: slideWidth - 1.6,
                h: 0.75,
                paragraphs: [Paragraph(text: subtitle, fontSize: 18, color: "DDEEFF", align: "ctr")],
                anchor: "ctr"
            )
        }
        return xml
    }

    private static func contentSlide(_ slide: PptSlide, shapeId: inout Int) -> String {
        var xml = header(title: slide.title, shapeId: &shapeId)
        let bullets = slide.bullets ?? []
        xml += bulletTextBox(
            id: nextId(&shapeId),
            name: "Content",
            items: bullets,
            x: 0.75,
            y: 1.55,
            w: slideWidth - 1.5,
            h: slideHeight - 2.0,
            fontSize: 19
        )
        return xml
    }

    private static func twoColumnSlide(_ slide: PptSlide, shapeId: inout Int) -> String {
        var xml = header(title: slide.title, shapeId: &shapeId)
        xml += rectShape(id: nextId(&shapeId), name: "Column Divider", x: slideWidth / 2, y: 1.5, w: 0.012, h: slideHeight - 1.9, fill: ColorToken.border, line: nil)
        xml += bulletTextBox(id: nextId(&shapeId), name: "Left Column", items: slide.left ?? [], x: 0.55, y: 1.58, w: slideWidth / 2 - 0.9, h: slideHeight - 2.05, fontSize: 18)
        xml += bulletTextBox(id: nextId(&shapeId), name: "Right Column", items: slide.right ?? [], x: slideWidth / 2 + 0.35, y: 1.58, w: slideWidth / 2 - 0.9, h: slideHeight - 2.05, fontSize: 18)
        return xml
    }

    private static func highlightSlide(_ slide: PptSlide, shapeId: inout Int) -> String {
        var xml = header(title: slide.title, shapeId: &shapeId)
        xml += rectShape(id: nextId(&shapeId), name: "Highlight Panel", x: 0.75, y: 1.75, w: slideWidth - 1.5, h: 2.3, fill: ColorToken.softBlue, line: ColorToken.blue, lineOpacity: 0.25)
        xml += textShape(
            id: nextId(&shapeId),
            name: "Highlight",
            x: 1.1,
            y: 2.16,
            w: slideWidth - 2.2,
            h: 1.25,
            paragraphs: [Paragraph(text: slide.highlight ?? slide.subtitle ?? "核心结论", fontSize: 28, color: ColorToken.navy, bold: true, align: "ctr")],
            anchor: "ctr"
        )
        xml += bulletTextBox(id: nextId(&shapeId), name: "Highlight Bullets", items: Array((slide.bullets ?? []).prefix(3)), x: 1.0, y: 4.45, w: slideWidth - 2.0, h: 1.8, fontSize: 17)
        return xml
    }

    private static func timelineSlide(_ slide: PptSlide, shapeId: inout Int) -> String {
        var xml = header(title: slide.title, shapeId: &shapeId)
        let steps = Array((slide.steps ?? []).prefix(4))

        guard steps.count >= 2 else {
            xml += bulletTextBox(id: nextId(&shapeId), name: "Timeline Fallback", items: slide.bullets ?? steps, x: 0.8, y: 1.7, w: slideWidth - 1.6, h: slideHeight - 2.1, fontSize: 18)
            return xml
        }

        let startX = 1.25
        let endX = slideWidth - 1.25
        let lineY = 2.75
        let gap = (endX - startX) / Double(steps.count - 1)

        xml += rectShape(id: nextId(&shapeId), name: "Timeline Rule", x: startX, y: lineY - 0.015, w: endX - startX, h: 0.03, fill: ColorToken.border, line: nil)

        for (index, step) in steps.enumerated() {
            let centerX = startX + gap * Double(index)
            xml += rectShape(id: nextId(&shapeId), name: "Timeline Dot \(index + 1)", x: centerX - 0.22, y: lineY - 0.22, w: 0.44, h: 0.44, fill: ColorToken.blue, line: ColorToken.white, shape: "ellipse")
            xml += textShape(
                id: nextId(&shapeId),
                name: "Timeline Number \(index + 1)",
                x: centerX - 0.18,
                y: lineY - 0.16,
                w: 0.36,
                h: 0.28,
                paragraphs: [Paragraph(text: "\(index + 1)", fontSize: 11, color: ColorToken.white, bold: true, align: "ctr")],
                anchor: "ctr"
            )
            xml += rectShape(id: nextId(&shapeId), name: "Timeline Card \(index + 1)", x: centerX - 1.15, y: lineY + 0.4, w: 2.3, h: 1.45, fill: index.isMultiple(of: 2) ? ColorToken.softBlue : ColorToken.softGreen, line: ColorToken.border, lineOpacity: 0.35)
            xml += textShape(
                id: nextId(&shapeId),
                name: "Timeline Step \(index + 1)",
                x: centerX - 0.96,
                y: lineY + 0.66,
                w: 1.92,
                h: 0.92,
                paragraphs: [Paragraph(text: step, fontSize: 15, color: ColorToken.text, bold: true, align: "ctr")],
                anchor: "ctr"
            )
        }

        if let note = slide.note {
            xml += textShape(
                id: nextId(&shapeId),
                name: "Timeline Note",
                x: 0.95,
                y: 5.45,
                w: slideWidth - 1.9,
                h: 0.7,
                paragraphs: [Paragraph(text: note, fontSize: 15, color: ColorToken.text, align: "ctr")],
                anchor: "ctr"
            )
        }

        return xml
    }

    private static func header(title: String, shapeId: inout Int) -> String {
        var xml = rectShape(id: nextId(&shapeId), name: "Header", x: 0, y: 0, w: slideWidth, h: 1.25, fill: ColorToken.navy, line: nil)
        xml += rectShape(id: nextId(&shapeId), name: "Header Accent", x: 0, y: 1.25, w: slideWidth, h: 0.06, fill: ColorToken.blue, line: nil)
        xml += textShape(
            id: nextId(&shapeId),
            name: "Header Title",
            x: 0.5,
            y: 0.18,
            w: slideWidth - 1.0,
            h: 0.9,
            paragraphs: [Paragraph(text: title, fontSize: 26, color: ColorToken.white, bold: true)],
            anchor: "ctr"
        )
        return xml
    }

    private static func bulletTextBox(id: Int, name: String, items: [String], x: Double, y: Double, w: Double, h: Double, fontSize: Int) -> String {
        let paragraphs = items.isEmpty
            ? [Paragraph(text: "暂无内容", fontSize: fontSize, color: ColorToken.muted)]
            : items.map { Paragraph(text: "• \($0)", fontSize: fontSize, color: ColorToken.text) }
        return textShape(id: id, name: name, x: x, y: y, w: w, h: h, paragraphs: paragraphs)
    }

    private static func rectShape(
        id: Int,
        name: String,
        x: Double,
        y: Double,
        w: Double,
        h: Double,
        fill: String,
        fillOpacity: Double = 1,
        line: String?,
        lineOpacity: Double = 1,
        shape: String = "rect"
    ) -> String {
        """
        <p:sp>
          <p:nvSpPr><p:cNvPr id="\(id)" name="\(xmlEscape(name))"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
          <p:spPr>
            \(transform(x: x, y: y, w: w, h: h))
            <a:prstGeom prst="\(shape)"><a:avLst/></a:prstGeom>
            \(solidFill(color: fill, opacity: fillOpacity))
            \(lineXml(color: line, opacity: lineOpacity))
          </p:spPr>
        </p:sp>
        """
    }

    private static func textShape(
        id: Int,
        name: String,
        x: Double,
        y: Double,
        w: Double,
        h: Double,
        paragraphs: [Paragraph],
        fill: String? = nil,
        anchor: String = "t"
    ) -> String {
        let fillXml = fill.map { solidFill(color: $0) } ?? "<a:noFill/>"
        let paragraphXml = paragraphs.map(paragraph).joined(separator: "\n")
        return """
        <p:sp>
          <p:nvSpPr><p:cNvPr id="\(id)" name="\(xmlEscape(name))"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
          <p:spPr>
            \(transform(x: x, y: y, w: w, h: h))
            <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
            \(fillXml)
            <a:ln><a:noFill/></a:ln>
          </p:spPr>
          <p:txBody>
            <a:bodyPr wrap="square" anchor="\(anchor)"><a:spAutoFit/></a:bodyPr>
            <a:lstStyle/>
            \(paragraphXml)
          </p:txBody>
        </p:sp>
        """
    }

    private static func paragraph(_ paragraph: Paragraph) -> String {
        let bold = paragraph.bold ? #" b="1""# : ""
        return """
        <a:p>
          <a:pPr algn="\(paragraph.align)"/>
          <a:r>
            <a:rPr lang="zh-CN" sz="\(paragraph.fontSize * 100)"\(bold) dirty="0">
              \(solidFill(color: paragraph.color))
              <a:latin typeface="Aptos"/>
              <a:ea typeface="PingFang SC"/>
            </a:rPr>
            <a:t>\(xmlEscape(paragraph.text))</a:t>
          </a:r>
          <a:endParaRPr lang="zh-CN" sz="\(paragraph.fontSize * 100)" dirty="0"/>
        </a:p>
        """
    }

    private static func transform(x: Double, y: Double, w: Double, h: Double) -> String {
        """
        <a:xfrm>
          <a:off x="\(emu(x))" y="\(emu(y))"/>
          <a:ext cx="\(emu(w))" cy="\(emu(h))"/>
        </a:xfrm>
        """
    }

    private static func lineXml(color: String?, opacity: Double = 1) -> String {
        guard let color else { return "<a:ln><a:noFill/></a:ln>" }
        return """
        <a:ln w="12700">
          \(solidFill(color: color, opacity: opacity))
        </a:ln>
        """
    }

    static func solidFill(color: String, opacity: Double = 1) -> String {
        let normalizedOpacity = max(0, min(1, opacity))
        if normalizedOpacity >= 0.999 {
            return """
            <a:solidFill><a:srgbClr val="\(color)"/></a:solidFill>
            """
        }
        return """
        <a:solidFill><a:srgbClr val="\(color)"><a:alpha val="\(Int(normalizedOpacity * 100000))"/></a:srgbClr></a:solidFill>
        """
    }

    private static func nextId(_ shapeId: inout Int) -> Int {
        defer { shapeId += 1 }
        return shapeId
    }

    private static func emu(_ inches: Double) -> Int {
        Int((inches * emuPerInch).rounded())
    }

    static func xmlEscape(_ value: String) -> String {
        value
            .replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;")
            .replacingOccurrences(of: "\"", with: "&quot;")
            .replacingOccurrences(of: "'", with: "&apos;")
    }

    static func xmlData(_ xml: String) -> Data {
        Data(xml.utf8)
    }
}
