# 刊会查询数据源调研报告

## 一、现有数据源分析

### 1. CCF 推荐目录（计算机类）
- **文件**: `apps/desktop/src-tauri/src/data/ccf_catalog.json`
- **规模**: 约 1000+ 条记录
- **覆盖**: CCF-A/B/C 等级会议和期刊
- **字段**: name, rating(A/B/C), entity_type(会议/期刊), area, url, publisher, label
- **来源**: 中国计算机学会（CCF）2022年推荐目录

### 2. 期刊分区数据（中科院/JCR）
- **文件**: `apps/desktop/src-tauri/src/data/journal_partitions.json`
- **规模**: 约 13000+ 条记录
- **覆盖**: SCI/SSCI 期刊
- **字段**: name, issn, eissn, publisher, jcr_quartile, cas_quartile, cas_top, jif, jif_rank, wos_categories, indexes, open_access
- **来源**: 中科院文献情报中心 + JCR 数据

## 二、可扩展的多学科数据源

### A. 自然科学类

#### 1. SCI/SCIE 期刊完整列表（所有学科）
- **来源**: Clarivate Web of Science Master Journal List
- **URL**: https://mjl.clarivate.com/home
- **数据量**: 9500+ 期刊
- **覆盖**: 所有 SCI/SCIE 学科领域
- **字段**: Journal Title, ISSN, eISSN, Publisher, Category, Edition
- **获取方式**: 官网可下载 CSV/Excel
- **更新频率**: 每月更新
- **用途**: 基础期刊信息库

#### 2. JCR 期刊引证报告
- **来源**: Journal Citation Reports (Clarivate)
- **URL**: https://jcr.clarivate.com
- **数据量**: 12000+ 期刊
- **覆盖**: SCIE, SSCI, AHCI, ESCI
- **字段**: JIF, JCI, 分区, 排名, 被引半衰期等
- **获取方式**: 需要订阅，部分数据公开
- **更新频率**: 每年6月
- **用途**: 影响因子和分区查询

#### 3. 中科院期刊分区表
- **来源**: 中国科学院文献情报中心
- **URL**: https://www.fenqubiao.com/
- **数据量**: 13000+ 期刊
- **覆盖**: SCI/SSCI 期刊
- **字段**: 大类分区、小类分区、Top期刊
- **获取方式**: 官方小程序/网站查询
- **更新频率**: 每年12月
- **用途**: 国内最常用的分区标准

### B. 工程技术类

#### 4. EI Compendex 期刊列表
- **来源**: Engineering Village (Elsevier)
- **URL**: https://www.engineeringvillage.com
- **数据量**: 4000+ 期刊
- **覆盖**: 工程技术全领域
- **字段**: Title, ISSN, Publisher, Subject Area
- **获取方式**: 需要订阅
- **用途**: 工程类期刊检索

#### 5. IEEE 出版物列表
- **来源**: IEEE Xplore
- **URL**: https://ieeexplore.ieee.org
- **数据量**: 200+ 期刊，1000+ 会议
- **覆盖**: 电气电子、计算机工程
- **字段**: Title, ISSN, Impact Factor, Subject
- **获取方式**: 官网可浏览
- **用途**: 电气电子工程领域

### C. 医学与生命科学类

#### 6. PubMed/MEDLINE 期刊列表
- **来源**: NLM (National Library of Medicine)
- **URL**: https://www.ncbi.nlm.nih.gov/nlmcatalog/journals
- **数据量**: 30000+ 期刊
- **覆盖**: 生物医学、生命科学全领域
- **字段**: Title, ISSN, NLM ID, Subject, Publisher
- **获取方式**: 官网可下载完整列表
- **更新频率**: 每日更新
- **用途**: 医学类期刊基础信息

#### 7. 医学期刊影响因子
- **来源**: MedSci (梅斯医学)
- **URL**: https://www.medsci.cn/sci/index.do
- **数据量**: 10000+ 医学期刊
- **覆盖**: 医学各专科
- **字段**: IF, 分区, 录用比例, 审稿周期
- **获取方式**: 官网查询
- **用途**: 医学期刊投稿参考

