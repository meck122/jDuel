# app/services/answer_service.py

import logging
import re

import spacy
from rapidfuzz import fuzz
from sentence_transformers import SentenceTransformer, util

logger = logging.getLogger(__name__)

EMBEDDINGS_THRESHOLD = 0.8
FUZZY_THRESHOLD = 85


def normalize(text: str) -> str:
    """Lowercase, strip, remove punctuation and extra spaces."""
    text = text.lower().strip()
    text = re.sub(r"[^\w\s]", "", text)
    text = re.sub(r"\s+", " ", text)
    return text


class AnswerService:
    """AnswerService for checking trivia answers with fuzzy + embeddings + lemmatization."""

    def __init__(
        self,
        nlp_model: spacy.language.Language | None = None,
        embedding_model: SentenceTransformer | None = None,
        threshold: float = EMBEDDINGS_THRESHOLD,
    ):
        """
        Initialize service with pre-loaded models.
        If models are None, they will be loaded once (slow at startup).
        """
        self.threshold = threshold

        if nlp_model is None:
            logger.info("Loading spaCy model...")
            self.nlp = spacy.load("en_core_web_sm")
            logger.info("spaCy loaded.")
        else:
            self.nlp = nlp_model

        if embedding_model is None:
            logger.info("Loading sentence-transformers embeddings model...")
            self.model = SentenceTransformer("all-MiniLM-L6-v2")
            logger.info("Embeddings model loaded.")
        else:
            self.model = embedding_model

    def lemmatize(self, text: str) -> str:
        """Return lemmatized version of the text."""
        doc = self.nlp(text)
        return " ".join(token.lemma_ for token in doc)

    def fuzzy_score(self, a: str, b: str) -> float:
        """Return fuzzy similarity score (0-100)."""
        return fuzz.ratio(a, b)

    def embedding_similarity(self, a: str, b: str) -> float:
        """Return embedding cosine similarity (0-1)."""
        emb1 = self.model.encode(a, convert_to_tensor=True)
        emb2 = self.model.encode(b, convert_to_tensor=True)
        return util.cos_sim(emb1, emb2).item()

    def is_number(self, s: str) -> bool:
        try:
            float(s)
            return True
        except ValueError:
            return False

    def is_correct(self, user_answer: str, correct_answer: str) -> bool:
        """Return True if answer is correct based on fuzzy or embedding similarity."""
        ua_norm = normalize(user_answer)
        ca_norm = normalize(correct_answer)

        # If the correct answer is numeric, require exact match
        if self.is_number(ca_norm):
            return ua_norm == ca_norm  # or float(ua_norm) == float(ca_norm)

        ua_lemma = self.lemmatize(ua_norm)
        ca_lemma = self.lemmatize(ca_norm)

        fuzzy = self.fuzzy_score(ua_lemma, ca_lemma)
        embedding = self.embedding_similarity(ua_lemma, ca_lemma)

        logger.info(
            "User answer: %s, Correct answer: %s, Fuzzy score: %s, Embedding similarity: %s",
            user_answer,
            correct_answer,
            fuzzy,
            embedding,
        )

        return fuzzy >= FUZZY_THRESHOLD or embedding >= self.threshold
