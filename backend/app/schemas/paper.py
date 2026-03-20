from datetime import datetime
from uuid import UUID
from pydantic import BaseModel


class PaperBase(BaseModel):
    title: str
    authors: str | None = None
    abstract: str | None = None
    year: int | None = None
    venue: str | None = None
    doi: str | None = None
    tags: list[str] = []


class PaperCreate(PaperBase):
    pass


class PaperAnalysisOut(BaseModel):
    id: UUID
    research_question: str | None
    core_method: str | None
    experiment_design: str | None
    innovations: str | None
    limitations: str | None
    key_conclusions: str | None
    raw_analysis: dict | None
    created_at: datetime

    class Config:
        from_attributes = True


class ReproductionGuideOut(BaseModel):
    id: UUID
    environment_setup: str | None
    dependencies: str | None
    dataset_preparation: str | None
    training_process: str | None
    inference_process: str | None
    evaluation_metrics: str | None
    risks_and_notes: str | None
    raw_guide: dict | None
    created_at: datetime

    class Config:
        from_attributes = True


class PaperOut(PaperBase):
    id: UUID
    file_path: str | None
    status: str
    created_at: datetime
    updated_at: datetime
    analysis: PaperAnalysisOut | None = None
    reproduction_guide: ReproductionGuideOut | None = None

    class Config:
        from_attributes = True


class PaperListItem(BaseModel):
    id: UUID
    title: str
    authors: str | None
    year: int | None
    venue: str | None
    status: str
    created_at: datetime

    class Config:
        from_attributes = True
