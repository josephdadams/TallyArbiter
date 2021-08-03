import { Injectable } from '@angular/core';
import { SocketService } from './socket.service';

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
    return new Promise((resolve) => {
      this.socketService.socket.emit("login", type, username, password);
      this.socketService.socket.once("login_result", (result: boolean|number) => {
        if (result === true) {
          if (type == "producer") {
            this._isProducer = true;
          } else {
            this._isAdmin = true;
          }
          resolve(true);
        } else if(result === -1) {
          resolve(-1);
        } else {
          resolve(false);
        }
      })
    })
  }
}
