import { Injectable } from '@angular/core';
import { SocketService } from './socket.service';
import jwt_decode from 'jwt-decode';

export interface LoginResponse {
  loginOk: boolean;
  message: string;
  accessToken: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private _isProducer = false;
  private _isAdmin = false;

  public access_token: string = "";
  public profile: any = undefined;

  constructor(private socketService: SocketService) {
    if(localStorage.getItem("access_token") !== null) {
      this.access_token = localStorage.getItem("access_token") as string;
      this.loadProfile();
      this.socketService.sendAccessToken(this.access_token);
    }
  }

  private setToken(value: string) {
    localStorage.setItem("access_token", value);
    this.access_token = value;
    this.loadProfile();
    this.socketService.sendAccessToken(this.access_token);
  }

  private removeToken() {
    localStorage.removeItem("access_token");
    this.access_token = "";
  }

  public loadProfile() {
    console.log("Loading profile", this.access_token);
    let now = Date.now().valueOf() / 1000;
    let decoded: any = jwt_decode(this.access_token);
    if (typeof decoded.exp !== 'undefined' && decoded.exp < now) {
      return false;
    }
    if (typeof decoded.nbf !== 'undefined' && decoded.nbf > now) {
      return false;
    }
    this.profile = decoded.user;

    console.log(this.profile);
    return true;
  }

  public isProducer() {
    return this._isProducer;
  }
  
  public isAdmin() {
    return this._isAdmin;
  }

  public login(type: "producer" | "settings", username: string, password: string) {
    return new Promise<LoginResponse>((resolve) => {
      this.socketService.socket.emit("login", type, username, password);
      this.socketService.socket.once("login_response", (response: LoginResponse) => {
        if (response.loginOk === true) {
          this.setToken(response.accessToken);
          if (type == "producer") {
            this._isProducer = true;
          } else {
            this._isAdmin = true;
          }
        }
        resolve(response);
      })
    })
  }

  public logout() {
    this.removeToken();
    this._isProducer = false;
    this._isAdmin = false;
    this.profile = undefined;
  }
}
