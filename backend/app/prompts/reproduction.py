"""Prompt templates for paper reproduction guide generation."""

SYSTEM = """You are an expert ML engineer who specializes in reproducing research papers.
Generate detailed, practical reproduction guides based on paper content.
Always respond in valid JSON format as specified."""

def build_reproduction_prompt(paper_text: str, analysis: dict | None = None) -> str:
    truncated = paper_text[:10000] if len(paper_text) > 10000 else paper_text
    analysis_text = ""
    if analysis:
        analysis_text = f"""
Paper Analysis Summary:
- Research Question: {analysis.get('research_question', '')}
- Core Method: {analysis.get('core_method', '')}
- Experiment Design: {analysis.get('experiment_design', '')}
"""
    return f"""Generate a comprehensive reproduction guide for the following research paper.

{analysis_text}
Paper Content:
{truncated}

Return a JSON object:
{{
  "environment_setup": {{
    "os": "recommended OS",
    "python_version": "e.g. Python 3.10+",
    "hardware": "GPU/CPU requirements",
    "setup_commands": ["command 1", "command 2"]
  }},
  "dependencies": {{
    "framework": "e.g. PyTorch 2.0",
    "key_packages": [
      {{"package": "name", "version": "version", "purpose": "why needed"}}
    ],
    "install_commands": ["pip install ...", "conda install ..."]
  }},
  "dataset_preparation": {{
    "datasets": [
      {{
        "name": "dataset name",
        "source": "where to download",
        "size": "approximate size",
        "preprocessing": ["step 1", "step 2"]
      }}
    ]
  }},
  "training_process": {{
    "steps": ["step 1", "step 2"],
    "key_hyperparameters": [
      {{"param": "name", "value": "typical value", "note": "explanation"}}
    ],
    "expected_training_time": "estimated time",
    "sample_command": "python train.py --config ..."
  }},
  "inference_process": {{
    "steps": ["step 1", "step 2"],
    "sample_command": "python evaluate.py ..."
  }},
  "evaluation_metrics": [
    {{"metric": "metric name", "description": "what it measures", "expected_value": "paper reported value"}}
  ],
  "risks_and_notes": [
    "potential pitfall or common issue 1",
    "potential pitfall or common issue 2"
  ],
  "official_resources": {{
    "github": "GitHub repo if mentioned",
    "project_page": "project page if mentioned",
    "pretrained_models": "where to find pretrained weights if mentioned"
  }}
}}"""
