import SwiftUI

struct FriendLinkSection {
    let title: String
    let items: [FriendLinkItem]
}

struct FriendLinkItem {
    let name: String
    let href: String
    let icon: String?
}

let friendLinkSections: [FriendLinkSection] = [
    FriendLinkSection(title: "主流 AI 助手", items: [
        FriendLinkItem(name: "ChatGPT", href: "https://chatgpt.com/", icon: "/friend-link-icons/chatgpt.com.png"),
        FriendLinkItem(name: "Claude", href: "https://claude.ai/", icon: "/friend-link-icons/claude.ai.png"),
        FriendLinkItem(name: "Gemini", href: "https://gemini.google.com/", icon: "/friend-link-icons/gemini.google.com.png"),
        FriendLinkItem(name: "Microsoft AI 助手", href: "https://copilot.microsoft.com/", icon: "/friend-link-icons/copilot.microsoft.com.png"),
        FriendLinkItem(name: "Grok", href: "https://grok.com/", icon: "/friend-link-icons/grok.com.png"),
        FriendLinkItem(name: "豆包", href: "https://www.doubao.com/chat/", icon: "/friend-link-icons/doubao.png"),
        FriendLinkItem(name: "DeepSeek", href: "https://chat.deepseek.com/", icon: "/friend-link-icons/chat.deepseek.com.png"),
        FriendLinkItem(name: "Kimi", href: "https://kimi.moonshot.cn/", icon: "/friend-link-icons/kimi.moonshot.cn.png"),
        FriendLinkItem(name: "通义千问", href: "https://tongyi.aliyun.com/", icon: "/friend-link-icons/tongyi.aliyun.com.png"),
        FriendLinkItem(name: "文心一言", href: "https://yiyan.baidu.com/", icon: "/friend-link-icons/yiyan.baidu.com.png"),
        FriendLinkItem(name: "Perplexity", href: "https://www.perplexity.ai/", icon: "/friend-link-icons/perplexity.ai.png"),
    ]),
    FriendLinkSection(title: "AI 学术工具", items: [
        FriendLinkItem(name: "Semantic Scholar", href: "https://www.semanticscholar.org/", icon: "/friend-link-icons/semanticscholar.org.png"),
        FriendLinkItem(name: "Elicit", href: "https://elicit.com/", icon: "/friend-link-icons/elicit.com.png"),
        FriendLinkItem(name: "Consensus", href: "https://consensus.app/", icon: "/friend-link-icons/consensus.app.png"),
        FriendLinkItem(name: "Connected Papers", href: "https://www.connectedpapers.com/", icon: "/friend-link-icons/connectedpapers.com.png"),
        FriendLinkItem(name: "SciSpace", href: "https://typeset.io/", icon: "/friend-link-icons/typeset.io.png"),
        FriendLinkItem(name: "Scite", href: "https://scite.ai/", icon: "/friend-link-icons/scite.ai.png"),
        FriendLinkItem(name: "ResearchRabbit", href: "https://www.researchrabbit.ai/", icon: "/friend-link-icons/researchrabbit.ai.png"),
        FriendLinkItem(name: "PaSa 搜索", href: "https://pasa-agent.ai/", icon: "/friend-link-icons/img_6943996d426da.png"),
        FriendLinkItem(name: "Aminer", href: "https://www.aminer.cn/", icon: "/friend-link-icons/img_69437cd44272a.png"),
        FriendLinkItem(name: "磐石ScienceOne", href: "https://www.scienceone.cn/", icon: "/friend-link-icons/img_6943973de4c21.png"),
        FriendLinkItem(name: "CNKI AI", href: "https://ai.cnki.net/chat", icon: "/friend-link-icons/cnki.png"),
    ]),
    FriendLinkSection(title: "中文文献", items: [
        FriendLinkItem(name: "Pubscholar", href: "https://pubscholar.cn/", icon: "/friend-link-icons/img_694257ed8f29f.png"),
        FriendLinkItem(name: "知网", href: "https://www.cnki.net/", icon: "/friend-link-icons/zhiwang.png"),
        FriendLinkItem(name: "维普期刊", href: "https://qikan.cqvip.com/", icon: "/friend-link-icons/img_694258f541da1.png"),
        FriendLinkItem(name: "万方数据", href: "https://www.wanfangdata.com.cn/index.html", icon: "/friend-link-icons/img_6942581ebb3c4.png"),
        FriendLinkItem(name: "科学文库", href: "https://book.sciencereading.cn/shop/main/Login/shopFrame.do", icon: "/friend-link-icons/img_6942590b5cd11.png"),
        FriendLinkItem(name: "ChinaXiv", href: "https://chinaxiv.org/home.htm", icon: "/friend-link-icons/img_6942591cb244d.png"),
        FriendLinkItem(name: "超星期刊", href: "https://qikan.chaoxing.com/", icon: "/friend-link-icons/img_69425932cea33.png"),
        FriendLinkItem(name: "博看期刊", href: "https://new.bookan.com.cn/page/index.html", icon: "/friend-link-icons/img_6942593dcf257.png"),
        FriendLinkItem(name: "汉斯期刊", href: "https://www.hanspub.org/", icon: "/friend-link-icons/img_69425ad2e35cb.png"),
        FriendLinkItem(name: "读秀学术搜索", href: "https://www.duxiu.com/login.jsp", icon: "/friend-link-icons/img_694107c107733.jpg"),
        FriendLinkItem(name: "中国心理科学", href: "https://lib.psych.ac.cn/library/home/index", icon: "/friend-link-icons/img_69410a1d807ec.png"),
        FriendLinkItem(name: "中国生物医学文献", href: "https://www.sinomed.ac.cn/index.jsp", icon: "/friend-link-icons/img_69410aea14e70.png"),
        FriendLinkItem(name: "中科院文献情报中心", href: "https://www.las.ac.cn/", icon: "/friend-link-icons/img_69425ae46c985.png"),
        FriendLinkItem(name: "中国科技论文在线", href: "https://paper.edu.cn/", icon: "/friend-link-icons/img_69425af1720c0.png"),
        FriendLinkItem(name: "中国科学文献服务系统", href: "http://www.sciencechina.cn/", icon: "/friend-link-icons/img_69425aff75d92.jpg"),
        FriendLinkItem(name: "中国社会科学文库", href: "https://www.sklib.cn/", icon: "/friend-link-icons/img_69425b0b75e4e.png"),
        FriendLinkItem(name: "国家科技图书文献中心", href: "https://www.nstl.gov.cn/", icon: "/friend-link-icons/img_69425bcc2d811.png"),
        FriendLinkItem(name: "中国国家图书馆", href: "https://www.nlc.cn/web/index.shtml", icon: "/friend-link-icons/img_69425bd6ecfda.png"),
        FriendLinkItem(name: "大学数字图书馆", href: "https://cadal.edu.cn/index/home", icon: "/friend-link-icons/img_69412615e9404.jpg"),
        FriendLinkItem(name: "全国图书馆联盟", href: "http://www.ucdrs.superlib.net/", icon: "/friend-link-icons/img_694126bc786a3.png"),
        FriendLinkItem(name: "中国社会科学院图书馆", href: "http://www.lib.cass.org.cn/", icon: "/friend-link-icons/img_69425be303397.jpg"),
        FriendLinkItem(name: "工程技术数字图书馆", href: "https://netl.istic.ac.cn/site/home", icon: "/friend-link-icons/img_6941295cebf4e.jpg"),
        FriendLinkItem(name: "思政数据库", href: "https://www.sizhengke.net/", icon: "/friend-link-icons/img_69425bf69b4f5.png"),
    ]),
    FriendLinkSection(title: "英文文献", items: [
        FriendLinkItem(name: "Web of Science", href: "https://www.webofscience.com/wos/", icon: "/friend-link-icons/webofscience.com.png"),
        FriendLinkItem(name: "Nature", href: "https://www.nature.com/", icon: "/friend-link-icons/nature.com.png"),
        FriendLinkItem(name: "Science", href: "https://www.science.org/", icon: "/friend-link-icons/science.org.png"),
        FriendLinkItem(name: "Cell", href: "https://www.cell.com/", icon: "/friend-link-icons/cell.com.png"),
        FriendLinkItem(name: "ScienceDirect", href: "https://www.sciencedirect.com/", icon: "/friend-link-icons/sciencedirect.com.png"),
        FriendLinkItem(name: "Wiley", href: "https://onlinelibrary.wiley.com/", icon: "/friend-link-icons/onlinelibrary.wiley.com.png"),
        FriendLinkItem(name: "Engineering Village", href: "https://www.engineeringvillage.com/home.url", icon: "/friend-link-icons/img_694224af61ecf.png"),
        FriendLinkItem(name: "APS", href: "https://www.aps.org/", icon: "/friend-link-icons/aps.org.png"),
        FriendLinkItem(name: "AIP", href: "https://pubs.aip.org/", icon: "/friend-link-icons/pubs.aip.org.png"),
        FriendLinkItem(name: "ACM", href: "https://dl.acm.org/", icon: "/friend-link-icons/dl.acm.org.png"),
        FriendLinkItem(name: "ACS", href: "https://pubs.acs.org/", icon: "/friend-link-icons/pubs.acs.org.png"),
        FriendLinkItem(name: "IOP", href: "https://iopscience.iop.org/", icon: "/friend-link-icons/iopscience.iop.org.png"),
        FriendLinkItem(name: "Annual Reviews", href: "https://www.annualreviews.org/", icon: "/friend-link-icons/annualreviews.org.png"),
        FriendLinkItem(name: "OUP", href: "https://global.oup.com/academic/", icon: "/friend-link-icons/global.oup.com.png"),
        FriendLinkItem(name: "IEEE", href: "https://ieeexplore.ieee.org/Xplore/home.jsp", icon: "/friend-link-icons/ieeexplore.ieee.org.png"),
        FriendLinkItem(name: "Springer", href: "https://link.springer.com/", icon: "/friend-link-icons/link.springer.com.png"),
        FriendLinkItem(name: "RSC", href: "https://pubs.rsc.org/", icon: "/friend-link-icons/pubs.rsc.org.png"),
        FriendLinkItem(name: "PNAS", href: "https://www.pnas.org/", icon: "/friend-link-icons/pnas.org.png"),
        FriendLinkItem(name: "MDPI", href: "https://www.mdpi.com/", icon: "/friend-link-icons/mdpi.com.png"),
        FriendLinkItem(name: "ASCE", href: "https://www.asce.org/", icon: "/friend-link-icons/asce.org.png"),
        FriendLinkItem(name: "EBSCO", href: "https://www.ebsco.com/", icon: "/friend-link-icons/img_69424b456862e.png"),
        FriendLinkItem(name: "The Lancet", href: "https://www.thelancet.com/", icon: "/friend-link-icons/thelancet.com.png"),
        FriendLinkItem(name: "JAMA", href: "https://jamanetwork.com/", icon: "/friend-link-icons/jamanetwork.com.png"),
        FriendLinkItem(name: "NEJM", href: "https://www.nejm.org/", icon: "/friend-link-icons/nejm.org.png"),
        FriendLinkItem(name: "BMJ", href: "https://www.bmj.com/", icon: "/friend-link-icons/bmj.com.png"),
        FriendLinkItem(name: "APA", href: "https://www.apa.org/", icon: "/friend-link-icons/apa.org.png"),
        FriendLinkItem(name: "ProQuest", href: "https://www.proquest.com/", icon: "/friend-link-icons/proquest.com.png"),
        FriendLinkItem(name: "MathSciNet", href: "https://mathscinet.ams.org/", icon: "/friend-link-icons/mathscinet.ams.org.png"),
        FriendLinkItem(name: "PubChem", href: "https://pubchem.ncbi.nlm.nih.gov/", icon: "/friend-link-icons/pubchem.ncbi.nlm.nih.gov.png"),
        FriendLinkItem(name: "arXiv", href: "https://arxiv.org/", icon: "/friend-link-icons/arxiv.org.png"),
        FriendLinkItem(name: "DOAJ", href: "https://doaj.org/", icon: "/friend-link-icons/doaj.org.png"),
    ]),
    FriendLinkSection(title: "文献管理", items: [
        FriendLinkItem(name: "Zotero", href: "https://www.zotero.org/", icon: "/friend-link-icons/zotero.org.png"),
        FriendLinkItem(name: "EndNote", href: "https://endnote.com/", icon: "/friend-link-icons/endnote.com.png"),
        FriendLinkItem(name: "Mendeley", href: "https://www.mendeley.com/", icon: "/friend-link-icons/mendeley.com.png"),
        FriendLinkItem(name: "NoteExpress", href: "https://jc.inoteexpress.com/dynamo/index.html", icon: "/friend-link-icons/img_6943ee77835fb.png"),
        FriendLinkItem(name: "知网研学", href: "https://x.cnki.net/web/search/#/down", icon: "/friend-link-icons/img_6943ef77170cd.png"),
        FriendLinkItem(name: "CiteSpace", href: "https://citespace.podia.com/", icon: "/friend-link-icons/img_6943f103480aa.jpg"),
    ]),
    FriendLinkSection(title: "翻译工具", items: [
        FriendLinkItem(name: "DeepL", href: "https://www.deepl.com/", icon: "/friend-link-icons/deepl.com.png"),
        FriendLinkItem(name: "Google 翻译", href: "https://translate.google.com/", icon: "/friend-link-icons/translate.google.com.png"),
        FriendLinkItem(name: "有道翻译", href: "https://fanyi.youdao.com/", icon: "/friend-link-icons/fanyi.youdao.com.png"),
        FriendLinkItem(name: "彩云翻译", href: "https://caiyunapp.com/", icon: "/friend-link-icons/caiyunapp.com.png"),
        FriendLinkItem(name: "Papago", href: "https://papago.naver.com/", icon: "/friend-link-icons/papago.naver.com.png"),
    ]),
    FriendLinkSection(title: "论文写作", items: [
        FriendLinkItem(name: "Paperpal", href: "https://www.paperpal.com/", icon: "/friend-link-icons/paperpal.com.png"),
        FriendLinkItem(name: "Overleaf", href: "https://www.overleaf.com/", icon: "/friend-link-icons/overleaf.com.png"),
        FriendLinkItem(name: "Grammarly", href: "https://www.grammarly.com/", icon: "/friend-link-icons/grammarly.com.png"),
        FriendLinkItem(name: "Writefull", href: "https://writefull.com/", icon: "/friend-link-icons/writefull.com.png"),
    ]),
    FriendLinkSection(title: "论文查重", items: [
        FriendLinkItem(name: "iThenticate", href: "https://www.ithenticate.com/", icon: "/friend-link-icons/img_6947e62241ccc.png"),
        FriendLinkItem(name: "知网查重", href: "https://cx.cnki.net/", icon: "/friend-link-icons/img_6943962a7a097.png"),
        FriendLinkItem(name: "维普查重", href: "https://vpcs.fanyu.com/", icon: "/friend-link-icons/img_694258f541da1.png"),
        FriendLinkItem(name: "万方查重", href: "https://check.wanfangdata.com.cn/", icon: "/friend-link-icons/img_6942581ebb3c4.png"),
    ]),
    FriendLinkSection(title: "检索工具", items: [
        FriendLinkItem(name: "X-MOL", href: "https://www.x-mol.com/", icon: "/friend-link-icons/img_694369505512a.png"),
        FriendLinkItem(name: "赛特新思", href: "https://qa.citexs.com/", icon: "/friend-link-icons/img_694376cb7302f.png"),
        FriendLinkItem(name: "非晓数据", href: "https://cboa.cqvip.com/", icon: "/friend-link-icons/img_694379ce11d06.png"),
        FriendLinkItem(name: "Scidown", href: "https://www.scidown.cn/", icon: "/friend-link-icons/img_69437af54d077.png"),
        FriendLinkItem(name: "MedReading", href: "https://www.medreading.cn/pubmed_zh", icon: "/friend-link-icons/img_69438276433a2.png"),
        FriendLinkItem(name: "OpenSign", href: "https://opensign.lib.tsinghua.edu.cn/home", icon: "/friend-link-icons/img_6943846ea2472.png"),
        FriendLinkItem(name: "文献鸟", href: "https://www.storkapp.cn/", icon: "/friend-link-icons/img_694385455f5ae.png"),
    ]),
    FriendLinkSection(title: "专利检索", items: [
        FriendLinkItem(name: "专利检索及分析", href: "https://pss-system.cponline.cnipa.gov.cn/conventionalSearch", icon: "/friend-link-icons/img_6943ae3514026.png"),
        FriendLinkItem(name: "世界专利检索", href: "https://patentscope2.wipo.int/search/zh/search.jsf", icon: "/friend-link-icons/img_6943b8d751e6d.png"),
        FriendLinkItem(name: "专利之星检索", href: "https://www.patentstar.com.cn/", icon: "/friend-link-icons/img_6943b0e03efc4.jpg"),
        FriendLinkItem(name: "专利信息服务平台", href: "http://search.cnipr.com/", icon: "/friend-link-icons/img_6943b194049db.png"),
        FriendLinkItem(name: "佰腾专利网", href: "https://www.baiten.cn/", icon: "/friend-link-icons/img_6943b233a7bea.png"),
        FriendLinkItem(name: "SooPAT专利搜索", href: "https://www.soopat.com/", icon: "/friend-link-icons/img_6943b2ca857f5.png"),
        FriendLinkItem(name: "专利顾如", href: "https://www.patentguru.com/cn", icon: "/friend-link-icons/img_6943b37a22b47.png"),
        FriendLinkItem(name: "专利下载", href: "https://www.drugfuture.com/patent/", icon: "/friend-link-icons/img_6943b43ecd19d.jpg"),
    ]),
    FriendLinkSection(title: "期刊检索", items: [
        FriendLinkItem(name: "JCR分区", href: "https://jcr.clarivate.com/jcr/home", icon: "/friend-link-icons/img_6943be74c4983.png"),
        FriendLinkItem(name: "期刊分区表", href: "https://www.fenqubiao.com/Default.aspx", icon: "/friend-link-icons/img_6943bf531bf6b.png"),
        FriendLinkItem(name: "中国学术期刊", href: "https://cajn.cnki.net/cajn/", icon: "/friend-link-icons/img_6943c02075b05.jpg"),
        FriendLinkItem(name: "中华医学期刊", href: "https://www.medjournals.cn/index.do", icon: "/friend-link-icons/img_6943c0c41e8fe.png"),
        FriendLinkItem(name: "中科院科技期刊网", href: "https://journals.cas.cn/pnav/", icon: "/friend-link-icons/img_694257ed8f29f.png"),
        FriendLinkItem(name: "北大核心期刊", href: "http://hxqk.lib.pku.edu.cn/", icon: "/friend-link-icons/img_6943c808b29cd.png"),
        FriendLinkItem(name: "南大核心期刊", href: "https://cssrac.nju.edu.cn/cpzx/zwshkxywsy/index.html", icon: "/friend-link-icons/img_6943c9a8746fa.jpg"),
    ]),
    FriendLinkSection(title: "答辩 PPT", items: [
        FriendLinkItem(name: "iSlide", href: "https://www.islide.cc/", icon: "/friend-link-icons/img_69551541100ad.png"),
        FriendLinkItem(name: "Canva", href: "https://www.canva.com/", icon: "/friend-link-icons/canva.com.png"),
        FriendLinkItem(name: "Gamma", href: "https://gamma.app/", icon: "/friend-link-icons/gamma.app.png"),
        FriendLinkItem(name: "讯飞星火 PPT", href: "https://xinghuo.xfyun.cn/spark", icon: "/friend-link-icons/img_6944b88c12a6d.png"),
    ]),
    FriendLinkSection(title: "科研服务", items: [
        FriendLinkItem(name: "最新学术会议", href: "https://ais.cn/u/r6BR7f", icon: "/friend-link-icons/img_6946ad04eeb0b.png"),
        FriendLinkItem(name: "SPSSPRO", href: "https://www.spsspro.com/", icon: "/friend-link-icons/img_6946adae35600.png"),
        FriendLinkItem(name: "易析检测", href: "https://www.weipingtest.com/", icon: "/friend-link-icons/img_69a022a6e12be.jpg"),
    ]),
    FriendLinkSection(title: "基金课题", items: [
        FriendLinkItem(name: "国家自然科学基金", href: "https://www.nsfc.gov.cn/", icon: "/friend-link-icons/img_694773c889fc3.png"),
        FriendLinkItem(name: "国科基金大数据", href: "https://kd.nsfc.cn/", icon: "/friend-link-icons/img_694778d119a0e.png"),
        FriendLinkItem(name: "国科基金成果转化", href: "https://cgzh.nsfc.cn/#/", icon: "/friend-link-icons/img_694778d119a0e.png"),
        FriendLinkItem(name: "国家社会科学基金", href: "http://www.nopss.gov.cn/", icon: "/friend-link-icons/img_694774d05eb7f.png"),
        FriendLinkItem(name: "社科基金数据库", href: "https://fz.people.com.cn/skygb/sk/index.php/index", icon: "/friend-link-icons/img_694774d05eb7f.png"),
        FriendLinkItem(name: "科学网基金查询", href: "https://fund.sciencenet.cn/", icon: "/friend-link-icons/img_6944bd5bb2a7d.png"),
    ]),
    FriendLinkSection(title: "科研绘图", items: [
        FriendLinkItem(name: "Origin", href: "https://www.originlab.com/", icon: "/friend-link-icons/img_6944c8524dc7c.png"),
        FriendLinkItem(name: "ProcessOn", href: "https://www.processon.com/", icon: "/friend-link-icons/img_6944cb72e5304.png"),
        FriendLinkItem(name: "boardmix", href: "https://boardmix.cn/", icon: "/friend-link-icons/img_6944cbfd4868f.png"),
        FriendLinkItem(name: "万兴脑图", href: "https://www.edrawmind.com/", icon: "/friend-link-icons/img_6944cd99d7404.png"),
        FriendLinkItem(name: "draw.io", href: "https://app.diagrams.net/", icon: "/friend-link-icons/app.diagrams.net.png"),
    ]),
    FriendLinkSection(title: "代码工具", items: [
        FriendLinkItem(name: "GitHub AI 编程助手", href: "https://github.com/features/copilot", icon: "/friend-link-icons/github.com.png"),
        FriendLinkItem(name: "Cursor", href: "https://www.cursor.com/", icon: "/friend-link-icons/cursor.com.png"),
        FriendLinkItem(name: "通义灵码", href: "https://lingma.aliyun.com/lingma", icon: "/friend-link-icons/img_69469fb7baa1c.png"),
        FriendLinkItem(name: "CodeGeeX", href: "https://codegeex.cn/", icon: "/friend-link-icons/img_6946a1291c5e1.png"),
    ]),
    FriendLinkSection(title: "科研数据", items: [
        FriendLinkItem(name: "中科院科学数据中心", href: "https://www.casdc.cn/home", icon: "/friend-link-icons/img_6944e73c54e13.png"),
        FriendLinkItem(name: "中国科技资源共享", href: "https://escience.org.cn/", icon: "/friend-link-icons/img_6944e8135d39f.png"),
        FriendLinkItem(name: "农业科学数据中心", href: "https://www.agridata.cn/#/home", icon: "/friend-link-icons/img_6944e966b360a.png"),
        FriendLinkItem(name: "高能物理科学数据中心", href: "https://www.nhepsdc.cn/", icon: "/friend-link-icons/img_6944ea64d4d87.jpg"),
        FriendLinkItem(name: "微生物科学数据中心", href: "https://nmdc.cn/", icon: "/friend-link-icons/img_6944ebac360b7.jpg"),
        FriendLinkItem(name: "天文科学数据中心", href: "https://nadc.china-vo.org/", icon: "/friend-link-icons/img_6944ec5544fa5.png"),
        FriendLinkItem(name: "气象科学数据中心", href: "https://data.cma.cn/", icon: "/friend-link-icons/img_6944ed576a5c1.jpg"),
        FriendLinkItem(name: "海洋科学数据中心", href: "https://mds.nmdis.org.cn/", icon: "/friend-link-icons/img_6944eed73d94c.jpg"),
        FriendLinkItem(name: "极地科学数据中心", href: "https://datacenter.chinare.org.cn/data-center/dindex", icon: "/friend-link-icons/img_6944ef5e5fac6.png"),
        FriendLinkItem(name: "生态科学数据中心", href: "https://www.nesdc.org.cn/", icon: "/friend-link-icons/img_6944effc6e935.jpg"),
        FriendLinkItem(name: "基因组科学数据中心", href: "https://ngdc.cncb.ac.cn/", icon: "/friend-link-icons/img_6944f0edd4382.png"),
        FriendLinkItem(name: "计量科学数据中心", href: "https://www.nmdc.ac.cn/main/#/pages/index", icon: "/friend-link-icons/img_6944f1d62e506.png"),
        FriendLinkItem(name: "国家空间科学数据中心", href: "https://www.nssdc.ac.cn/nssdc_zh/html/index.html", icon: "/friend-link-icons/img_6944f2c584b31.png"),
        FriendLinkItem(name: "地球科学数据中心", href: "https://www.geodata.cn/main/", icon: "/friend-link-icons/img_6944f4232023a.png"),
        FriendLinkItem(name: "地震科学数据中心", href: "https://data.earthquake.cn/", icon: "/friend-link-icons/img_6944f4e242070.png"),
        FriendLinkItem(name: "MacroView 经济数据库", href: "https://www.macroview.club/", icon: "/friend-link-icons/img_6944f62aca31b.jpg"),
    ]),
    FriendLinkSection(title: "知识服务", items: [
        FriendLinkItem(name: "工程科技知识中心", href: "https://www.ckcest.cn/entry/", icon: "/friend-link-icons/img_694509f1d48b3.png"),
        FriendLinkItem(name: "医药卫生知识服务", href: "https://medks.imicams.ac.cn/index.html", icon: "/friend-link-icons/img_69450b00d419b.png"),
        FriendLinkItem(name: "海洋专业知识服务", href: "https://oceanknowledge.nmdis.org.cn/", icon: "/friend-link-icons/img_69450b96a7b01.png"),
        FriendLinkItem(name: "气象科学专业知识", href: "https://k.data.cma.cn/", icon: "/friend-link-icons/img_69450c39e4f9d.png"),
        FriendLinkItem(name: "能源专业知识服务", href: "https://energy.qibebt.ac.cn/index", icon: "/friend-link-icons/img_69450cc2ceb7f.png"),
        FriendLinkItem(name: "农业学术服务平台", href: "https://agri.nais.net.cn/index.html", icon: "/friend-link-icons/img_69450d9828c54.png"),
        FriendLinkItem(name: "轨道交通知识服务", href: "https://www.rail-info.com/Tky/Home/Index", icon: "/friend-link-icons/img_69450e48479fe.png"),
        FriendLinkItem(name: "中医专业知识服务", href: "https://ai.tcmcds.com/homePage", icon: "/friend-link-icons/img_69450fd05cd58.png"),
    ]),
    FriendLinkSection(title: "数据查找", items: [
        FriendLinkItem(name: "国家数据", href: "https://data.stats.gov.cn/", icon: "/friend-link-icons/img_694511cc2d590.png"),
        FriendLinkItem(name: "互联网数据", href: "https://cnnic.cn/6/86/88/index.html", icon: "/friend-link-icons/img_694512e7b892c.png"),
        FriendLinkItem(name: "前瞻数据库", href: "https://d.qianzhan.com/", icon: "/friend-link-icons/img_694513ed596bd.png"),
        FriendLinkItem(name: "CnOpenData", href: "https://www.cnopendata.com/", icon: "/friend-link-icons/img_694514cc7d6be.png"),
        FriendLinkItem(name: "法律法规", href: "https://flk.npc.gov.cn/index", icon: "/friend-link-icons/img_6945158ad75c1.png"),
        FriendLinkItem(name: "东方财富数据", href: "https://data.eastmoney.com/center/", icon: "/friend-link-icons/img_694516796f9cc.png"),
        FriendLinkItem(name: "同花顺数据", href: "https://data.10jqka.com.cn/", icon: "/friend-link-icons/img_69451719ad410.png"),
        FriendLinkItem(name: "搜数", href: "http://www.soshoo.com/index.do", icon: "/friend-link-icons/img_6945188b7966a.png"),
    ]),
    FriendLinkSection(title: "科研社区", items: [
        FriendLinkItem(name: "科学网", href: "https://www.sciencenet.cn/", icon: "/friend-link-icons/img_6944bd5bb2a7d.png"),
        FriendLinkItem(name: "ResearchGate", href: "https://www.researchgate.net/", icon: "/friend-link-icons/researchgate.net.png"),
        FriendLinkItem(name: "小木虫", href: "https://muchong.com/", icon: "/friend-link-icons/img_6944bee7673dc.png"),
        FriendLinkItem(name: "丁香园社区", href: "https://www.dxy.cn/bbs/newweb/pc/home", icon: "/friend-link-icons/img_6944bfaad3e1f.png"),
        FriendLinkItem(name: "谷粉学术论坛", href: "https://bbs.91bdqu.com/", icon: "/friend-link-icons/img_6944c10137262.png"),
        FriendLinkItem(name: "X-MOL问答", href: "https://www.x-mol.com/ask", icon: "/friend-link-icons/img_694369505512a.png"),
        FriendLinkItem(name: "科研通交流社区", href: "https://www.ablesci.com/post", icon: "/friend-link-icons/img_6944c2b8722df.png"),
        FriendLinkItem(name: "医学论坛网", href: "https://www.cmt.com.cn/", icon: "/friend-link-icons/img_6944c43cdc913.png"),
    ]),
    FriendLinkSection(title: "院校相关", items: [
        FriendLinkItem(name: "院校库", href: "https://yz.chsi.com.cn/sch/", icon: "/friend-link-icons/img_69476a11f05e7.png"),
        FriendLinkItem(name: "专业知识库", href: "https://yz.chsi.com.cn/zyk/", icon: "/friend-link-icons/img_69476a11f05e7.png"),
        FriendLinkItem(name: "青塔数据", href: "https://www.cingta.com/opendata/list", icon: "/friend-link-icons/img_69476b8c100f1.png"),
        FriendLinkItem(name: "软科", href: "https://www.shanghairanking.cn/", icon: "/friend-link-icons/img_69476c4b0caae.png"),
        FriendLinkItem(name: "中国大学排行榜", href: "https://www.cnur.com/", icon: "/friend-link-icons/img_69476ce6be870.png"),
        FriendLinkItem(name: "世界大学排名", href: "https://www.ukpass.org/ranking/index-1-0-0.html", icon: "/friend-link-icons/img_69476d6bb0af9.png"),
        FriendLinkItem(name: "全国高等院校名单", href: "https://hudong.moe.gov.cn/qggxmd/", icon: "/friend-link-icons/img_6947707b6b26d.png"),
        FriendLinkItem(name: "学科评估", href: "https://www.cdgdc.edu.cn/dslxkpgjggb/index.htm", icon: "/friend-link-icons/img_69479110bd02c.png"),
    ]),
]

