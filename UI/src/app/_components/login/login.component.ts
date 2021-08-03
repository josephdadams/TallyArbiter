import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/_services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  public loading = false;
  public loginFailed = false;
  public errorMessage = '';
  public username = "";
  public password = "";
  private type!: "producer" | "settings";
  @ViewChild("inputPassword") public inputPassword!: ElementRef;

  constructor(private router: Router, private authService: AuthService) {
  }
  
  login(): void {
    this.loading = true;
    this.type = this.router.url.endsWith("producer") ? "producer" : "settings";
    this.authService.login(this.type, this.username, this.password).then((result) => {
      this.loading = false;
      if (result === true) {
        this.router.navigate([this.type]);
      } else if (result === -1) {
        this.loginFailed = true;
        this.errorMessage = "Too many attemps! Please retry later.";
      } else {
        this.loginFailed = true;
        this.errorMessage = "Wrong username or password!";
      }
    });
  }
}
