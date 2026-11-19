from sentence_transformers import SentenceTransformer

from app.config import settings
from app.errors import ApiError

_model: SentenceTransformer | None = None


def ensure_ai_enabled() -> None:
    if not settings.ai_enabled:
        raise ApiError(
            http_status=503,
            error_code="AI_DISABLED",
            message="Tính năng AI hiện đang tắt theo cấu hình hệ thống.",
        )


def get_embedding_model() -> SentenceTransformer:
    global _model
    ensure_ai_enabled()
    if _model is None:
        _model = SentenceTransformer(
            settings.embedding_model,
            device=settings.ai_device,
        )
    return _model


def embed_texts(texts: list[str]) -> list[list[float]]:
    ensure_ai_enabled()
    if not texts:
        return []
    model = get_embedding_model()
    embeddings = model.encode(texts, normalize_embeddings=True)
    return [vec.tolist() for vec in embeddings]
