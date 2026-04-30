import Foundation

struct DiscoveryDomain: Identifiable {
    let id: String
    let label: String
    let arxivCats: [String]
    let conf: [String: [String]]
    let jour: [String: [String]]
}

struct RankOption: Identifiable {
    let id: String
    let label: String
    let color: String
    let dynamic: Bool
}

struct CSGroup {
    let label: String
    let keys: [String]
}

struct DiscoveryVenueData {
    static let domains: [DiscoveryDomain] = [
        DiscoveryDomain(id: "ai", label: "AI & 机器学习", arxivCats: ["cs.AI","cs.LG","cs.NE","stat.ML"],
            conf: ["ccf_a": ["AAAI","NeurIPS","ICML","ICLR","IJCAI"], "ccf_b": ["COLT","ECAI","AAMAS","UAI","KR","ICCBR","ICAPS","PPSN"], "ccf_c": ["ACML","ICONIP","IJCNN","GECCO"]],
            jour: ["ccf_a": ["AI","JMLR","TPAMI","TNNLS"], "ccf_b": ["IJAR","JAIR"], "ccf_c": ["Constraints","APIN"], "cas_1": ["Nature Machine Intelligence","Artificial Intelligence","JMLR","TPAMI","TNNLS","IEEE Transactions on Neural Networks and Learning Systems"], "cas_2": ["Pattern Recognition","Neural Networks","Knowledge-Based Systems","Neurocomputing"]]),
        DiscoveryDomain(id: "cv", label: "计算机视觉", arxivCats: ["cs.CV","eess.IV"],
            conf: ["ccf_a": ["CVPR","ICCV","ACM MM"], "ccf_b": ["ECCV","ICMR","ICME","ISMAR","PG"], "ccf_c": ["BMVC","ICIP","FG","WACV"]],
            jour: ["ccf_a": ["TIP","TPAMI","IJCV","TVCG","TOG"], "ccf_b": ["CVIU","SIIMS","CVMJ","TAP","TMM","TCSVT"], "ccf_c": ["IET Image Processing"], "cas_1": ["International Journal of Computer Vision","IEEE Transactions on Image Processing","TPAMI","Medical Image Analysis"], "cas_2": ["Computer Vision and Image Understanding","Image and Vision Computing"]]),
        DiscoveryDomain(id: "nlp", label: "自然语言处理", arxivCats: ["cs.CL"],
            conf: ["ccf_a": ["ACL"], "ccf_b": ["EMNLP","NAACL","COLING"], "ccf_c": ["EACL","CoNLL","SemEval"]],
            jour: ["ccf_a": [], "ccf_b": ["TACL"], "ccf_c": ["Natural Language Engineering","Computational Linguistics"], "cas_1": ["Transactions of the ACL","Computational Linguistics"], "cas_2": ["Natural Language Processing Journal","Language Resources and Evaluation"]]),
        DiscoveryDomain(id: "db", label: "数据库 & 数据挖掘", arxivCats: ["cs.DB","cs.IR"],
            conf: ["ccf_a": ["SIGMOD","SIGKDD","ICDE","SIGIR","VLDB"], "ccf_b": ["CIKM","WSDM","PODS","DASFAA","EDBT","CIDR","SDM","ISWC","ICDM","ICDT","RecSys","WISE","ECML-PKDD"], "ccf_c": ["APWeb","DEXA","SSDBM","ER"]],
            jour: ["ccf_a": ["TODS","TOIS","TKDE","VLDBJ"], "ccf_b": ["TKDD","TWEB","DKE","DMKD","IPM","IS","JASIST","JWS","KAIS","AEI"], "ccf_c": ["Information Systems","Data & Knowledge Engineering"], "cas_1": ["VLDB Journal","IEEE Transactions on Knowledge and Data Engineering","ACM Transactions on Database Systems"], "cas_2": ["Data Mining and Knowledge Discovery","Information Processing & Management","Knowledge-Based Systems"]]),
        DiscoveryDomain(id: "sys", label: "系统 & 体系结构", arxivCats: ["cs.DC","cs.AR"],
            conf: ["ccf_a": ["ASPLOS","ISCA","MICRO","HPCA","PPoPP","FAST","SC","USENIX ATC","EuroSys","OSDI","SOSP","HPDC"], "ccf_b": ["SoCC","SPAA","PODC","IPDPS","ICDCS","CLUSTER","ICS","VEE","HiPEAC","PACT","ICPP","Euro-Par","MSST"], "ccf_c": ["Middleware","NPC","ICDCN"]],
            jour: ["ccf_a": ["TOCS","TOS","TC","TPDS","TACO"], "ccf_b": ["TAAS","JPDC","JSA","TCC","TECS","TRETS","TVLSI"], "ccf_c": ["Parallel Computing","Journal of Systems Architecture"], "cas_1": ["IEEE Transactions on Parallel and Distributed Systems","ACM Transactions on Computer Systems"], "cas_2": ["Cluster Computing","Journal of Parallel and Distributed Computing"]]),
        DiscoveryDomain(id: "se", label: "软件工程", arxivCats: ["cs.SE","cs.PL"],
            conf: ["ccf_a": ["ICSE","FSE","ASE","ISSTA","OOPSLA","PLDI","POPL"], "ccf_b": ["ICPC","RE","ICFP","LCTES","MoDELS","SANER","ICSME","VMCAI","CC","ESEM","ISSRE","SAS","CAiSE","ECOOP"], "ccf_c": ["PEPM","FASE","SCAM"]],
            jour: ["ccf_a": ["TOSEM","TSE"], "ccf_b": ["ASE","ESE","IST","JFP","JSS","SCP","SoSyM","STVR","SPE"], "ccf_c": ["Software Quality Journal"], "cas_1": ["IEEE Transactions on Software Engineering","ACM Transactions on Software Engineering and Methodology"], "cas_2": ["Journal of Systems and Software","Information and Software Technology"]]),
        DiscoveryDomain(id: "net", label: "网络 & 通信", arxivCats: ["cs.NI"],
            conf: ["ccf_a": ["SIGCOMM","MobiCom","INFOCOM","NSDI"], "ccf_b": ["CoNEXT","SECON","IPSN","MobiSys","ICNP","MobiHoc","NOSSDAV","IWQoS","IMC","SenSys"], "ccf_c": ["WCNC","Globecom","ICC"]],
            jour: ["ccf_a": ["JSAC","TMC","TON"], "ccf_b": ["CN","TCOM","TWC","TOIT","TOMM","TOSN"], "ccf_c": ["Wireless Networks","Ad Hoc Networks"], "cas_1": ["IEEE/ACM Transactions on Networking","IEEE Transactions on Mobile Computing","IEEE Communications Surveys & Tutorials"], "cas_2": ["Computer Networks","IEEE Transactions on Wireless Communications"]]),
        DiscoveryDomain(id: "sec", label: "安全 & 密码学", arxivCats: ["cs.CR"],
            conf: ["ccf_a": ["CCS","EUROCRYPT","S&P","CRYPTO","USENIX Security","NDSS"], "ccf_b": ["ACSAC","ASIACRYPT","ESORICS","CSFW","SRDS","CHES","DSN","RAID","PKC","TCC"], "ccf_c": ["FC","ACNS","ISC","DIMVA"]],
            jour: ["ccf_a": ["TDSC","TIFS"], "ccf_b": ["TOPS","JCS"], "ccf_c": ["Computers & Security","Journal of Cryptology"], "cas_1": ["IEEE Transactions on Information Forensics and Security","IEEE Transactions on Dependable and Secure Computing"], "cas_2": ["Computers & Security","Journal of Network and Computer Applications"]]),
        DiscoveryDomain(id: "theory", label: "理论计算机", arxivCats: ["cs.DS","cs.CC","cs.LO"],
            conf: ["ccf_a": ["STOC","SODA","FOCS","LICS","CAV"], "ccf_b": ["SoCG","ESA","CCC","ICALP","CADE","CONCUR","HSCC","SAT","FMCAD"], "ccf_c": ["MFCS","ICTAC","FoSSaCS"]],
            jour: ["ccf_a": ["TALG","TOCL","TOMS","Algorithmica","FMSD","JCSS","JSC","MSCS","TCS","IANDC","SICOMP"], "ccf_b": [], "ccf_c": [], "cas_1": ["SIAM Journal on Computing","Journal of the ACM"], "cas_2": ["Theoretical Computer Science","Journal of Computer and System Sciences"]]),
        DiscoveryDomain(id: "hci", label: "人机交互", arxivCats: ["cs.HC"],
            conf: ["ccf_a": ["CHI","UbiComp","UIST","CSCW"], "ccf_b": ["GROUP","IUI","ISS","ECSCW","PERCOM","MobileHCI"], "ccf_c": ["DIS","ASSETS","INTERACT"]],
            jour: ["ccf_a": ["TOCHI","IJHCS"], "ccf_b": ["HCI","IJHCI","UMUAI","CSCW"], "ccf_c": ["Interacting with Computers","Personal and Ubiquitous Computing"], "cas_1": ["ACM Transactions on Computer-Human Interaction","International Journal of Human-Computer Studies"], "cas_2": ["Behaviour & Information Technology","Human-Computer Interaction"]]),
        DiscoveryDomain(id: "cross", label: "跨学科 & 多媒体", arxivCats: ["cs.MA","cs.GR"],
            conf: ["ccf_a": ["ACM MM","SIGGRAPH","WWW","IEEE VIS"], "ccf_b": ["ICWSM","CogSci","WINE","MICCAI","I3D","Eurographics","EuroVis"], "ccf_c": ["3DV","ISMIR","PacificVis"]],
            jour: ["ccf_a": ["TOG","TMM","TVCG","Proc. IEEE"], "ccf_b": ["TCSVT","CAGD","CGF","CAD"], "ccf_c": [], "cas_1": ["ACM Transactions on Graphics","IEEE Transactions on Visualization and Computer Graphics"], "cas_2": ["IEEE Transactions on Multimedia","Computers & Graphics"]]),
        DiscoveryDomain(id: "bio", label: "生物信息", arxivCats: ["q-bio.QM","q-bio.BM","q-bio.GN","q-bio.NC"],
            conf: ["ccf_a": [], "ccf_b": ["ISMB","RECOMB","BIBM","MICCAI"], "ccf_c": ["APBC","ISBRA"]],
            jour: ["ccf_a": ["Bioinformatics"], "ccf_b": ["TCBB","JAMIA"], "ccf_c": ["BMC Bioinformatics","Briefings in Bioinformatics"], "cas_1": ["Nature Methods","Nucleic Acids Research","Genome Research","PLOS Computational Biology","Bioinformatics"], "cas_2": ["BMC Bioinformatics","Briefings in Bioinformatics","Genomics"]]),
        DiscoveryDomain(id: "math", label: "数学", arxivCats: ["math.OC","math.NA","math.PR","math.ST","math.CO"],
            conf: ["ccf_a": [], "ccf_b": [], "ccf_c": []],
            jour: ["ccf_a": [], "ccf_b": [], "ccf_c": [], "cas_1": ["Annals of Mathematics","Journal of the AMS","Inventiones Mathematicae","Acta Mathematica","SIAM Journal on Numerical Analysis","Foundations of Computational Mathematics"], "cas_2": ["Mathematics of Computation","Numerische Mathematik","Journal of Differential Equations","SIAM Journal on Optimization"]]),
        DiscoveryDomain(id: "physics", label: "物理", arxivCats: ["physics.comp-ph","cond-mat","quant-ph","physics.app-ph"],
            conf: ["ccf_a": [], "ccf_b": [], "ccf_c": []],
            jour: ["ccf_a": [], "ccf_b": [], "ccf_c": [], "cas_1": ["Physical Review Letters","Nature Physics","Physical Review X","npj Quantum Information","Physical Review Materials"], "cas_2": ["Physical Review B","Physical Review E","Journal of Physics: Condensed Matter"]]),
        DiscoveryDomain(id: "ee", label: "电气工程", arxivCats: ["eess.SP","eess.SY","eess.AS"],
            conf: ["ccf_a": ["DAC","RTSS"], "ccf_b": ["DATE","RTAS","EMSOFT","ISCAS"], "ccf_c": ["ICCAD","ICCD","ISLPED"]],
            jour: ["ccf_a": ["TCAD","TC"], "ccf_b": ["TODAES","TECS","TRETS","TVLSI"], "ccf_c": ["Integration"], "cas_1": ["IEEE Transactions on Industrial Electronics","IEEE Transactions on Power Electronics","IEEE Signal Processing Letters","IEEE Transactions on Circuits and Systems I"], "cas_2": ["Signal Processing","Digital Signal Processing","IEEE Transactions on Circuits and Systems II"]]),
        DiscoveryDomain(id: "robotics", label: "机器人", arxivCats: ["cs.RO","eess.SY"],
            conf: ["ccf_a": [], "ccf_b": ["ICRA","IROS"], "ccf_c": ["ICAR","Humanoids","CoRL"]],
            jour: ["ccf_a": [], "ccf_b": ["TAC"], "ccf_c": ["Robotics and Autonomous Systems"], "cas_1": ["Science Robotics","IEEE Transactions on Robotics","International Journal of Robotics Research","T-RO"], "cas_2": ["Autonomous Robots","Journal of Field Robotics","Robotics and Autonomous Systems"]]),
    ]

