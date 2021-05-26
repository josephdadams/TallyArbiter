import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/_services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  public loading = false;
  public wrongUsernameOrPassword = false;
  public username = "";
  public password = "";
  private type!: "producer" | "settings";

  constructor(private router: Router, private authService: AuthService) {
  }
  
  login(): void {
    this.loading = true;
    this.type = this.router.url.endsWith("producer") ? "producer" : "settings";
    this.authService.login(this.type, this.username, this.password).then((result) => {
      this.loading = false;
      if (result === true) {
        this.router.navigate([this.type]);
      } else {
        this.wrongUsernameOrPassword = true;
      }
    });
  }
}
