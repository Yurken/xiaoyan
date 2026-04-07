import { useState } from "react";
import { FileText, FileSearch, Globe2, Languages, Presentation, Sparkles } from "lucide-react";
import { ArxivFieldSearchPanel } from "../features/tools/ArxivFieldSearchPanel";
import { ArxivSearchResults } from "../features/tools/ArxivSearchResults";
import { FriendLinksPanel } from "../features/tools/FriendLinksPanel";
import { PaperDiscoveryPanel } from "../features/tools/PaperDiscoveryPanel";
import { MarkdownFormatterPanel } from "../features/tools/MarkdownFormatterPanel";
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

const insetShadow = "var(--rc-inset-shadow)";
const raisedShadow = "var(--rc-raised-shadow)";
const TOOL_TABS = [
  { key: "arxiv", icon: <Sparkles className="h-4 w-4" />, label: "论文检索" },
  { key: "source", icon: <FileSearch className="h-4 w-4" />, label: "刊会查询" },
  { key: "translate", icon: <Languages className="h-4 w-4" />, label: "学术翻译" },
  { key: "md", icon: <FileText className="h-4 w-4" />, label: "MD 整理" },
  { key: "ppt", icon: <Presentation className="h-4 w-4" />, label: "生成 PPT" },
  { key: "links", icon: <Globe2 className="h-4 w-4" />, label: "科研友链" },
] as const;

type ToolTabKey = (typeof TOOL_TABS)[number]["key"];

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
  const arxivFieldSearch = useArxivFieldSearch();
  const friendLinks = useFriendLinks();
  const [activeTab, setActiveTab] = useState<ToolTabKey>("arxiv");

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
    <div className="h-full flex flex-col overflow-hidden">
      <div className="shrink-0 px-6 pt-6 pb-4">
        <h1 className="text-2xl font-bold text-ink-primary">实用工具</h1>
        <p className="mt-1 text-sm text-ink-tertiary">
          小妍为你准备了一批科研实用工具，涵盖论文检索、期刊查询、工具生成等场景。
        </p>
      </div>

      <div className="shrink-0 px-6 pb-3">
        <div
          className="inline-flex rounded-2xl p-1 gap-0.5"
          style={{ background: "var(--rc-surface)", boxShadow: insetShadow }}
        >
          {TOOL_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-150"
              style={
                activeTab === tab.key
                  ? { background: "var(--rc-elevated)", boxShadow: raisedShadow, color: "var(--rc-text)" }
                  : { color: "var(--rc-text-muted)" }
              }
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-5">

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
