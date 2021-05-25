import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AboutComponent } from './_components/about/about.component';
import { HomeComponent } from './_components/home/home.component';
import { LoginComponent } from './_components/login/login.component';
import { ProducerComponent } from './_components/producer/producer.component';
import { SettingsComponent } from './_components/settings/settings.component';
import { TallyComponent } from './_components/tally/tally.component';
import { ProducerGuard } from './_guards/producer.guard';
import { SettingsGuard } from './_guards/settings.guard';

const routes: Routes = [
  { path: "home", component: HomeComponent },
  { path: "tally/:deviceId", component: TallyComponent },
  { path: "tally", component: TallyComponent },
  { path: "producer", component: ProducerComponent, canActivate: [ProducerGuard] },
  { path: "settings", component: SettingsComponent, canActivate: [SettingsGuard] },
  { path: "about", component: AboutComponent },
  { path: "login/producer", component: LoginComponent },
  { path: "login/settings", component: LoginComponent },
  //
  { path: "**", redirectTo: "/home", pathMatch: "full" },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
