"use client";

import { useState, useEffect, type ReactNode } from "react";
import { Library, Plus, Search, Trash2, Tag, Clock, Sparkles, Map, FileText } from "lucide-react";
import { Card, CardHeader, CardTitle, Input, Textarea, Button, Badge } from "@research-copilot/ui";
import { knowledgeApi } from "@/lib/client";
import type { KnowledgeNote, ResearchInterest } from "@research-copilot/types";

const sourceIcons: Record<string, ReactNode> = {
  manual: <Tag className="w-3 h-3" />,
  paper_analysis: <FileText className="w-3 h-3" />,
  planner: <Map className="w-3 h-3" />,
  survey: <Sparkles className="w-3 h-3" />,
  reproduction: <Sparkles className="w-3 h-3" />,
};

const sourceLabels: Record<string, string> = {
  manual: "手动",
  paper_analysis: "论文分析",
  planner: "学习路径",
  survey: "文献综述",
  reproduction: "复现指导",
};

export default function KnowledgePage() {
  const [notes, setNotes] = useState<KnowledgeNote[]>([]);
  const [interests, setInterests] = useState<ResearchInterest[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showAddNote, setShowAddNote] = useState(false);
  const [showAddInterest, setShowAddInterest] = useState(false);
  const [newNote, setNewNote] = useState({ title: "", content: "", tags: "" });
  const [newInterest, setNewInterest] = useState({ topic: "", keywords: "" });
  const [saving, setSaving] = useState(false);
  const [generatingPlan, setGeneratingPlan] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"notes" | "interests">("notes");
  const [searchResults, setSearchResults] = useState<KnowledgeNote[] | null>(null);
  const [searching, setSearching] = useState(false);

  const fetchData = async () => {
    try {
      const [notesData, interestsData] = await Promise.all([
        knowledgeApi.listNotes() as Promise<KnowledgeNote[]>,
        knowledgeApi.listInterests() as Promise<ResearchInterest[]>,
      ]);
      setNotes(notesData);
      setInterests(interestsData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSearch = async () => {
    if (!search.trim()) { setSearchResults(null); return; }
    setSearching(true);
    try {
      const res = await knowledgeApi.search(search) as { results: Array<{ id: string; title: string; content: string; source: string; distance: number }> };
      // Map to KnowledgeNote shape
      const mapped = res.results.map((r) => ({
        id: r.id, title: r.title, content: r.content,
        source_type: "search", source_id: undefined, tags: [],
        research_interest_id: undefined,
        created_at: "", updated_at: "",
      })) as KnowledgeNote[];
      setSearchResults(mapped);
    } catch {
      // fallback to text search
      const filtered = notes.filter((n) =>
        n.title.toLowerCase().includes(search.toLowerCase()) ||
        n.content.toLowerCase().includes(search.toLowerCase())
      );
      setSearchResults(filtered);
    } finally {
      setSearching(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.title.trim() || !newNote.content.trim()) return;
    setSaving(true);
    try {
      await knowledgeApi.createNote({
        title: newNote.title,
        content: newNote.content,
        tags: newNote.tags.split(/[,，]+/).filter(Boolean),
      });
      setNewNote({ title: "", content: "", tags: "" });
      setShowAddNote(false);
      await fetchData();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleAddInterest = async () => {
    if (!newInterest.topic.trim()) return;
    setSaving(true);
    try {
      await knowledgeApi.createInterest(
        newInterest.topic,
        newInterest.keywords.split(/[,，]+/).filter(Boolean)
      );
      setNewInterest({ topic: "", keywords: "" });
      setShowAddInterest(false);
      await fetchData();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleGeneratePlan = async (id: string) => {
    setGeneratingPlan(id);
    try {
      await knowledgeApi.generatePlan(id);
      await fetchData();
    } catch (e) {
      console.error(e);
    } finally {
      setGeneratingPlan(null);
    }
  };

  const handleDeleteNote = async (id: string) => {
    if (!confirm("确认删除？")) return;
    try {
      await knowledgeApi.deleteNote(id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
    } catch {}
  };

  const displayedNotes = searchResults !== null ? searchResults : notes;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
            <Library className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">个人知识库</h1>
            <p className="text-sm text-gray-500">统一归档研究笔记，支持语义搜索与问答</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setShowAddInterest(!showAddInterest)}>
            <Map className="w-4 h-4" />
            新增方向
          </Button>
          <Button size="sm" onClick={() => setShowAddNote(!showAddNote)}>
            <Plus className="w-4 h-4" />
            新增笔记
          </Button>
        </div>
      </div>

      {/* Add forms */}
      {showAddNote && (
        <Card className="mb-5">
          <CardHeader><CardTitle>新增笔记</CardTitle></CardHeader>
          <div className="space-y-3">
            <Input placeholder="请输入笔记标题" value={newNote.title} onChange={(e) => setNewNote({ ...newNote, title: e.target.value })} />
            <Textarea rows={5} placeholder="请输入笔记内容（支持 Markdown）" value={newNote.content} onChange={(e) => setNewNote({ ...newNote, content: e.target.value })} />
            <Input placeholder="请输入标签，多个标签用逗号分隔" value={newNote.tags} onChange={(e) => setNewNote({ ...newNote, tags: e.target.value })} />
            <div className="flex gap-2">
              <Button onClick={handleAddNote} loading={saving} size="sm">保存</Button>
              <Button variant="ghost" size="sm" onClick={() => setShowAddNote(false)}>取消</Button>
            </div>
          </div>
        </Card>
      )}

      {showAddInterest && (
        <Card className="mb-5">
          <CardHeader><CardTitle>新增研究方向</CardTitle></CardHeader>
          <div className="space-y-3">
            <Input placeholder="请输入研究方向" value={newInterest.topic} onChange={(e) => setNewInterest({ ...newInterest, topic: e.target.value })} />
            <Input placeholder="请输入关键词，多个关键词用逗号分隔" value={newInterest.keywords} onChange={(e) => setNewInterest({ ...newInterest, keywords: e.target.value })} />
            <div className="flex gap-2">
              <Button onClick={handleAddInterest} loading={saving} size="sm">保存</Button>
              <Button variant="ghost" size="sm" onClick={() => setShowAddInterest(false)}>取消</Button>
            </div>
          </div>
        </Card>
      )}

      {/* Search */}
      <div className="flex gap-2 mb-5">
        <Input
          placeholder="请输入关键词搜索知识库"
          value={search}
          onChange={(e) => { setSearch(e.target.value); if (!e.target.value) setSearchResults(null); }}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          className="flex-1"
        />
        <Button variant="secondary" onClick={handleSearch} loading={searching}>
          <Search className="w-4 h-4" />
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-gray-200">
        {[
          { key: "notes", label: `笔记 (${notes.length})` },
          { key: "interests", label: `研究方向 (${interests.length})` },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as "notes" | "interests")}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === key ? "border-brand-600 text-brand-700" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">正在加载...</div>
      ) : activeTab === "notes" ? (
        <div className="space-y-3">
          {displayedNotes.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Library className="w-10 h-10 mx-auto mb-2 opacity-30" />
              {searchResults !== null ? "未找到相关笔记" : "暂无笔记，导入论文或新建笔记后会自动归档"}
            </div>
          ) : (
            displayedNotes.map((note) => (
              <Card key={note.id} padding="sm">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 text-sm mb-1 line-clamp-1">{note.title}</h3>
                    <p className="text-xs text-gray-500 line-clamp-2 mb-2">{note.content}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      {note.source_type && (
                        <Badge variant="default" className="gap-1">
                          {sourceIcons[note.source_type]}
                          {sourceLabels[note.source_type] || note.source_type}
                        </Badge>
                      )}
                      {note.tags?.map((t, i) => (
                        <Badge key={i} variant="info">{t}</Badge>
                      ))}
                      {note.created_at && (
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(note.created_at).toLocaleDateString("zh-CN")}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleDeleteNote(note.id)}
                    className="text-gray-300 hover:text-red-500 hover:bg-red-50 flex-shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {interests.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Map className="w-10 h-10 mx-auto mb-2 opacity-30" />
              暂无研究方向，请先新建研究方向。
            </div>
          ) : (
            interests.map((interest) => (
              <Card key={interest.id}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">{interest.topic}</h3>
                    {interest.keywords && interest.keywords.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {interest.keywords.map((k, i) => (
                          <Badge key={i} variant="info">{k}</Badge>
                        ))}
                      </div>
                    )}
                    {interest.learning_path && (
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {(interest.learning_path as { overview?: string }).overview}
                      </p>
                    )}
                  </div>
                  {!interest.learning_path && (
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={generatingPlan === interest.id}
                      onClick={() => handleGeneratePlan(interest.id)}
                      className="flex-shrink-0"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      生成学习路径
                    </Button>
                  )}
                  {interest.learning_path && (
                    <Badge variant="success">已有路径</Badge>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