#### 8. CAS 生物学期刊
- **来源**: 中国科学院上海生命科学研究院
- **覆盖**: 生物、农学、医学
- **用途**: 国内生物领域评价

### D. 社会科学类

#### 9. SSCI 期刊列表
- **来源**: Web of Science
- **URL**: https://mjl.clarivate.com/home
- **数据量**: 3500+ 期刊
- **覆盖**: 社会科学全领域
- **字段**: 同 SCI
- **用途**: 社科类期刊检索

#### 10. CSSCI 来源期刊（中文核心）
- **来源**: 南京大学中国社会科学研究评价中心
- **URL**: https://cssrac.nju.edu.cn/
- **数据量**: 500+ 期刊
- **覆盖**: 中文社会科学期刊
- **字段**: 期刊名, 主办单位, 学科分类
- **更新频率**: 每两年
- **用途**: 国内社科评价标准

#### 11. 北大核心期刊目录
- **来源**: 北京大学图书馆
- **数据量**: 2000+ 期刊
- **覆盖**: 中文期刊各学科
- **更新频率**: 每三年
- **用途**: 国内核心期刊评价

### E. 人文艺术类

#### 12. A&HCI 期刊列表
- **来源**: Web of Science
- **数据量**: 1800+ 期刊
- **覆盖**: 艺术与人文科学
- **用途**: 人文艺术类期刊

#### 13. 中国人文社会科学核心期刊
- **来源**: 中国社科院
- **覆盖**: 人文科学各领域
- **用途**: 国内人文期刊评价

### F. 综合性数据源

#### 14. Scopus 期刊列表
- **来源**: Elsevier
- **URL**: https://www.scopus.com/sources
- **数据量**: 25000+ 期刊
- **覆盖**: 全学科
- **字段**: CiteScore, SJR, SNIP, 四分位数
- **获取方式**: 官网可浏览，需订阅获取完整数据
- **用途**: 欧洲常用评价标准

#### 15. DOAJ 开放获取期刊目录
- **来源**: Directory of Open Access Journals
- **URL**: https://doaj.org
- **数据量**: 18000+ 期刊
- **覆盖**: 全学科 OA 期刊
- **字段**: Title, ISSN, Publisher, Subject, License
- **获取方式**: API/下载
- **用途**: OA 期刊检索

#### 16. LetPub 期刊查询系统
- **来源**: LetPub
- **URL**: https://www.letpub.com.cn/index.php?page=journalapp&view=search
- **数据量**: 10000+ 期刊
- **覆盖**: SCI/SSCI 主要期刊
- **字段**: IF, 分区, 投稿经验, 审稿周期
- **获取方式**: 官网查询
- **用途**: 投稿参考（含用户经验）

#### 17. JournalGuide
- **来源**: JournalGuide
- **URL**: https://www.journalguide.com/
- **覆盖**: 全学科期刊匹配
- **用途**: 根据论文内容推荐期刊

#### 18. Editage Journal Selector
- **来源**: Editage
- **URL**: https://www.editage.com/journal-selector
- **覆盖**: 全学科
- **用途**: 期刊选择工具

## 三、数据源整合方案

### 数据结构建议

