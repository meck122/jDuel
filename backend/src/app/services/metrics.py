"""Prometheus metrics definitions for jDuel.

All custom application metrics are defined here and imported by the modules
that increment/observe them. This keeps metric definitions in one place.
"""

from prometheus_client import Counter, Gauge, Histogram

# WebSocket
ws_connections_active = Gauge(
    "jduel_ws_connections_active",
    "Number of active WebSocket connections",
)

# Game lifecycle
games_started_total = Counter(
    "jduel_games_started_total",
    "Total number of games started (includes play-again restarts)",
)

games_completed_total = Counter(
    "jduel_games_completed_total",
    "Total number of games that reached game-over state",
)

rooms_created_total = Counter(
    "jduel_rooms_created_total",
    "Total number of rooms created",
)

rooms_closed_total = Counter(
    "jduel_rooms_closed_total",
    "Total number of rooms closed (expired after game-over timeout)",
)

# Player counts
players_per_game = Histogram(
    "jduel_players_per_game",
    "Number of players at game start",
    buckets=[1, 2, 3, 4, 5, 6, 8, 10],
)

# Speed Battle
speed_battle_matches_started_total = Counter(
    "jduel_speed_battle_matches_started_total",
    "Total number of Speed Battle matches started (includes play-again restarts)",
)

speed_battle_match_duration_seconds = Histogram(
    "jduel_speed_battle_match_duration_seconds",
    "Elapsed seconds from match start to match end",
    buckets=[10, 30, 60, 90, 120, 150, 180],
)

speed_battle_cooldowns_total = Counter(
    "jduel_speed_battle_cooldowns_total",
    "Total number of wrong-answer cooldowns imposed across all Speed Battle matches",
)

# Answer verification
answer_verification_duration_seconds = Histogram(
    "jduel_answer_verification_duration_seconds",
    "Wall-clock seconds spent in NLP answer verification (Classic non-MC mode only)",
    buckets=[0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5],
)
