import { enableProdMode, provideZoneChangeDetection } from '@angular/core'
import { bootstrapApplication } from '@angular/platform-browser'
import { provideAnimations } from '@angular/platform-browser/animations'
import { provideRouter, withHashLocation } from '@angular/router'
import { provideServiceWorker } from '@angular/service-worker'

import { AppComponent } from './app/app.component'
import { routes } from './app/app.routes'
import { environment } from './environments/environment'

if (environment.production) {
	enableProdMode()
}

bootstrapApplication(AppComponent, {
	providers: [
		// Angular no longer turns on zone-based change detection implicitly. Every
		// component here is CheckAlways over plain mutable state pushed in from
		// socket.io, so without this the UI renders once and then never updates —
		// tally colours, listener lists, logs, all of it goes stale. Phase 2 moves
		// that state to signals, after which this can be swapped for
		// provideZonelessChangeDetection().
		provideZoneChangeDetection({ eventCoalescing: true }),
		provideRouter(routes, withHashLocation()),
		provideAnimations(),
		provideServiceWorker('ngsw-worker.js', {
			enabled: environment.production,
			registrationStrategy: 'registerWhenStable:30000',
		}),
	],
}).catch((err) => console.error(err))
