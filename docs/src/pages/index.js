import React from 'react'
import clsx from 'clsx'
import Layout from '@theme/Layout'
import Link from '@docusaurus/Link'
import useDocusaurusContext from '@docusaurus/useDocusaurusContext'
import styles from './index.module.css'
import HomepageFeatures from '../components/HomepageFeatures'

function HomepageHeader() {
	const { siteConfig } = useDocusaurusContext()
	return (
		<header className={clsx('hero hero--primary', styles.heroBanner)}>
			<div className="container">
				<h1 className="hero__title">TallyArbiter</h1>
				<p className="hero__subtitle">
					Combine incoming tally data from multiple sources or video switchers and arbitrate the bus state across all of
					the sources so that devices like cameras can accurately reflect tally data coming from those multiple
					locations without each device having to be connected to all sources simultaneously.
				</p>
				<div className={styles.buttons}>
					<Link className="button button--secondary button--lg" to="/docs/intro">
						Get Started
					</Link>
				</div>
			</div>
		</header>
	)
}

export default function Home() {
	const { siteConfig } = useDocusaurusContext()
	return (
		<Layout title="Start" description="Overview of TallyArbiter">
			<HomepageHeader />
			<main>
				<HomepageFeatures />
			</main>
		</Layout>
	)
}
