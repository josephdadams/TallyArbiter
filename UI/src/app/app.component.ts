import { Component } from '@angular/core';
import { WakeLockService } from './_services/wake-lock.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  public showMenu = false;
  constructor(private wakeLockService: WakeLockService) {
    wakeLockService.init();
  }
}
