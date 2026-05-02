import Foundation

enum DefaultSettings {
    static let all: [String: String] = {
        var s: [String: String] = [:]

        // Main LLM
        s["llm_provider"] = "openai"
        s["openai_base_url"] = "https://api.openai.com/v1"
        s["openai_api_key"] = ""
        s["openai_model"] = "gpt-4o"
        s["anthropic_base_url"] = "https://api.anthropic.com"
        s["anthropic_api_key"] = ""
        s["anthropic_model"] = "claude-sonnet-4-20250514"
        s["openai_compatible_base_url"] = ""
        s["openai_compatible_api_key"] = ""
        s["openai_compatible_model"] = ""

        // Vision
        s["vision_model"] = ""
        s["vision_base_url"] = ""
        s["vision_api_key"] = ""
        s["vision_temperature"] = "0.2"

        // Translation
        s["translation_model"] = ""
        s["translation_base_url"] = ""
        s["translation_api_key"] = ""
        s["translation_temperature"] = "0.1"

        // Embedding
        s["embedding_model"] = "text-embedding-3-small"
        s["embedding_base_url"] = ""
        s["embedding_api_key"] = ""
        s["embedding_batch_size"] = "20"
        s["rag_top_k"] = "5"

        // Copilot
        s["copilot_simple_model"] = ""
        s["copilot_simple_base_url"] = ""
        s["copilot_simple_api_key"] = ""
        s["copilot_simple_temperature"] = "0.4"

        // Planner hint / analysis / generation（流光/谋策卡）
        s["planner_hint_model"] = ""
        s["planner_hint_base_url"] = ""
        s["planner_hint_api_key"] = ""
        s["planner_hint_temperature"] = "0.2"

        s["planner_analysis_model"] = ""
        s["planner_analysis_base_url"] = ""
        s["planner_analysis_api_key"] = ""
        s["planner_analysis_temperature"] = "0.2"

        s["planner_generation_model"] = ""
        s["planner_generation_base_url"] = ""
        s["planner_generation_api_key"] = ""
        s["planner_generation_temperature"] = "0.3"

        // Multi-agent
        s["multi_agent_enabled"] = "true"
        s["multi_agent_routing_mode"] = "hybrid"
        s["multi_agent_enabled_agents"] = "planner,literature_scout,survey,paper_analyst,reproduction"

        // Per-agent models
        s["multi_agent_supervisor_model"] = ""
        s["multi_agent_supervisor_base_url"] = ""
        s["multi_agent_supervisor_api_key"] = ""
        s["multi_agent_supervisor_temperature"] = "0.1"

        s["multi_agent_synthesis_model"] = ""
        s["multi_agent_synthesis_base_url"] = ""
        s["multi_agent_synthesis_api_key"] = ""
        s["multi_agent_synthesis_temperature"] = "0.4"

        s["multi_agent_worker_model"] = ""
        s["multi_agent_worker_base_url"] = ""
        s["multi_agent_worker_api_key"] = ""
        s["multi_agent_worker_temperature"] = "0.3"

        s["multi_agent_planner_model"] = ""
        s["multi_agent_planner_base_url"] = ""
        s["multi_agent_planner_api_key"] = ""
        s["multi_agent_planner_temperature"] = ""

        s["multi_agent_literature_scout_model"] = ""
        s["multi_agent_literature_scout_base_url"] = ""
        s["multi_agent_literature_scout_api_key"] = ""
        s["multi_agent_literature_scout_temperature"] = ""

        s["multi_agent_survey_model"] = ""
        s["multi_agent_survey_base_url"] = ""
        s["multi_agent_survey_api_key"] = ""
        s["multi_agent_survey_temperature"] = ""

        s["multi_agent_paper_analyst_model"] = ""
        s["multi_agent_paper_analyst_base_url"] = ""
        s["multi_agent_paper_analyst_api_key"] = ""
        s["multi_agent_paper_analyst_temperature"] = ""

        s["multi_agent_reproduction_model"] = ""
        s["multi_agent_reproduction_base_url"] = ""
        s["multi_agent_reproduction_api_key"] = ""
        s["multi_agent_reproduction_temperature"] = ""

        // Survey
        s["survey_planner_model"] = ""
        s["survey_planner_base_url"] = ""
        s["survey_planner_api_key"] = ""
        s["survey_planner_temperature"] = "0.2"
        s["survey_writer_model"] = ""
        s["survey_writer_base_url"] = ""
        s["survey_writer_api_key"] = ""
        s["survey_writer_temperature"] = "0.3"

        // Paper
        s["paper_analysis_model"] = ""
        s["paper_analysis_base_url"] = ""
        s["paper_analysis_api_key"] = ""
        s["paper_analysis_temperature"] = "0.3"
        s["paper_reproduction_model"] = ""
        s["paper_reproduction_base_url"] = ""
        s["paper_reproduction_api_key"] = ""
        s["paper_reproduction_temperature"] = "0.25"

        // Chunking
        s["chunk_size"] = "800"
        s["chunk_overlap"] = "150"

        // Memory
        s["xiaoyan_long_term_memory_enabled"] = "true"

        // External
        s["semantic_scholar_api_key"] = ""
        s["paper_search_engine"] = "arxiv"

        // Paper import recognition
        s["paper_import_recognize_title"] = "true"
        s["paper_import_recognize_authors"] = "true"
        s["paper_import_recognize_year"] = "true"
        s["paper_import_recognize_venue"] = "true"
        s["paper_import_recognize_keywords"] = "true"
        s["paper_visible_venue_tags"] = "ccf_rating,ccf_type,wos_indexes,jcr_quartile,cas_quartile,cas_top"

        // Layout
        s["layout_mode"] = "landscape"

        // Graph RAG
        s["graph_rag_enabled"] = "false"

        // Agent routing keywords (Chinese)
        s["agent_routing_keywords_planner"] = "规划,学习,路径,方向,研究方向"
        s["agent_routing_keywords_literature_scout"] = "推荐,文献,论文,找论文,相似"
        s["agent_routing_keywords_survey"] = "综述,综述论文,系统综述"
        s["agent_routing_keywords_paper_analyst"] = "分析,解读,精读,论文分析"
        s["agent_routing_keywords_reproduction"] = "复现,复现指南,代码,实现"

        return s
    }()
}
