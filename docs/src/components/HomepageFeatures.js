import React from 'react'
import clsx from 'clsx'
import styles from './HomepageFeatures.module.css'

const FeatureList = [
	{
		title: 'Multi-Tally-Device Support',
		Svg: require('../../static/img/features/devices.svg').default,
		description: (
			<>Tally Arbiter supports a wide variety of tally lights ranging from an M5 Stick to your smartphone.</>
		),
	},
	{
		title: 'Combine Video Switchers',
		Svg: require('../../static/img/features/switchers.svg').default,
		description: (
			<>
				Combine incoming tally data from multiple video switchers and arbitrate the bus state across all of the sources.
			</>
		),
	},
	{
		title: 'Cloud Synchronization',
		Svg: require('../../static/img/features/cloud.svg').default,
		description: (
			<>Sync your settings and tally data from your closed production network to a cloud server for easier access.</>
		),
	},
	{
		title: 'Producer-Page',
		Svg: require('../../static/img/features/producer.svg').default,
		description: <>Producers can view connected clients and get attention by flashing their device.</>,
	},
	{
		title: 'Chat',
		Svg: require('../../static/img/features/chat.svg').default,
		description: <>Send important messages to the Tally clients - directly from the producer page.</>,
	},
	{
		title: 'Infinite number of cameras',
		Svg: require('../../static/img/features/camera.svg').default,
		description: (
			<>
				TallyArbiter can support an unlimited of cameras and therefore can be used for any production - no matter how
				big or small it is!
			</>
		),
	},
]

function Feature({ Svg, title, description }) {
	return (
		<div className={clsx('col col--4')}>
			<div className="text--center">
				<Svg className={styles.featureSvg} alt={title} />
			</div>
			<div className="text--center padding-horiz--md">
				<h3>{title}</h3>
				<p>{description}</p>
			</div>
		</div>
	)
}

export default function HomepageFeatures() {
	return (
		<section className={styles.features}>
			<div className="container">
				<div className="row">
					{FeatureList.map((props, idx) => (
						<Feature key={idx} {...props} />
					))}
				</div>
			</div>
		</section>
	)
}
