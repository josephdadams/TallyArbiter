import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AboutComponent } from './_components/about/about.component';
import { HomeComponent } from './_components/home/home.component';
import { ProducerComponent } from './_components/producer/producer.component';
import { SettingsComponent } from './_components/settings/settings.component';
import { TallyComponent } from './_components/tally/tally.component';

const routes: Routes = [
  { path: "home", component: HomeComponent },
  { path: "tally/:deviceId", component: TallyComponent },
  { path: "tally", component: TallyComponent },
  { path: "producer", component: ProducerComponent },
  { path: "settings", component: SettingsComponent },
  { path: "about", component: AboutComponent },
  //
  { path: "**", redirectTo: "/home", pathMatch: "full" },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
