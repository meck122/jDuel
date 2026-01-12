import {
  Container,
  Paper,
  Typography,
  Box,
  List,
  ListItem,
  ListItemText,
  Divider,
} from "@mui/material";

export function About() {
  return (
    <Box
      sx={{
        minHeight: "calc(100vh - 64px)",
        width: "100%",
        background:
          "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f1419 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        py: 6,
        px: 2,
      }}
    >
      <Container maxWidth="md">
        <Paper
          elevation={8}
          sx={{
            p: { xs: 3, sm: 5 },
            backgroundColor: "rgba(255, 255, 255, 0.98)",
            backdropFilter: "blur(10px)",
            border: "1px solid rgba(0, 0, 0, 0.1)",
            borderRadius: 2,
          }}
        >
          <Typography
            variant="h2"
            component="h1"
            align="center"
            gutterBottom
            sx={{
              color: "#1a1a2e",
              fontWeight: 700,
              mb: 4,
            }}
          >
            About jDuel
          </Typography>

          <Box sx={{ mb: 4 }}>
            <Typography
              variant="h4"
              gutterBottom
              sx={{ color: "#2c3e50", fontWeight: 600 }}
            >
              About the Game
            </Typography>
            <Divider sx={{ bgcolor: "#3498db", mb: 2, height: 2 }} />
            <Typography
              variant="body1"
              sx={{ color: "#34495e", fontSize: "1.1rem", lineHeight: 1.8 }}
            >
              jDuel (joshDuel) is a real-time multiplayer trivia game inspired
              by my buddy{" "}
              <span
                style={{
                  background:
                    "linear-gradient(90deg, red, orange, yellow, green, blue, indigo, violet)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  fontWeight: 600,
                }}
              >
                Josh
              </span>
              . Test your knowledge against friends in an exciting battle of
              wits.
            </Typography>
          </Box>

          <Box sx={{ mb: 4 }}>
            <Typography
              variant="h4"
              gutterBottom
              sx={{ color: "#2c3e50", fontWeight: 600 }}
            >
              How to Play
            </Typography>
            <Divider sx={{ bgcolor: "#3498db", mb: 2, height: 2 }} />
            <List sx={{ color: "#34495e" }}>
              <ListItem>
                <ListItemText
                  primary="1. Create or join a room using a unique room code"
                  slotProps={{
                    primary: { sx: { fontSize: "1.1rem" } },
                  }}
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="2. Wait for other players to join"
                  slotProps={{
                    primary: { sx: { fontSize: "1.1rem" } },
                  }}
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="3. Any player can start the game when ready"
                  slotProps={{
                    primary: { sx: { fontSize: "1.1rem" } },
                  }}
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="4. Answer questions as quickly and accurately as possible"
                  slotProps={{
                    primary: { sx: { fontSize: "1.1rem" } },
                  }}
                />
              </ListItem>
              <ListItem>
                <ListItemText>
                  <Typography component="span" sx={{ fontSize: "1.1rem" }}>
                    5. Points are awarded based on{" "}
                    <Box
                      component="span"
                      sx={{
                        color: "#e74c3c",
                        fontWeight: 700,
                        fontSize: "1.2rem",
                      }}
                    >
                      SPEEEED
                    </Box>{" "}
                    and correct answers
                  </Typography>
                </ListItemText>
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="6. The player with the most points at the end wins!"
                  slotProps={{
                    primary: { sx: { fontSize: "1.1rem" } },
                  }}
                />
              </ListItem>
            </List>
          </Box>

          <Box sx={{ mb: 4 }}>
            <Typography
              variant="h4"
              gutterBottom
              sx={{ color: "#2c3e50", fontWeight: 600 }}
            >
              About the Creator
            </Typography>
            <Divider sx={{ bgcolor: "#3498db", mb: 2, height: 2 }} />
            <Typography
              variant="body1"
              sx={{ color: "#34495e", fontSize: "1.1rem", lineHeight: 1.8 }}
            >
              Created by Mark Liao. This project was built to bring the
              excitement of trivia games to the web, making it easy for friends
              and family to compete no matter where they are.
            </Typography>
          </Box>

          <Box>
            <Typography
              variant="h4"
              gutterBottom
              sx={{ color: "#2c3e50", fontWeight: 600 }}
            >
              Technology
            </Typography>
            <Divider sx={{ bgcolor: "#3498db", mb: 2, height: 2 }} />
            <Typography
              variant="body1"
              sx={{ color: "#34495e", fontSize: "1.1rem", lineHeight: 1.8 }}
            >
              jDuel is built with React, TypeScript, Material UI, and FastAPI,
              featuring real-time WebSocket communication for a seamless
              multiplayer experience.
            </Typography>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}
