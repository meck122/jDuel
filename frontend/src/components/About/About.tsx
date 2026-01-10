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
          "linear-gradient(135deg, #0A2463 0%, #1E3A8A 50%, #0A2463 100%)",
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
            backgroundColor: "rgba(30, 58, 138, 0.95)",
            backdropFilter: "blur(10px)",
            border: "2px solid #FFBF00",
          }}
        >
          <Typography
            variant="h2"
            component="h1"
            align="center"
            gutterBottom
            sx={{
              color: "#FFBF00",
              fontWeight: 700,
              textShadow: "2px 2px 4px rgba(0,0,0,0.5)",
              mb: 4,
            }}
          >
            About jDuel
          </Typography>

          <Box sx={{ mb: 4 }}>
            <Typography
              variant="h4"
              gutterBottom
              sx={{ color: "#FFBF00", fontWeight: 600 }}
            >
              About the Game
            </Typography>
            <Divider sx={{ bgcolor: "#FFBF00", mb: 2 }} />
            <Typography
              variant="body1"
              sx={{ color: "white", fontSize: "1.1rem", lineHeight: 1.8 }}
            >
              jDuel is a real-time multiplayer trivia game inspired by Jeopardy!
              Test your knowledge against friends in an exciting battle of wits.
            </Typography>
          </Box>

          <Box sx={{ mb: 4 }}>
            <Typography
              variant="h4"
              gutterBottom
              sx={{ color: "#FFBF00", fontWeight: 600 }}
            >
              How to Play
            </Typography>
            <Divider sx={{ bgcolor: "#FFBF00", mb: 2 }} />
            <List sx={{ color: "white" }}>
              <ListItem>
                <ListItemText
                  primary="1. Create or join a room using a unique room code"
                  primaryTypographyProps={{ fontSize: "1.1rem" }}
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="2. Wait for other players to join"
                  primaryTypographyProps={{ fontSize: "1.1rem" }}
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="3. Any player can start the game when ready"
                  primaryTypographyProps={{ fontSize: "1.1rem" }}
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="4. Answer questions as quickly and accurately as possible"
                  primaryTypographyProps={{ fontSize: "1.1rem" }}
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  sx={{ "& .MuiListItemText-primary": { fontWeight: 600 } }}
                >
                  <Typography component="span" sx={{ fontSize: "1.1rem" }}>
                    5. Points are awarded based on{" "}
                    <Box
                      component="span"
                      sx={{
                        color: "#FF4444",
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
                  primaryTypographyProps={{ fontSize: "1.1rem" }}
                />
              </ListItem>
            </List>
          </Box>

          <Box sx={{ mb: 4 }}>
            <Typography
              variant="h4"
              gutterBottom
              sx={{ color: "#FFBF00", fontWeight: 600 }}
            >
              About the Creator
            </Typography>
            <Divider sx={{ bgcolor: "#FFBF00", mb: 2 }} />
            <Typography
              variant="body1"
              sx={{ color: "white", fontSize: "1.1rem", lineHeight: 1.8 }}
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
              sx={{ color: "#FFBF00", fontWeight: 600 }}
            >
              Technology
            </Typography>
            <Divider sx={{ bgcolor: "#FFBF00", mb: 2 }} />
            <Typography
              variant="body1"
              sx={{ color: "white", fontSize: "1.1rem", lineHeight: 1.8 }}
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
