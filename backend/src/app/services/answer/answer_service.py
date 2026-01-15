"""Answer verification service using NLP and fuzzy matching."""

import logging
import re

import psutil
import spacy
from rapidfuzz import fuzz
from sentence_transformers import SentenceTransformer, util

logger = logging.getLogger(__name__)

# Matching thresholds
EMBEDDINGS_THRESHOLD = 0.8
FUZZY_THRESHOLD = 85


def _normalize(text: str) -> str:
    """Lowercase, strip, remove punctuation and extra spaces."""
    text = text.lower().strip()
    text = re.sub(r"[^\w\s]", "", text)
    text = re.sub(r"\s+", " ", text)
    return text


class AnswerService:
    """Verifies trivia answers using fuzzy matching, embeddings, and lemmatization."""

    def __init__(
        self,
        nlp_model: spacy.language.Language | None = None,
        embedding_model: SentenceTransformer | None = None,
        threshold: float = EMBEDDINGS_THRESHOLD,
    ):
        """Initialize service with NLP models.

        Args:
            nlp_model: Pre-loaded spaCy model (loads default if None)
            embedding_model: Pre-loaded sentence transformer (loads default if None)
            threshold: Embedding similarity threshold for correct answers
        """
        self.threshold = threshold
        self._load_nlp_model(nlp_model)
        self._load_embedding_model(embedding_model)

    def _load_nlp_model(self, nlp_model: spacy.language.Language | None) -> None:
        """Load spaCy NLP model."""
        if nlp_model is not None:
            self.nlp = nlp_model
            return

        process = psutil.Process()
        mem_before = process.memory_info().rss / (1024 * 1024)
        logger.info("Loading spaCy model... (RAM: %.1f MB)", mem_before)

        self.nlp = spacy.load("en_core_web_sm")

        mem_after = process.memory_info().rss / (1024 * 1024)
        logger.info(
            "spaCy loaded. (RAM: %.1f MB, delta: %.1f MB)",
            mem_after,
            mem_after - mem_before,
        )

    def _load_embedding_model(
        self, embedding_model: SentenceTransformer | None
    ) -> None:
        """Load sentence transformer embedding model."""
        if embedding_model is not None:
            self.model = embedding_model
            return

        process = psutil.Process()
        mem_before = process.memory_info().rss / (1024 * 1024)
        logger.info("Loading embeddings model... (RAM: %.1f MB)", mem_before)

        self.model = SentenceTransformer("all-MiniLM-L6-v2")

        mem_after = process.memory_info().rss / (1024 * 1024)
        logger.info(
            "Embeddings loaded. (RAM: %.1f MB, delta: %.1f MB)",
            mem_after,
            mem_after - mem_before,
        )

    def _lemmatize(self, text: str) -> str:
        """Return lemmatized version of the text."""
        doc = self.nlp(text)
        return " ".join(token.lemma_ for token in doc)

    def _fuzzy_score(self, a: str, b: str) -> float:
        """Return fuzzy similarity score (0-100)."""
        return fuzz.ratio(a, b)

    def _embedding_similarity(self, a: str, b: str) -> float:
        """Return embedding cosine similarity (0-1)."""
        emb1 = self.model.encode(a, convert_to_tensor=True)
        emb2 = self.model.encode(b, convert_to_tensor=True)
        return util.cos_sim(emb1, emb2).item()

    def _is_number(self, s: str) -> bool:
        """Check if string represents a number."""
        try:
            float(s)
            return True
        except ValueError:
            return False

    def is_correct(self, user_answer: str, correct_answer: str) -> bool:
        """Check if user's answer is correct.

        Uses multiple strategies:
        - Exact match for numeric answers
        - Fuzzy string matching for typos
        - Semantic similarity for synonyms

        Args:
            user_answer: The user's submitted answer
            correct_answer: The expected correct answer

        Returns:
            True if answer is considered correct
        """
        ua_norm = _normalize(user_answer)
        ca_norm = _normalize(correct_answer)

        # Numeric answers require exact match
        if self._is_number(ca_norm):
            return ua_norm == ca_norm

        ua_lemma = self._lemmatize(ua_norm)
        ca_lemma = self._lemmatize(ca_norm)

        fuzzy = self._fuzzy_score(ua_lemma, ca_lemma)
        embedding = self._embedding_similarity(ua_lemma, ca_lemma)

        logger.info(
            "Answer check: user=%r, correct=%r, fuzzy=%.1f, embedding=%.2f",
            user_answer,
            correct_answer,
            fuzzy,
            embedding,
        )

        return fuzzy >= FUZZY_THRESHOLD or embedding >= self.threshold
