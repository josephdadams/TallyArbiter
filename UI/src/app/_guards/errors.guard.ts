import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService } from '../_services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class ErrorsGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) { }
  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    if (!this.authService.isAdmin()) {
      let navigationParams = ["login", "errors"];
      if(route.paramMap.get('errorReportId') !== null) navigationParams.push(route.paramMap.get('errorReportId') as string);
      this.router.navigate(navigationParams);
      return false;
    }
    return true;
  }
  
}
