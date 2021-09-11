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
          this.socketService.socket.emit('listenerclient_connect', {
            deviceId: this.socketService.devices[this.currentDeviceIdx!].id,
            listenerType: "web",
            canBeReassigned: true,
            canBeFlashed: true,
            supportsChat: true,
          });
        }
      });
    });
    this.socketService.socket.on('flash', function () {
      document.body.classList.add('flash');
      setTimeout(function () {
        document.body.classList.remove('flash');
      }, 500);
    });
    this.socketService.deviceStateChanged.subscribe((deviceStates) => {
      if (this.currentDeviceIdx === undefined) {
        return;
      }
      const hightestPriorityBus = deviceStates.filter((d) => d.deviceId == this.socketService.devices[this.currentDeviceIdx!].id && d.sources.length > 0).map(({busId}) => this.socketService.busOptions.find((b) => b.id == busId)).reduce((a: any, b: any) => a?.priority > b?.priority ? a : b, {}) as BusOption;
      if (!hightestPriorityBus || Object.entries(hightestPriorityBus).length == 0) {
        this.currentBus = undefined;
        return;
      }
      if (hightestPriorityBus.type == "program") {
        window.navigator.vibrate(400);
      } else if (hightestPriorityBus.type == "preview") {
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

