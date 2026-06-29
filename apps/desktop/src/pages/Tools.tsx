import { FileText, FileSearch, Globe2, Languages, Presentation, Sparkles } from "lucide-react";
import { usePersistentStringState } from "../hooks/usePersistentStringState";
import { ArxivFieldSearchPanel } from "../features/tools/ArxivFieldSearchPanel";
import { ArxivSearchResults } from "../features/tools/ArxivSearchResults";
import { FriendLinksPanel } from "../features/tools/FriendLinksPanel";
import { PaperDiscoveryPanel } from "../features/tools/PaperDiscoveryPanel";
import { MarkdownFormatterPanel } from "../features/tools/MarkdownFormatterPanel";
import { CapsuleTabs } from "@research-copilot/ui";
import { PptWorkspace } from "../features/tools/PptWorkspace";
import { SourceLookupPanel } from "../features/tools/SourceLookupPanel";
import { useArxivFieldSearch } from "../features/tools/useArxivFieldSearch";
import { useFriendLinks } from "../features/tools/useFriendLinks";
import { useMarkdownFormatter } from "../features/tools/useMarkdownFormatter";
import { usePaperDiscoverySearch } from "../features/tools/usePaperDiscoverySearch";
import { usePptGenerator } from "../features/tools/usePptGenerator";
import { useSourceLookup } from "../features/tools/useSourceLookup";
import { useTranslationTool } from "../features/tools/useTranslationTool";
import { TranslationPanel } from "../features/tools/TranslationPanel";
import { WebSupplementPanel } from "../features/tools/WebSupplementPanel";
import { useWebSupplement } from "../features/tools/useWebSupplement";

const TOOL_TABS = [
  { key: "arxiv", icon: <Sparkles className="h-4 w-4" />, label: "论文检索" },
  { key: "source", icon: <FileSearch className="h-4 w-4" />, label: "刊会查询" },
  { key: "translate", icon: <Languages className="h-4 w-4" />, label: "学术翻译" },
  { key: "md", icon: <FileText className="h-4 w-4" />, label: "MD 整理" },
  { key: "ppt", icon: <Presentation className="h-4 w-4" />, label: "生成 PPT" },
  { key: "links", icon: <Globe2 className="h-4 w-4" />, label: "科研友链" },
] as const;

type ToolTabKey = (typeof TOOL_TABS)[number]["key"];
const TOOL_TAB_KEYS = TOOL_TABS.map((tab) => tab.key);

