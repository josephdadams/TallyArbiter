import { enableProdMode, provideZonelessChangeDetection } from '@angular/core'
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
		// Every piece of state the templates read is a signal, so change detection
		// is driven by those writes rather than by zone.js patching the world and
		// re-checking everything after each socket callback. Anything added here
		// that mutates a plain field from an async callback will not repaint.
		provideZonelessChangeDetection(),
		provideRouter(routes, withHashLocation()),
		provideAnimations(),
		provideServiceWorker('ngsw-worker.js', {
			enabled: environment.production,
			registrationStrategy: 'registerWhenStable:30000',
		}),
	],
}).catch((err) => console.error(err))
