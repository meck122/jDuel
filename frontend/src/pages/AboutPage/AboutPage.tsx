import styles from "./AboutPage.module.css";

export function AboutPage() {
  return (
    <div className={styles.container}>
      <div className={styles.paper}>
        <h1 className={styles.title}>
          <span className={styles.titleJ}>j</span>
          <span className={styles.titleDuel}>Duel</span>
        </h1>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>About the Game</h2>
          <p className={styles.sectionContent}>
            jDuel (joshDuel) is a real-time multiplayer trivia game inspired by
            my buddy <span className={styles.highlight}>Josh</span>. Test your
            knowledge against friends in an exciting battle of wits where speed
            and accuracy determine the champion.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>How to Play</h2>
          <ul className={styles.list}>
            <li className={styles.listItem} data-step="1">
              Create or join a room using a unique room code
            </li>
            <li className={styles.listItem} data-step="2">
              Wait for other players to join the lobby
            </li>
            <li className={styles.listItem} data-step="3">
              Any player can start the game when ready
            </li>
            <li className={styles.listItem} data-step="4">
              Answer questions as quickly and accurately as possible
            </li>
            <li className={styles.listItem} data-step="5">
              Points are awarded based on{" "}
              <span className={styles.speedText}>SPEED</span> and correct
              answers
            </li>
            <li className={styles.listItem} data-step="6">
              The player with the most points at the end wins!
            </li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>About the Creator</h2>
          <p className={styles.sectionContent}>
            Created by Mark Liao. This project was built to bring the excitement
            of trivia games to the web, making it easy for friends and family to
            compete no matter where they are.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Technology Stack</h2>
          <p className={styles.sectionContent}>
            Built with modern web technologies for a seamless multiplayer
            experience:
          </p>
          <div className={styles.techStack}>
            <span className={styles.techBadge}>React</span>
            <span className={styles.techBadge}>TypeScript</span>
            <span className={styles.techBadge}>Vite</span>
            <span className={styles.techBadge}>FastAPI</span>
            <span className={styles.techBadge}>WebSockets</span>
            <span className={styles.techBadge}>Material UI</span>
          </div>
        </section>
      </div>
    </div>
  );
}
