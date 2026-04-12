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
