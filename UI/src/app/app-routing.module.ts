import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { AboutComponent } from './_components/about/about.component'
import { ErrorReportComponent } from './_components/error-report/error-report.component'
import { ErrorReportsListComponent } from './_components/error-reports-list/error-reports-list.component'
import { HomeComponent } from './_components/home/home.component'
import { LoginComponent } from './_components/login/login.component'
import { ProducerComponent } from './_components/producer/producer.component'
import { SettingsComponent } from './_components/settings/settings.component'
import { TallyComponent } from './_components/tally/tally.component'
import { AuthorizeGuard } from './_guards/authorize.guard'

const routes: Routes = [
	{ path: 'home', component: HomeComponent },
	{ path: 'tally/:deviceId', component: TallyComponent },
	{ path: 'tally', component: TallyComponent },
	{ path: 'producer', component: ProducerComponent, canActivate: [AuthorizeGuard] },
	{ path: 'settings', component: SettingsComponent, canActivate: [AuthorizeGuard] },
	{ path: 'errors/:errorReportId', component: ErrorReportComponent, canActivate: [AuthorizeGuard] },
	{ path: 'errors', component: ErrorReportsListComponent, canActivate: [AuthorizeGuard] },
	{ path: 'about', component: AboutComponent },
	{ path: 'login/:redirect/:extraParam', component: LoginComponent },
	{ path: 'login/:redirect', component: LoginComponent },
	//
	{ path: '**', redirectTo: '/home', pathMatch: 'full' },
]

@NgModule({
	imports: [RouterModule.forRoot(routes, { useHash: true })],
	exports: [RouterModule],
})
export class AppRoutingModule {}
