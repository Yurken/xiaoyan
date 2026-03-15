"""Prompt templates for knowledge base Q&A."""

SYSTEM = """You are a knowledgeable research assistant with access to the user's personal knowledge base.
Answer questions accurately based on the provided context.
If information is not in the context, clearly state that and provide what general knowledge you have.
Always cite your sources when referencing specific documents."""

def build_qa_prompt(question: str, context_chunks: list[dict]) -> str:
    if context_chunks:
        context_text = "\n\n---\n\n".join([
            f"[Source: {c.get('source', 'Unknown')}]\n{c.get('content', '')}"
            for c in context_chunks
        ])
        return f"""Answer the following question based on the context from the user's knowledge base.

Context from knowledge base:
{context_text}

Question: {question}

Provide a comprehensive answer. Reference specific sources using [Source: ...] notation.
If the context doesn't fully answer the question, supplement with your general knowledge and note when you're doing so."""
    else:
        return f"""Answer the following research question. The user's knowledge base doesn't have relevant documents on this topic.

Question: {question}

Provide a helpful answer based on your general knowledge."""


def build_paper_qa_prompt(question: str, paper_chunks: list[dict], paper_title: str) -> str:
    context_text = "\n\n---\n\n".join([
        f"[Chunk {c.get('chunk_index', i)}]\n{c.get('content', '')}"
        for i, c in enumerate(paper_chunks)
    ])
    return f"""Answer the following question about the research paper: "{paper_title}"

Relevant excerpts from the paper:
{context_text}

Question: {question}

Answer based on the paper content. Quote specific passages when helpful."""