```typescript
interface UnifiedSource {
  // 基础信息
  id: string;
  name: string;
  name_zh?: string;
  issn?: string;
  eissn?: string;
  publisher?: string;
  
  // 类型
  entity_type: "journal" | "conference" | "book_series";
  
  // 学科分类
  disciplines: string[];        // 一级学科
  sub_disciplines?: string[];  // 二级学科
  
  // 等级评定（多标准并存）
  ratings: {
    ccf?: "A" | "B" | "C";
    jcr_quartile?: "Q1" | "Q2" | "Q3" | "Q4";
    cas_quartile?: "1区" | "2区" | "3区" | "4区" | "Top";
    ccfcs?: "A" | "B" | "C";  // 中国科协
    scopus_quartile?: "Q1" | "Q2" | "Q3" | "Q4";
    cssci?: boolean;            // 是否 CSSCI
    pkucore?: boolean;          // 是否北大核心
  };
  
  // 影响力指标
  metrics: {
    jif?: number;               // Journal Impact Factor
    jif5?: number;              // 5年影响因子
    cite_score?: number;        // Scopus CiteScore
    sjr?: number;               // SCImago Journal Rank
    snip?: number;              // Source Normalized Impact
    h_index?: number;
  };
  
  // 收录情况
  indexes: ("SCI" | "SCIE" | "SSCI" | "AHCI" | "EI" | "Scopus" | "CSSCI" | "CSCD" | "PubMed")[];
  
  // 开放获取
  open_access?: boolean;
  oa_type?: "gold" | "green" | "hybrid" | "bronze";
  apc?: number;                 // Article Processing Charge
  
  // 会议特有
  conference?: {
    abbreviation?: string;
    frequency?: string;
    location_pattern?: string;  // 举办地点规律
    submission_deadline?: string; // 典型投稿截止日期
  };
  
  // 投稿信息
  submission?: {
    avg_review_time?: number;   // 平均审稿天数
    acceptance_rate?: number;     // 录用率
    first_decision_time?: number;
  };
  
  // 链接
  urls?: {
    homepage?: string;
    submission?: string;
    guide?: string;
    letpub?: string;
  };
  
  // 元数据
  data_sources: string[];       // 数据来源标识
  last_updated: string;
}
```

### 数据源优先级

| 优先级 | 数据源 | 学科 | 用途 |
|--------|--------|------|------|
| P0 | CCF Catalog | 计算机 | 现有数据，必须保留 |
| P0 | Journal Partitions | 综合 | 现有数据，中科院分区 |
| P1 | SCI/SCIE Master List | 综合 | 基础期刊库 |
| P1 | JCR | 综合 | 影响因子 |
| P1 | 中科院分区 | 综合 | 国内标准 |
| P2 | Scopus | 综合 | 国际补充 |
| P2 | PubMed | 医学 | 医学专用 |
| P2 | CSSCI | 社科 | 国内社科 |
| P3 | EI Compendex | 工程 | 工程补充 |
| P3 | A&HCI | 人文 | 人文补充 |
| P3 | DOAJ | 综合 | OA期刊 |

## 四、实施建议

### 阶段一：数据爬取/获取
1. 自动化爬取 Clarivate Master Journal List
2. 定期同步 JCR 数据
3. 中科院分区表年度更新
4. 建立数据更新管道

### 阶段二：数据融合
1. 建立统一 ID 体系（ISSN 为主键）
2. 多源数据对齐与冲突解决
3. 学科分类标准化（采用教育部学科分类）

### 阶段三：功能扩展
1. 支持按学科筛选
2. 支持多标准对比（如 CCF vs JCR）
3. 智能推荐（根据研究方向推荐刊会）
4. 投稿经验分享社区

### 阶段四：国际化
1. 支持英文界面
2. 接入国际常用标准（如 Scopus CiteScore）
3. 支持多语言期刊名

## 五、注意事项

1. **版权问题**: JCR、Scopus 等商业数据库需要订阅，注意使用许可
2. **更新频率**: 不同数据源更新周期不同，需建立自动更新机制
3. **数据质量**: 多源数据可能存在冲突，需要人工审核规则
4. **性能考虑**: 数据量增大后需要考虑搜索性能优化

## 六、参考资源

- [Clarivate Master Journal List](https://mjl.clarivate.com/)
- [Journal Citation Reports](https://jcr.clarivate.com/)
- [中科院分区表](https://www.fenqubiao.com/)
- [Scopus Sources](https://www.scopus.com/sources)
- [DOAJ](https://doaj.org)
- [LetPub](https://www.letpub.com.cn/)
- [MedSci](https://www.medsci.cn/)
