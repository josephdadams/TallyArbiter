import { Component } from '@angular/core';
import { WakeLockService } from './_services/wake-lock.service';
import { DarkModeService } from './_services/darkmode.service';
import {MatButtonToggleModule} from '@angular/material/button-toggle';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  public showMenu = false;
  constructor(private wakeLockService: WakeLockService, private darkModeService: DarkModeService) {
    wakeLockService.init();
    darkModeService.init();
  }
  public toggleDarkMode(mode: any) {
    console.log(mode);
    let modeStr: any = '';
    let currentDark: any = '';

    currentDark = this.darkModeService.getDarkMode();

    if (currentDark === 'enable') {
      modeStr = 'disable'
    } else {
      modeStr = 'enable'
    }
    this.darkModeService.setDarkMode(modeStr);
  }

}
