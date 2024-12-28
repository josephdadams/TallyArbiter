import { NgModule } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { BrowserModule } from '@angular/platform-browser'
import { BrowserAnimationsModule } from '@angular/platform-browser/animations'
import { QrCodeModule } from 'ng-qrcode'
import { NgbNavModule } from '@ng-bootstrap/ng-bootstrap'
import { NgJsonEditorModule } from 'ang-jsoneditor'

import { AppRoutingModule } from './app-routing.module'
import { AppComponent } from './app.component'
import { HomeComponent } from './_components/home/home.component'
import { ProducerComponent } from './_components/producer/producer.component'
import { SettingsComponent } from './_components/settings/settings.component'
import { TallyComponent } from './_components/tally/tally.component'
import { AboutComponent } from './_components/about/about.component'
import { ServiceWorkerModule } from '@angular/service-worker'
import { environment } from '../environments/environment'
import { LoginComponent } from './_components/login/login.component'
import { ChatComponent } from './_components/chat/chat.component'
import { ThemeSelectorComponent } from './_components/theme-selector/theme-selector.component'
import { ErrorReportComponent } from './_components/error-report/error-report.component'
import { ErrorReportsListComponent } from './_components/error-reports-list/error-reports-list.component'
import { RequireRoleDirective } from './_directives/requireRole'

@NgModule({
	declarations: [
		AppComponent,
		HomeComponent,
		ProducerComponent,
		SettingsComponent,
		TallyComponent,
		AboutComponent,
		LoginComponent,
		ChatComponent,
		ThemeSelectorComponent,
		ErrorReportComponent,
		ErrorReportsListComponent,
		RequireRoleDirective,
	],
	imports: [
		BrowserModule,
		BrowserAnimationsModule,
		AppRoutingModule,
		QrCodeModule,
		NgbNavModule,
		NgJsonEditorModule,
		FormsModule,
		ServiceWorkerModule.register('ngsw-worker.js', {
			enabled: environment.production,
			// Register the ServiceWorker as soon as the app is stable
			// or after 30 seconds (whichever comes first).
			registrationStrategy: 'registerWhenStable:30000',
		}),
	],
	providers: [],
	bootstrap: [AppComponent],
})
export class AppModule {}
