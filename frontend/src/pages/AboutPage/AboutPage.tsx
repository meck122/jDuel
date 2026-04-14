import { useEffect } from "react";
import styles from "./AboutPage.module.css";

export function AboutPage() {
  useEffect(() => {
    document.title = "About — jDuel";
    return () => {
      document.title = "jDuel";
    };
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.paper}>
        <h1 className={styles.title}>
          <span className={styles.titleJ}>j</span>
          <span className={styles.titleDuel}>Duel</span>
        </h1>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>What is jDuel?</h2>
          <p className={styles.sectionContent}>
            jDuel is a free, real-time multiplayer trivia game — no account required. Create a room,
            share the code with friends, and settle the score one question at a time. Speed and
            accuracy both matter: faster correct answers earn more points.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>How to Play</h2>
          <ul className={styles.list}>
            <li className={styles.listItem} data-step="1">
              Create a room or enter a room code to join
            </li>
            <li className={styles.listItem} data-step="2">
              Enter your name — no account or sign-up needed
            </li>
            <li className={styles.listItem} data-step="3">
              Wait in the lobby for others to join
            </li>
            <li className={styles.listItem} data-step="4">
              The host configures difficulty and question count, then starts the game
            </li>
            <li className={styles.listItem} data-step="5">
              Answer each question before time runs out — smart NLP checking accepts paraphrased
              answers and tolerates typos, so you don't need to type word for word
            </li>
            <li className={styles.listItem} data-step="6">
              Earn up to <span className={styles.speedText}>1,000 points</span> per question —
              faster correct answers score higher
            </li>
            <li className={styles.listItem} data-step="7">
              The player with the most points wins!
            </li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>FAQ</h2>
          <dl className={styles.faq}>
            <dt className={styles.faqQuestion}>How many players can join?</dt>
            <dd className={styles.sectionContent}>
              Rooms support up to 20 players. The host can start the game whenever everyone is ready
              — there is no minimum.
            </dd>
            <dt className={styles.faqQuestion}>What topics are the questions about?</dt>
            <dd className={styles.sectionContent}>
              Questions span general knowledge across a wide range of topics. There is no category
              selection — every game is a mix.
            </dd>
            <dt className={styles.faqQuestion}>How does answer checking work?</dt>
            <dd className={styles.sectionContent}>
              jDuel uses NLP-powered answer verification that accepts paraphrased answers and
              tolerates typos — you don't need to type the exact answer word for word. Numeric
              answers (dates, counts) require an exact match.
            </dd>
            <dt className={styles.faqQuestion}>Do I need an account?</dt>
            <dd className={styles.sectionContent}>
              No account, no sign-up, no app download. Enter a name and a room code and you're in.
            </dd>
          </dl>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>About</h2>
          <p className={styles.sectionContent}>
            jDuel was built by <span className={styles.highlight}>Mark Liao</span> and named after
            his friend <span className={styles.highlight}>Josh</span>. It's a personal project to
            bring real-time trivia to the browser — free, fast, and open to anyone.
          </p>
        </section>
      </div>
    </div>
  );
}
