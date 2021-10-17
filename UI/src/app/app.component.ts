import { Component } from '@angular/core';
import { WakeLockService } from './_services/wake-lock.service';
import { NavbarVisibilityService } from './_services/navbar-visibility.service';
import { LocationBackService } from 'src/app/_services/locationBack.service';
import { DarkModeService } from './_services/darkmode.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  public showMenu = false;
  public hideNavBar = false;

  public style = "icon";
  
  constructor(
    private wakeLockService: WakeLockService,
    public navbarVisibilityService: NavbarVisibilityService,
    private locationBackService: LocationBackService,
    public darkModeService: DarkModeService
  ) {
    wakeLockService.init();
    darkModeService.init();
  }
}
