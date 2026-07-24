import type { ReactNode } from 'react';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import pkg from '../../../package.json';

import styles from './index.module.css';

function HomepageHeader() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <header className={styles.heroBanner}>
      <div className="container">
        <div className="badge-pill">
          <span>⚡ Official Documentation Portal v{pkg.version}</span>
        </div>
        <Heading as="h1" className={styles.heroTitle}>
          VeloSys Pro
        </Heading>
        <p className={styles.heroSubtitle}>{siteConfig.tagline}</p>
        <div className={styles.buttons}>
          <Link className={styles.primaryBtn} to="/docs/intro">
            Get Started 🚀
          </Link>
          <Link
            className={styles.secondaryBtn}
            href="https://github.com/chrystiamjr/VeloSysPro/releases"
          >
            Download Installer 📦
          </Link>
        </div>
      </div>
    </header>
  );
}

export default function Home(): ReactNode {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout
      title={`${siteConfig.title} - Windows Optimization Desktop App`}
      description={siteConfig.tagline}
    >
      <HomepageHeader />
      <main className="margin-vert--xl container">
        <div className="row">
          <div className="col col--4">
            <div className="card padding--lg margin-bottom--md">
              <h3 className={styles.featureTitle}>🚀 High-Performance Tweaks</h3>
              <p className={styles.featureText}>
                Automated DNS flushing, temporary file cleanup, DISM image repair, and System File
                Checker integration.
              </p>
              <Link className={styles.featureLink} to="/docs/user-guide/optimizations">
                Learn more &rarr;
              </Link>
            </div>
          </div>
          <div className="col col--4">
            <div className="card padding--lg margin-bottom--md">
              <h3 className={styles.featureTitle}>🎮 Gaming & Network Tuning</h3>
              <p className={styles.featureText}>
                TCP Window Auto-Tuning, Receive-Side Scaling (RSS), and ECN optimization for
                low-latency gaming.
              </p>
              <Link className={styles.featureLink} to="/docs/user-guide/optimizations">
                Learn more &rarr;
              </Link>
            </div>
          </div>
          <div className="col col--4">
            <div className="card padding--lg margin-bottom--md">
              <h3 className={styles.featureTitle}>🛡️ Safety & Restoration</h3>
              <p className={styles.featureText}>
                Registry backups (`.reg`), System Restore Point integration, and non-destructive
                rollbacks.
              </p>
              <Link className={styles.featureLink} to="/docs/user-guide/registry-backup">
                Learn more &rarr;
              </Link>
            </div>
          </div>
        </div>

        <div className={`margin-top--xl card padding--xl ${styles.cliCard}`}>
          <div className="row align-items--center">
            <div className="col col--6">
              <h2 className={styles.featureTitle}>💻 Headless CLI Execution</h2>
              <p className={styles.cliText}>
                VeloSys Pro supports silent background task execution for Windows Task Scheduler or
                automated scripts.
              </p>
            </div>
            <div className="col col--6">
              <pre className={styles.cliCode}>
                <code className="language-powershell">
                  {`# Run Quick Optimization headlessly\n.\\VeloSysPro.exe --task=quick\n\n# Enable Gaming Mode optimizations\n.\\VeloSysPro.exe --task=gaming`}
                </code>
              </pre>
            </div>
          </div>
        </div>
      </main>
    </Layout>
  );
}
