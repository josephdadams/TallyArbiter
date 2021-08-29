import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SocketService } from 'src/app/_services/socket.service';

enum COLORS {
  DARK_GREY = "#212529",
  GREEN = "#3fe481",
  RED = "#e43f5a",
  YELLOW = "#ffc107",
}

@Component({
  selector: 'app-tally',
  templateUrl: './tally.component.html',
  styleUrls: ['./tally.component.scss']
})
export class TallyComponent {
  public currentDeviceIdx?: number;
  public mode_preview?: boolean;
  public mode_program?: boolean;
  
  constructor(
    private router: Router,
    public route: ActivatedRoute,
    public socketService: SocketService,
  ) {
    this.socketService.socket.emit('devices');
    this.socketService.socket.emit('bus_options');
    this.socketService.dataLoaded.then(() => {
      this.route.params.subscribe((params) => {
        if (params.deviceId) {
          this.currentDeviceIdx = this.socketService.devices.findIndex((d) => d.id == params.deviceId);
          this.socketService.socket.emit('device_listen', this.socketService.devices[this.currentDeviceIdx!].id, 'web');
        }
      });
    });
    this.socketService.socket.on('flash', function () {
      document.body.classList.add('flash');
      setTimeout(function () {
        document.body.classList.remove('flash');
      }, 500);
    });
    this.socketService.deviceStateChanged.subscribe(({ deviceId, program, preview }:
      { deviceId: string, program?: boolean, preview?: boolean }) => {
      if (this.currentDeviceIdx === undefined || deviceId !== this.socketService.devices[this.currentDeviceIdx].id) {
        return;
      }
      if (program) {
        window.navigator.vibrate(400);
      } else if (preview) {
        window.navigator.vibrate([100, 30, 100, 30, 100]);
      }
      
    });
    this.socketService.socket.on('reassign', (oldDeviceId: string, deviceId: string) => {
      //processes a reassign request that comes from the Settings GUI and relays the command so it originates from this socket
      this.socketService.socket.emit('listener_reassign', oldDeviceId, deviceId);
      this.currentDeviceIdx = this.socketService.devices.findIndex((d) => d.id === deviceId);
    });
  }

  public getCurrentBackgroundColor(): string {
    if (this.currentDeviceIdx === undefined) {
      return COLORS.DARK_GREY;
    }
    if (this.socketService.devices[this.currentDeviceIdx].modeProgram) {
      if (this.socketService.devices[this.currentDeviceIdx].modePreview) {
        return this.socketService.busOptions.find((b) => b.type == "previewprogram")?.color || COLORS.YELLOW;
      }
      return this.socketService.busOptions.find((b) => b.type == "program")?.color || COLORS.RED;
    }
    if (this.socketService.devices[this.currentDeviceIdx].modePreview) {
      return this.socketService.busOptions.find((b) => b.type == "preview")?.color || COLORS.GREEN;
    }
    return COLORS.DARK_GREY;
  }

  public selectDevice(id: any) {
    this.router.navigate(["/", "tally", id.target.value]);
  }

  public ngOnDestroy() {
    this.socketService.socket.off("flash");
  }
}

