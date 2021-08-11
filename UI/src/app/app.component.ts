import { Component } from '@angular/core';
import { WakeLockService } from './_services/wake-lock.service';
import { SocketService } from './_services/socket.service';
import { Router } from '@angular/router';
import { Confirmable } from './_decorators/confirmable.decorator';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  public showMenu = false;
  constructor(private wakeLockService: WakeLockService, private router: Router, private SocketService: SocketService) {
    wakeLockService.init();
    this.SocketService.socket.on('server_error', (id: string) => {
      this.show_error(id);
    });
  }

  @Confirmable("There was an unexpected error. Do you want to view the bug report?", false)
  public show_error(id: string) {
    window.open(`/#/errors/${id}`, '_blank');
  }
}
