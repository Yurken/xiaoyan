extension PptxBuilder {
    static func slideMasterRelationships() -> String {
        """
        <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
          <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
          <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>
        </Relationships>
        """
    }

    static func slideLayoutRelationships() -> String {
        """
        <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
          <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
        </Relationships>
        """
    }

    static func slideMaster() -> String {
        """
        <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
          <p:cSld>
            <p:bg><p:bgPr>\(solidFill(color: ColorToken.light))<a:effectLst/></p:bgPr></p:bg>
            <p:spTree>
              \(groupShape())
            </p:spTree>
          </p:cSld>
          <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
          <p:sldLayoutIdLst>
            <p:sldLayoutId id="2147483649" r:id="rId1"/>
          </p:sldLayoutIdLst>
          <p:txStyles>
            <p:titleStyle><a:lvl1pPr><a:defRPr sz="4400"/></a:lvl1pPr></p:titleStyle>
            <p:bodyStyle><a:lvl1pPr><a:defRPr sz="2400"/></a:lvl1pPr></p:bodyStyle>
            <p:otherStyle><a:lvl1pPr><a:defRPr sz="1800"/></a:lvl1pPr></p:otherStyle>
          </p:txStyles>
        </p:sldMaster>
        """
    }

    static func slideLayout() -> String {
        """
        <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1">
          <p:cSld name="Blank">
            <p:spTree>
              \(groupShape())
            </p:spTree>
          </p:cSld>
          <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
        </p:sldLayout>
        """
    }

    static func theme() -> String {
        """
        <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="XiaoYan">
          <a:themeElements>
            <a:clrScheme name="XiaoYan">
              <a:dk1><a:srgbClr val="\(ColorToken.navy)"/></a:dk1>
              <a:lt1><a:srgbClr val="\(ColorToken.white)"/></a:lt1>
              <a:dk2><a:srgbClr val="\(ColorToken.text)"/></a:dk2>
              <a:lt2><a:srgbClr val="\(ColorToken.light)"/></a:lt2>
              <a:accent1><a:srgbClr val="\(ColorToken.blue)"/></a:accent1>
              <a:accent2><a:srgbClr val="\(ColorToken.softGreen)"/></a:accent2>
              <a:accent3><a:srgbClr val="\(ColorToken.softYellow)"/></a:accent3>
              <a:accent4><a:srgbClr val="\(ColorToken.border)"/></a:accent4>
              <a:accent5><a:srgbClr val="7A8A9A"/></a:accent5>
              <a:accent6><a:srgbClr val="AACCFF"/></a:accent6>
              <a:hlink><a:srgbClr val="\(ColorToken.blue)"/></a:hlink>
              <a:folHlink><a:srgbClr val="7A8A9A"/></a:folHlink>
            </a:clrScheme>
            <a:fontScheme name="XiaoYan">
              <a:majorFont>
                <a:latin typeface="Aptos Display"/>
                <a:ea typeface="PingFang SC"/>
                <a:cs typeface=""/>
              </a:majorFont>
              <a:minorFont>
                <a:latin typeface="Aptos"/>
                <a:ea typeface="PingFang SC"/>
                <a:cs typeface=""/>
              </a:minorFont>
            </a:fontScheme>
            <a:fmtScheme name="XiaoYan">
              <a:fillStyleLst>
                \(solidFill(color: ColorToken.white))
                \(solidFill(color: ColorToken.light))
                \(solidFill(color: ColorToken.softBlue))
              </a:fillStyleLst>
              <a:lnStyleLst>
                <a:ln w="12700" cap="flat" cmpd="sng" algn="ctr">\(solidFill(color: ColorToken.border))</a:ln>
                <a:ln w="19050" cap="flat" cmpd="sng" algn="ctr">\(solidFill(color: ColorToken.blue))</a:ln>
                <a:ln w="25400" cap="flat" cmpd="sng" algn="ctr">\(solidFill(color: ColorToken.navy))</a:ln>
              </a:lnStyleLst>
              <a:effectStyleLst>
                <a:effectStyle><a:effectLst/></a:effectStyle>
                <a:effectStyle><a:effectLst/></a:effectStyle>
                <a:effectStyle><a:effectLst/></a:effectStyle>
              </a:effectStyleLst>
              <a:bgFillStyleLst>
                \(solidFill(color: ColorToken.light))
                \(solidFill(color: ColorToken.white))
                \(solidFill(color: ColorToken.navy))
              </a:bgFillStyleLst>
            </a:fmtScheme>
          </a:themeElements>
          <a:objectDefaults/>
          <a:extraClrSchemeLst/>
        </a:theme>
        """
    }
}
