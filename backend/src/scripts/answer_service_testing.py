# test_answer_service.py

import re

import spacy
from rapidfuzz import fuzz
from sentence_transformers import SentenceTransformer, util

# --- Setup NLP tools ---
nlp = spacy.load("en_core_web_sm")
model = SentenceTransformer("all-MiniLM-L6-v2")


# --- Helper functions ---
def normalize(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^\w\s]", "", text)
    text = re.sub(r"\s+", " ", text)
    return text


def lemmatize(text: str) -> str:
    doc = nlp(text)
    return " ".join(token.lemma_ for token in doc)


def fuzzy_score(a: str, b: str) -> float:
    return fuzz.ratio(a, b)


def embedding_similarity(a: str, b: str) -> float:
    emb1 = model.encode(a, convert_to_tensor=True)
    emb2 = model.encode(b, convert_to_tensor=True)
    return util.cos_sim(emb1, emb2).item()


DEFAULT_THRESHOLD = 0.75


# --- Mock AnswerService ---
class AnswerService:
    def is_correct_test(self, user_answer: str, correct_answer: str):
        ua_norm = normalize(user_answer)
        ca_norm = normalize(correct_answer)

        ua_lemma = lemmatize(ua_norm)
        ca_lemma = lemmatize(ca_norm)

        fuzzy = fuzzy_score(ua_lemma, ca_lemma)
        embedding = embedding_similarity(ua_lemma, ca_lemma)

        # For demonstration, consider correct if fuzzy >= 85 or embedding >= DEFAULT_THRESHOLD
        is_correct = fuzzy >= 85 or embedding >= DEFAULT_THRESHOLD

        return {
            "user_answer": user_answer,
            "correct_answer": correct_answer,
            "normalized_user": ua_norm,
            "normalized_correct": ca_norm,
            "lemma_user": ua_lemma,
            "lemma_correct": ca_lemma,
            "fuzzy_score": fuzzy,
            "embedding_similarity": embedding,
            "is_correct": is_correct,
        }


# --- Example usage ---
if __name__ == "__main__":
    service = AnswerService()

    test_cases = [
        ("bagel", "bagels"),
        ("allergies", "allergy"),
        ("iberia", "iberian"),
        ("USA", "United States of America"),
        ("NYC", "New York City"),
        ("France", "France"),
        ("bangle", "bagel"),
        ("Scotland", "Spanish"),
        ("eyes", "the eye"),
    ]

    for ua, ca in test_cases:
        result = service.is_correct_test(ua, ca)
        print(result)
        print("-" * 50)
