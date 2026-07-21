from fastapi import APIRouter

from app.api.schemas import AnalyzeRequest, CustomerRecord, FeedbackRecord, LensAdviceRequest
from app.services.customer_store import delete_customer, list_customers, save_customer
from app.services.face_shape_service import analyze_face_shape
from app.services.feedback_store import list_feedback, save_feedback
from app.services.lens_advice_service import recommend_lens_index
from app.services.recommendation_service import get_frame_recommendations

router = APIRouter()


@router.get("/health")
def health_check():
    return {"status": "ok"}


@router.post("/face-shape/analyze")
def analyze_face_shape_endpoint(payload: AnalyzeRequest):
    analysis = analyze_face_shape([landmark.model_dump() for landmark in payload.landmarks])

    return {
        "analysis": analysis,
        "recommendations": get_frame_recommendations(analysis["shape"]),
    }


@router.post("/lens/advice")
def lens_advice(payload: LensAdviceRequest):
    return recommend_lens_index(
        pd=payload.pd,
        sph=payload.sph,
        cyl=payload.cyl,
        frame_width_mm=payload.frame_width_mm,
    )


@router.get("/customers")
def customers():
    return list_customers()


@router.post("/customers")
def upsert_customer(payload: CustomerRecord):
    return save_customer(payload.model_dump())


@router.delete("/customers/{customer_code}")
def remove_customer(customer_code: str):
    deleted = delete_customer(customer_code)
    if not deleted:
        return {"deleted": False}
    return {"deleted": True}


@router.get("/feedback")
def feedback():
    return list_feedback()


@router.post("/feedback")
def create_feedback(payload: FeedbackRecord):
    return save_feedback(payload.model_dump())
