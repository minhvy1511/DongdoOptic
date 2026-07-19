from pydantic import BaseModel


class Landmark(BaseModel):
    x: float
    y: float
    z: float | None = None


class AnalyzeRequest(BaseModel):
    landmarks: list[Landmark]


class LensAdviceRequest(BaseModel):
    pd: float | None = None
    sph: float | None = None
    cyl: float | None = None
    frame_width_mm: float | None = None


class CustomerRecord(BaseModel):
    customer_code: str | None = None
    session_code: str | None = None
    customer_name: str | None = None
    customer_phone: str | None = None
    consult_date: str | None = None
    age_group: str | None = None
    customer_notes: str | None = None
    customer_status: str | None = None
    frame_width_mm: float | None = None
    has_prescription: bool | None = None
    prescription: dict | None = None
    preferences: dict | None = None
    analysis: dict | None = None
    recommendations: list[dict] | None = None
    lens_recommendations: list[dict] | None = None
    snapshot: dict | None = None
    created_at: str | None = None
