import { Injectable } from '@angular/core';
import { SocketService } from './socket.service';

export interface LoginResponse {
  loginOk: boolean;
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private _isProducer = false;
  private _isAdmin = false;
  constructor(private socketService: SocketService) { }

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
}
