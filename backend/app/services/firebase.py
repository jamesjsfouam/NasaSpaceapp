"""Firebase / Firestore (oferta de Google Cloud). Necesita el extra `cloud`.

Usa la cuenta de servicio indicada en GOOGLE_APPLICATION_CREDENTIALS.
"""
from functools import lru_cache

from app.config import get_settings


@lru_cache
def firestore_client():
    import firebase_admin
    from firebase_admin import firestore

    s = get_settings()
    if not firebase_admin._apps:
        options = {"projectId": s.firebase_project_id} if s.firebase_project_id else None
        firebase_admin.initialize_app(options=options)
    return firestore.client()


def save_document(collection: str, data: dict) -> str:
    """Guarda un documento y devuelve su id."""
    _, ref = firestore_client().collection(collection).add(data)
    return ref.id
