import { Routes } from '@angular/router'
import { AuthorizeGuard } from './_guards/authorize.guard'
import { requireRoleGuard } from './_guards/requireRole.guard'

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
		children: [
			{
				path: 'sources-devices',
				loadComponent: () =>
					import('./_components/settings/tabs/sources-devices/sources-devices-tab.component').then(
						(m) => m.SourcesDevicesTabComponent,
					),
				canActivate: [requireRoleGuard('settings:sources_devices')],
			},
			{
				path: 'listeners',
				loadComponent: () =>
					import('./_components/settings/tabs/listeners/listeners-tab.component').then((m) => m.ListenersTabComponent),
				canActivate: [requireRoleGuard('settings:listeners')],
			},
			{
				path: 'cloud',
				loadComponent: () =>
					import('./_components/settings/tabs/cloud/cloud-tab.component').then((m) => m.CloudTabComponent),
				canActivate: [requireRoleGuard('settings:cloud')],
			},
			{
				path: 'testing',
				loadComponent: () =>
					import('./_components/settings/tabs/testing/testing-tab.component').then((m) => m.TestingTabComponent),
				canActivate: [requireRoleGuard('settings:testing')],
			},
			{
				path: 'config',
				loadComponent: () =>
					import('./_components/settings/tabs/config/config-tab.component').then((m) => m.ConfigTabComponent),
				canActivate: [requireRoleGuard('settings:config')],
			},
			{
				path: 'users',
				loadComponent: () =>
					import('./_components/settings/tabs/users/users-tab.component').then((m) => m.UsersTabComponent),
				canActivate: [requireRoleGuard('settings:users')],
			},
			{
				path: 'logs',
				loadComponent: () =>
					import('./_components/settings/tabs/logs/logs-tab.component').then((m) => m.LogsTabComponent),
			},
		],
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
