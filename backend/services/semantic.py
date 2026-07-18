"""
Semantic scheme search — lets non-technical / low-literacy citizens describe a
need in their own words (often via the voice IVR, transcribed) and find the
right schemes even with zero keyword overlap:

    "paisa for my daughter's studies"  →  scholarship schemes

How it stays fast: scheme vectors are PRECOMPUTED at ingest time and held in
memory. A search only embeds the short query and does a cosine similarity —
no per-query model work over the catalog, no latency on the user's path.

Embedder selection (privacy-first for a government deployment — queries stay
on our infra, not sent to a third party):
  1. SentenceTransformer (neural, true semantic) if installed  ← recommended
  2. scikit-learn TF-IDF (lexical) fallback so the feature always works
"""

import logging
import re
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

from core.config import settings

logger = logging.getLogger(__name__)


def _scheme_text(s: Dict[str, Any]) -> str:
    """The searchable text for a scheme (name + benefit + category + docs)."""
    b = s.get("benefits", {})
    desc = b.get("description", "") if isinstance(b, dict) else str(b)
    parts = [
        s.get("name", ""), desc, s.get("category", ""),
        " ".join(s.get("documents_required", []) or []),
        s.get("ministry", ""),
    ]
    return re.sub(r"\s+", " ", " ".join(p for p in parts if p)).strip()


class _NeuralEmbedder:
    """SentenceTransformer embedder — true semantic similarity."""
    kind = "neural"

    def __init__(self, model_name: str):
        from sentence_transformers import SentenceTransformer
        self._model = SentenceTransformer(model_name)

    def embed(self, texts: List[str]) -> np.ndarray:
        return np.asarray(self._model.encode(texts, normalize_embeddings=True))

    def similarity(self, corpus_vecs: np.ndarray, query_vec: np.ndarray) -> np.ndarray:
        # vectors are L2-normalised → cosine = dot product
        return corpus_vecs @ query_vec.reshape(-1)


class _TfidfEmbedder:
    """scikit-learn TF-IDF fallback — lexical, no model download."""
    kind = "tfidf"

    def __init__(self):
        from sklearn.feature_extraction.text import TfidfVectorizer
        self._vectorizer = TfidfVectorizer(stop_words="english", ngram_range=(1, 2))
        self._fitted = False

    def fit(self, corpus: List[str]) -> np.ndarray:
        mat = self._vectorizer.fit_transform(corpus)
        self._fitted = True
        return mat  # sparse

    def embed_query(self, text: str):
        return self._vectorizer.transform([text])

    def similarity(self, corpus_mat, query_mat) -> np.ndarray:
        from sklearn.metrics.pairwise import cosine_similarity
        return cosine_similarity(corpus_mat, query_mat).reshape(-1)


class SemanticIndex:
    """In-memory precomputed index over the current scheme set."""

    def __init__(self):
        self._embedder = None
        self._scheme_ids: List[str] = []
        self._corpus_repr = None          # neural: np.ndarray | tfidf: sparse matrix
        self._fingerprint: Optional[str] = None
        self._kind = "none"

    def _make_embedder(self):
        choice = (settings.semantic_embedder or "auto").lower()
        if choice == "tfidf":
            return _TfidfEmbedder()
        try:
            return _NeuralEmbedder(settings.embedding_model)
        except Exception as exc:
            if choice == "neural":
                raise
            logger.warning("Neural embedder unavailable (%s); using TF-IDF fallback", exc)
            return _TfidfEmbedder()

    @staticmethod
    def _compute_fingerprint(schemes: List[Dict]) -> str:
        return str(len(schemes)) + ":" + ",".join(sorted(s.get("scheme_id", "") for s in schemes))

    def build(self, schemes: List[Dict]) -> None:
        if not schemes:
            self._scheme_ids, self._corpus_repr, self._fingerprint = [], None, ""
            return
        self._embedder = self._make_embedder()
        self._kind = self._embedder.kind
        self._scheme_ids = [s.get("scheme_id", "") for s in schemes]
        corpus = [_scheme_text(s) for s in schemes]
        if self._kind == "neural":
            self._corpus_repr = self._embedder.embed(corpus)
        else:
            self._corpus_repr = self._embedder.fit(corpus)
        self._fingerprint = self._compute_fingerprint(schemes)
        logger.info("Semantic index built: %d schemes (%s)", len(schemes), self._kind)

    def ensure(self, schemes: List[Dict]) -> None:
        """Rebuild only if the scheme set changed (cheap fingerprint check)."""
        if self._fingerprint != self._compute_fingerprint(schemes):
            self.build(schemes)

    def search(self, query: str, top_k: int = 10) -> List[Tuple[str, float]]:
        """Return [(scheme_id, score)] ranked by semantic similarity to the query."""
        if self._corpus_repr is None or not self._scheme_ids:
            return []
        if self._kind == "neural":
            qv = self._embedder.embed([query])[0]
            sims = self._embedder.similarity(self._corpus_repr, qv)
        else:
            qm = self._embedder.embed_query(query)
            sims = self._embedder.similarity(self._corpus_repr, qm)
        order = np.argsort(sims)[::-1][:top_k]
        return [(self._scheme_ids[i], round(float(sims[i]), 4)) for i in order]

    def status(self) -> Dict[str, Any]:
        return {"kind": self._kind, "indexed": len(self._scheme_ids)}


# Module-level singleton index.
_index = SemanticIndex()


def reindex(schemes: List[Dict]) -> None:
    _index.build(schemes)


def search(query: str, top_k: int = 10) -> List[Tuple[str, float]]:
    from services.scheme_cache import get_schemes
    _index.ensure(get_schemes())
    return _index.search(query, top_k)


def status() -> Dict[str, Any]:
    return _index.status()
