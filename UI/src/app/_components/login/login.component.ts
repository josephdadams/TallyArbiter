import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
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
  @ViewChild("inputPassword") public inputPassword!: ElementRef;

  constructor(private router: Router, private authService: AuthService) {
  }
  
  login(): void {
    this.loading = true;
    this.type = this.router.url.endsWith("producer") ? "producer" : "settings";
    this.authService.login(this.type, this.username, this.password).then((response: LoginResponse) => {
      this.loginResponse = response;
      this.loading = false;
      if (response.loginOk === true) {
        this.router.navigate([this.type]);
      }
    });
  }
}
