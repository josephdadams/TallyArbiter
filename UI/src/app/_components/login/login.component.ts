import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService, LoginResponse } from 'src/app/_services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  public loading = false;
  public loginResponse: LoginResponse = {loginOk: false, message: ''};
  public username = "";
  public password = "";
  private type!: "producer" | "settings";
  private redirectParam = "";
  private extraParam = "";
  @ViewChild("inputPassword") public inputPassword!: ElementRef;

  constructor(
    public route: ActivatedRoute,
    private router: Router,
    private authService: AuthService
  ) {
    this.route.params.subscribe((params) => {
      if (params.redirect) {
        this.redirectParam = params.redirect;
      }
      if (params.extraParam) {
        this.extraParam = params.extraParam;
      }
    });
    console.log(this.redirectParam);
    console.log(this.extraParam);
    switch (this.redirectParam) {
      case "producer":
        this.type = "producer";
        break;

      case "errors":
      case "settings":
        this.type = "settings";
        break;

      default:
        this.router.navigate(["/home"]);
        break;
    }
  }
  
  login(): void {
    this.loading = true;
    this.authService.login(this.type, this.username, this.password).then((response: LoginResponse) => {
      this.loginResponse = response;
      this.loading = false;
      if (response.loginOk === true) {
        let navigateParams = [this.redirectParam];
        if(this.extraParam !== "") navigateParams.push(this.extraParam);
        this.router.navigate(navigateParams);
      }
    });
  }
}
