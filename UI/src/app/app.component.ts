import { Component } from '@angular/core';
import { WakeLockService } from './_services/wake-lock.service';
import { DarkModeService } from './_services/darkmode.service';

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
}
