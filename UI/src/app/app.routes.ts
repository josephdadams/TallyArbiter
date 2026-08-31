import { Routes } from '@angular/router'
import { AuthorizeGuard } from './_guards/authorize.guard'

export const routes: Routes = [
	{ path: 'home', loadComponent: () => import('./_components/home/home.component').then((m) => m.HomeComponent) },
	{
		path: 'tally/:deviceId',
		loadComponent: () => import('./_components/tally/tally.component').then((m) => m.TallyComponent),
	},
	{ path: 'tally', loadComponent: () => import('./_components/tally/tally.component').then((m) => m.TallyComponent) },
	{
		path: 'producer',
		loadComponent: () => import('./_components/producer/producer.component').then((m) => m.ProducerComponent),
		canActivate: [AuthorizeGuard],
	},
	{
		path: 'settings',
		loadComponent: () => import('./_components/settings/settings.component').then((m) => m.SettingsComponent),
		canActivate: [AuthorizeGuard],
	},
	{
		path: 'errors/:errorReportId',
		loadComponent: () =>
			import('./_components/error-report/error-report.component').then((m) => m.ErrorReportComponent),
		canActivate: [AuthorizeGuard],
	},
	{
		path: 'errors',
		loadComponent: () =>
			import('./_components/error-reports-list/error-reports-list.component').then((m) => m.ErrorReportsListComponent),
		canActivate: [AuthorizeGuard],
	},
	{ path: 'about', loadComponent: () => import('./_components/about/about.component').then((m) => m.AboutComponent) },
	{
		path: 'login/:redirect/:extraParam',
		loadComponent: () => import('./_components/login/login.component').then((m) => m.LoginComponent),
	},
	{
		path: 'login/:redirect',
		loadComponent: () => import('./_components/login/login.component').then((m) => m.LoginComponent),
	},
	{
		path: 'change-password/:redirect',
		loadComponent: () =>
			import('./_components/change-password/change-password.component').then((m) => m.ChangePasswordComponent),
	},
	{
		path: 'change-password',
		loadComponent: () =>
			import('./_components/change-password/change-password.component').then((m) => m.ChangePasswordComponent),
	},
	//
	{ path: '**', redirectTo: '/home', pathMatch: 'full' },
]