export default function Tools() {
  const {
    query: sourceQuery,
    sections: sourceSections,
    loading: sourceLoading,
    error: sourceError,
    searched: sourceSearched,
    setQuery: setSourceQuery,
    submit: handleSourceLookup,
  } = useSourceLookup();
  const paperDiscovery = usePaperDiscoverySearch();
  const webSupplement = useWebSupplement();
  const arxivFieldSearch = useArxivFieldSearch();

  const webSupplementSeed = [
    paperDiscovery.panelProps.allTerms,
    paperDiscovery.panelProps.titleTerms,
    paperDiscovery.panelProps.abstractTerms,
    paperDiscovery.panelProps.topic,
  ]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(", ");
  const friendLinks = useFriendLinks();
  const [activeTab, setActiveTab] = usePersistentStringState<ToolTabKey>(
    "rc:tools:active-tab",
    "arxiv",
    TOOL_TAB_KEYS,
  );

  const {
    input: mdInput,
    result: mdResult,
    processing: mdProcessing,
    error: mdError,
    progress: mdProgress,
    setInput: setMdInput,
    submit: handleMdFormat,
    upload: handleMdUpload,
    save: handleMdSave,
  } = useMarkdownFormatter();
  const {
    input: translateInput,
    result: translateResult,
    loading: translateLoading,
    error: translateError,
    sourceLang: translateSourceLang,
    targetLang: translateTargetLang,
    setInput: setTranslateInput,
    setSourceLang: setTranslateSourceLang,
    setTargetLang: setTranslateTargetLang,
    submit: handleTranslate,
  } = useTranslationTool();
  const {
    featureDisabled: pptFeatureDisabled,
    mode: pptMode,
    topic: pptTopic,
    outline: pptOutline,
    documentName: pptDocName,
    documentLoading: pptDocLoading,
    documentError: pptDocError,
    hasDocumentContent: pptHasDocumentContent,
    documentCharacterCount: pptDocumentCharacterCount,
    styleValue: pptStyle,
    customStyle: pptCustomStyle,
    language: pptLang,
    pageCount: pptPages,
    customPages: pptCustomPages,
    fileBaseName: pptFileBaseName,
    generateDisabledReason: pptGenerateDisabledReason,
    pptData,
    status: pptStatus,
    slideCount: pptSlideCount,
    error: pptError,
    setMode: setPptMode,
    setTopic: setPptTopic,
    setOutline: setPptOutline,
    setStyleValue: setPptStyle,
    setCustomStyle: setPptCustomStyle,
    setLanguage: setPptLang,
    setPageCount: setPptPages,
    setCustomPages: setPptCustomPages,
    resetDocument: resetPptDocument,
    handleDocumentDrop: handlePptDocumentDrop,
    handleDocumentPick: handlePptDocumentPick,
    generate: handlePptGenerate,
    download: handlePptDownload,
  } = usePptGenerator();

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: "var(--rc-surface)" }}>
      <div className="shrink-0 px-6 pt-4 pb-3">
        <CapsuleTabs
          options={TOOL_TABS.map((t) => ({ value: t.key, label: t.label, icon: t.icon }))}
          value={activeTab}
          onChange={(v) => setActiveTab(v as ToolTabKey)}
        />
      </div>

      <div className="flex-1 overflow-y-auto px-6 pt-3 pb-6 space-y-5">

      {activeTab === "arxiv" && <>
      <PaperDiscoveryPanel {...paperDiscovery.panelProps} />

      <ArxivSearchResults
        {...paperDiscovery.resultProps}
        expressionLabel="本次查询表达式"
        emptyMatchHint="建议增加最近天数，或放宽标题词、摘要词和领域标签条件。"
        emptySearchHint="检查检索字段和时间窗口后重试。"
        detailActionLabel="详情"
        detailActionTitle="打开论文详情页"
        pdfActionLabel="PDF"
        pdfActionTitle="打开论文 PDF"
      />

      <WebSupplementPanel
        seedQuery={webSupplementSeed}
        outcome={webSupplement.outcome}
        loading={webSupplement.loading}
        error={webSupplement.error}
        searched={webSupplement.searched}
        onRun={() => webSupplement.run(webSupplementSeed)}
      />

      <ArxivFieldSearchPanel {...arxivFieldSearch.panelProps} />

      <ArxivSearchResults
        {...arxivFieldSearch.resultProps}
        expressionLabel="官方 arXiv 查询式"
        emptyMatchHint="建议增加最近天数，或放宽标题词、摘要词和分类条件。"
        emptySearchHint="检查检索字段和时间窗口后重试。"
        detailActionLabel="abs"
        detailActionTitle="打开 arXiv 摘要页"
        pdfActionLabel="pdf"
        pdfActionTitle="打开 arXiv PDF"
      />
      </>}

      {activeTab === "source" ? (
        <SourceLookupPanel
          query={sourceQuery}
          sections={sourceSections}
          loading={sourceLoading}
          error={sourceError}
          searched={sourceSearched}
          onQueryChange={setSourceQuery}
          onSubmit={handleSourceLookup}
        />
      ) : null}

      {activeTab === "translate" ? (
        <TranslationPanel
          input={translateInput}
          result={translateResult}
          loading={translateLoading}
          error={translateError}
          sourceLang={translateSourceLang}
          targetLang={translateTargetLang}
          onInputChange={setTranslateInput}
          onSourceLangChange={setTranslateSourceLang}
          onTargetLangChange={setTranslateTargetLang}
          onSubmit={handleTranslate}
        />
      ) : null}

      {activeTab === "md" ? (
        <MarkdownFormatterPanel
          input={mdInput}
          result={mdResult}
          processing={mdProcessing}
          error={mdError}
          progress={mdProgress}
          onInputChange={setMdInput}
          onUpload={handleMdUpload}
          onSubmit={handleMdFormat}
          onSave={handleMdSave}
        />
      ) : null}

      {activeTab === "ppt" ? (
        <PptWorkspace
          featureDisabled={pptFeatureDisabled}
          mode={pptMode}
          topic={pptTopic}
          outline={pptOutline}
          documentName={pptDocName}
          documentLoading={pptDocLoading}
          documentError={pptDocError}
          hasDocumentContent={pptHasDocumentContent}
          documentCharacterCount={pptDocumentCharacterCount}
          styleValue={pptStyle}
          customStyle={pptCustomStyle}
          language={pptLang}
          pageCount={pptPages}
          customPages={pptCustomPages}
          fileBaseName={pptFileBaseName}
          generateDisabledReason={pptGenerateDisabledReason}
          resultData={pptData}
          status={pptStatus}
          slideCount={pptSlideCount}
          error={pptError}
          onModeChange={setPptMode}
          onTopicChange={setPptTopic}
          onOutlineChange={setPptOutline}
          onDocumentDrop={handlePptDocumentDrop}
          onPickDocument={handlePptDocumentPick}
          onResetDocument={resetPptDocument}
          onStyleChange={setPptStyle}
          onCustomStyleChange={setPptCustomStyle}
          onLanguageChange={setPptLang}
          onPageCountChange={setPptPages}
          onCustomPagesChange={setPptCustomPages}
          onGenerate={handlePptGenerate}
          onDownload={handlePptDownload}
        />
      ) : null}

      {activeTab === "links" ? (
        <FriendLinksPanel {...friendLinks.panelProps} />
      ) : null}

      </div>
    </div>
  );
}
