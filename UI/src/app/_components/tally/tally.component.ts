import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { BusOption } from 'src/app/_models/BusOption';
import { DeviceState } from 'src/app/_models/DeviceState';
import { SocketService } from 'src/app/_services/socket.service';

@Component({
  selector: 'app-tally',
  templateUrl: './tally.component.html',
  styleUrls: ['./tally.component.scss']
})
export class TallyComponent {
  public currentDeviceIdx?: number;
  public mode_preview?: boolean;
  public mode_program?: boolean;
  public programPriority = true;
  public currentBus?: BusOption;
  
  public COLORS = {
    DARK_GREY: "#212529",
  }
  
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
    this.route.queryParams.subscribe((queryParams) => {
      this.programPriority = queryParams.programPriority == "false";
    });
    this.socketService.deviceStateChanged.subscribe(({device, states}) => {
      if (this.currentDeviceIdx === undefined || device.id !== this.socketService.devices[this.currentDeviceIdx].id) {
        return;
      }
      const hightestPriorityBus = states.map((s) => this.socketService.busOptions.find((b) => b.id == s.busId)).reduce((a: any, b: any) => a?.priority > b?.priority ? a : b, {});
      if (!hightestPriorityBus || Object.entries(hightestPriorityBus).length == 0) {
        this.currentBus = undefined;
        return;
      }
      if (hightestPriorityBus.id == "program") {
        window.navigator.vibrate(400);
      } else if (hightestPriorityBus.id == "preview") {
        window.navigator.vibrate([100, 30, 100, 30, 100]);
      }
      this.currentBus = hightestPriorityBus;
    });
    this.socketService.socket.on('reassign', (oldDeviceId: string, deviceId: string) => {
      //processes a reassign request that comes from the Settings GUI and relays the command so it originates from this socket
      this.socketService.socket.emit('listener_reassign', oldDeviceId, deviceId);
      this.currentDeviceIdx = this.socketService.devices.findIndex((d) => d.id === deviceId);
    });
  }

  public selectDevice(id: any) {
    this.router.navigate(["/", "tally", id.target.value]);
  }

  public ngOnDestroy() {
    this.socketService.socket.off("flash");
  }
}

