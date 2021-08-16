import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class NavbarVisibilityService {
    public navbarIsVisible: boolean = true;

    public hideNavbar() {
        this.navbarIsVisible = false;
    }

    public showNavbar() {
        this.navbarIsVisible = true;
    }
}
