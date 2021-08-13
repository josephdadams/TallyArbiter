import { Component } from '@angular/core';
import { WakeLockService } from './_services/wake-lock.service';
import { NavbarVisibilityService } from './_services/navbar-visibility.service';
import { LocationBackService } from 'src/app/_services/locationBack.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  public showMenu = false;
  public hideNavBar = false;
  constructor(
    private wakeLockService: WakeLockService,
    public navbarVisibilityService: NavbarVisibilityService,
    private locationBackService: LocationBackService
  ) {
    wakeLockService.init();
  }
}