    static let csGroups: [CSGroup] = [
        CSGroup(label: "人工智能", keys: ["ai", "cv", "nlp"]),
        CSGroup(label: "数据与信息", keys: ["db"]),
        CSGroup(label: "系统与工程", keys: ["sys", "se", "net"]),
        CSGroup(label: "安全与理论", keys: ["sec", "theory"]),
        CSGroup(label: "人机与多媒体", keys: ["hci", "cross"]),
    ]

    static let nonCSKeys = ["bio", "math", "physics", "ee", "robotics"]

    static let rankOptions: [RankOption] = [
        RankOption(id: "ccf_a", label: "CCF-A", color: "#FF3B30", dynamic: false),
        RankOption(id: "ccf_b", label: "CCF-B", color: "#FF9500", dynamic: false),
        RankOption(id: "ccf_c", label: "CCF-C", color: "#8E8E93", dynamic: false),
        RankOption(id: "cas_1", label: "中科院1区", color: "#34C759", dynamic: false),
        RankOption(id: "cas_2", label: "中科院2区", color: "#30B0C7", dynamic: false),
        RankOption(id: "cas_3", label: "中科院3区", color: "#5AC8FA", dynamic: true),
        RankOption(id: "cas_4", label: "中科院4区", color: "#636366", dynamic: true),
        RankOption(id: "cas_top", label: "Top期刊", color: "#AF52DE", dynamic: true),
        RankOption(id: "jcr_q1", label: "JCR Q1", color: "#FF6B35", dynamic: true),
        RankOption(id: "jcr_q2", label: "JCR Q2", color: "#FF9F1C", dynamic: true),
        RankOption(id: "jcr_q3", label: "JCR Q3", color: "#A8DADC", dynamic: true),
        RankOption(id: "scie", label: "SCIE", color: "#4ECDC4", dynamic: true),
        RankOption(id: "ssci", label: "SSCI", color: "#96CEB4", dynamic: true),
    ]

    static func computeStaticVenues(domains: [String], type: String, ranks: [String]) -> (categories: [String], journalTerms: [String]) {
        var cats = Set<String>()
        var terms = Set<String>()
        let staticRanks = ranks.filter { rank in
            !(Self.rankOptions.first(where: { $0.id == rank })?.dynamic ?? false)
        }

        for domainKey in domains {
            guard let domain = Self.domains.first(where: { $0.id == domainKey }) else { continue }
            domain.arxivCats.forEach { cats.insert($0) }
            let addConference = type == "all" || type == "conference"
            let addJournal = type == "all" || type == "journal"
            for rank in staticRanks {
                if addConference, let venues = domain.conf[rank] {
                    venues.forEach { terms.insert($0) }
                }
                if addJournal, let venues = domain.jour[rank] {
                    venues.forEach { terms.insert($0) }
                }
            }
        }
        return (Array(cats), Array(terms))
    }
}

struct DiscoveryResult: Identifiable {
    let id: String
    let title: String
    let authors: [String]
    let summary: String
    let published: String?
    let categories: [String]
    let pdfURL: String?
}
