import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { io, Socket } from 'socket.io-client';
import { BusOption } from 'src/app/_models/BusOption';
import { Device } from 'src/app/_models/Device';
import { DeviceState } from 'src/app/_models/DeviceState';

@Component({
  selector: 'app-tally',
  templateUrl: './tally.component.html',
  styleUrls: ['./tally.component.scss']
})
export class TallyComponent {
  private socket: Socket;
  public devices: Device[] = [];
  public busOptions: BusOption[] = [];
  public deviceStates: DeviceState[] = [];
  public selectedDeviceId?: string;
  public currentDeviceIdx?: number;
  public mode_preview?: boolean;
  public mode_program?: boolean;
  
  constructor(private router: Router, private route: ActivatedRoute) {
    this.socket = io();
    this.socket.on('connect', () => {
      //connected, let's get some data
      this.socket.emit('devices');
      this.socket.emit('bus_options');
    });
    this.socket.on('devices', (devices: Device[]) => {
      //Returns a list of available Devices for the dropdown list
      this.devices = devices;
      this.route.params.subscribe((params) => {
        if (params.deviceId) {
          this.currentDeviceIdx = this.devices.findIndex((d) => d.id == params.deviceId);
          this.socket.emit('device_listen', this.devices[this.currentDeviceIdx!].id, 'web');
        }
      });
    });
    this.socket.on('bus_options', (busOptions: BusOption[]) => {
      //Returns a list of available bus options (preview, program, etc.)
      this.busOptions = busOptions;
    });
    this.socket.on('device_states', (states: DeviceState[]) => {
      //process the data received and determine if it's in preview or program and color the screen accordingly
      this.deviceStates = states;
      for (let i = 0; i < this.deviceStates.length; i++) {
        if (this.getBusTypeById(this.deviceStates[i].busId) === 'preview') {
          if (this.deviceStates[i].sources.length > 0) {
            this.mode_preview = true;
          } else {
            this.mode_preview = false;
          }
        } else if (this.getBusTypeById(this.deviceStates[i].busId) === 'program') {
          if (this.deviceStates[i].sources.length > 0) {
            this.mode_program = true;
          } else {
            this.mode_program = false;
          }
        }
      }
      if (this.mode_program) {
        window.navigator.vibrate(400);
      } else if (this.mode_preview) {
        window.navigator.vibrate([100, 30, 100, 30, 100]);
      }
      
    });
    this.socket.on('flash', function () {
      //flashes the screen to get the user's attention
      document.body.className = 'flash';
      setTimeout(function () {
        document.body.classList.remove('flash');
      }, 500);
    });
    this.socket.on('reassign', (oldDeviceId, deviceId) => {
      //processes a reassign request that comes from the Settings GUI and relays the command so it originates from this socket
      this.socket.emit('listener_reassign', oldDeviceId, deviceId);
      this.selectedDeviceId = deviceId;
      // updateTallyInfo();
    });
    this.socket.on('messaging', (type, socketid, message) => {
      // insertChat(type, socketid, message);
    });
  }
  
  private getBusTypeById(busId: string) {
    //gets the bus type (preview/program) by the bus id
    let bus = this.busOptions.find(({id}: {id: string}) => id === busId);
    return bus?.type;
  }

  public selectDevice(id: any) {
    this.router.navigate(["/", "tally", id.target.value]);
  }
}

