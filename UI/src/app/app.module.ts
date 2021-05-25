import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { QrCodeModule } from 'ng-qrcode';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { HomeComponent } from './_components/home/home.component';
import { ProducerComponent } from './_components/producer/producer.component';
import { SettingsComponent } from './_components/settings/settings.component';
import { TallyComponent } from './_components/tally/tally.component';
import { AboutComponent } from './_components/about/about.component';

@NgModule({
  declarations: [
    AppComponent,
    HomeComponent,
    ProducerComponent,
    SettingsComponent,
    TallyComponent,
    AboutComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    QrCodeModule,
    FormsModule,
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