struct FriendLinksView: View {
    @State private var expandedSections: Set<String> = Set(friendLinkSections.map(\.title))

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                Image(systemName: "globe")
                    .font(.title3)
                    .foregroundStyle(.blue)
                VStack(alignment: .leading, spacing: 2) {
                    Text("科研友链")
                        .font(.headline)
                    Text("\(friendLinkSections.reduce(0) { $0 + $1.items.count }) 条链接 · \(friendLinkSections.count) 个分类")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Button(expandedSections.count == friendLinkSections.count ? "收起全部" : "展开全部") {
                    if expandedSections.count == friendLinkSections.count {
                        expandedSections.removeAll()
                    } else {
                        expandedSections = Set(friendLinkSections.map(\.title))
                    }
                }
                .font(.caption)
            }
            .padding()

            Divider()

            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    ForEach(friendLinkSections, id: \.title) { section in
                        FriendLinkSectionView(
                            section: section,
                            isExpanded: expandedSections.contains(section.title)
                        ) {
                            if expandedSections.contains(section.title) {
                                expandedSections.remove(section.title)
                            } else {
                                expandedSections.insert(section.title)
                            }
                        }
                    }
                }
                .padding()
            }
        }
    }
}

private struct FriendLinkSectionView: View {
    let section: FriendLinkSection
    let isExpanded: Bool
    let toggle: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button(action: toggle) {
                HStack {
                    Text(section.title)
                        .font(.subheadline.bold())
                    Text("\(section.items.count) 条")
                        .font(.caption2)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.blue.opacity(0.1))
                        .cornerRadius(4)
                    Spacer()
                    Text(isExpanded ? "收起" : "展开")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .buttonStyle(.plain)
            .padding(10)

            if isExpanded {
                Divider()
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 180))], spacing: 8) {
                    ForEach(section.items, id: \.name) { item in
                        Link(destination: URL(string: item.href)!) {
                            HStack(spacing: 8) {
                                linkIcon(item.icon)
                                Text(item.name)
                                    .font(.subheadline)
                                Spacer()
                            }
                            .padding(.horizontal, 10)
                            .padding(.vertical, 8)
                            .background(Theme.Colors.surface)
                            .cornerRadius(Theme.Radii.medium)
                            .nmShadow(level: Theme.Shadows.soft)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(10)
            }
        }
        .background(Theme.Colors.surface)
        .cornerRadius(Theme.Radii.medium)
        .nmShadow(level: Theme.Shadows.soft)
    }

    @ViewBuilder
    private func linkIcon(_ iconPath: String?) -> some View {
        if let path = iconPath,
           let image = loadBundleIcon(path: path) {
            image
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(width: 18, height: 18)
        } else {
            Image(systemName: "link.circle")
                .foregroundStyle(.blue)
        }
    }

    private func loadBundleIcon(path: String) -> Image? {
        let filename = (path as NSString).lastPathComponent
        let name = (filename as NSString).deletingPathExtension
        let ext = (filename as NSString).pathExtension
        guard let url = Bundle.module.url(forResource: name, withExtension: ext, subdirectory: "friend-link-icons") else {
            return nil
        }
        guard let nsImage = NSImage(contentsOf: url) else { return nil }
        return Image(nsImage: nsImage)
    }
}
