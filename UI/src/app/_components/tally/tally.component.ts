import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { io, Socket } from 'socket.io-client';

@Component({
  selector: 'app-tally',
  templateUrl: './tally.component.html',
  styleUrls: ['./tally.component.scss']
})
export class TallyComponent {
  private socket: Socket;
  public devices: any[] = [];
  public busOptions: any;
  public deviceStates: any;
  public selectedDeviceId: any;
  public currentDeviceIdx?: number;
  mode_preview?: boolean;
  mode_program?: boolean;
  
  constructor(private router: Router, private route: ActivatedRoute) {
    this.socket = io();
    this.socket.on('connect', () => {
      //connected, let's get some data
      this.socket.emit('devices');
      this.socket.emit('bus_options');
    });
    this.socket.on('devices', (deviceArray) => {
      //Returns a list of available Devices for the dropdown list
      this.devices = deviceArray;
      this.route.params.subscribe((params) => {
        if (params.deviceId) {
          this.currentDeviceIdx = this.devices.findIndex((d) => d.id == params.deviceId);
          this.socket.emit('device_listen', this.devices[this.currentDeviceIdx!].id, 'web');
        }
      });
    });
    this.socket.on('bus_options', (busOptionsArray) => {
      //Returns a list of available bus options (preview, program, etc.)
      this.busOptions = busOptionsArray;
    });
    this.socket.on('device_states', (tallyDataArray) => {
      //process the data received and determine if it's in preview or program and color the screen accordingly
      this.deviceStates = tallyDataArray;
      for (let i = 0; i < this.deviceStates.length; i++) {
        if (this.getBusTypeById(this.deviceStates[i].busId) === 'preview') {
          if (this.deviceStates[i].sources.length > 0) {
            this.mode_preview = true;
          }
          else {
            this.mode_preview = false;
          }
        }
        else if (this.getBusTypeById(this.deviceStates[i].busId) === 'program') {
          if (this.deviceStates[i].sources.length > 0) {
            this.mode_program = true;
          }
          else {
            this.mode_program = false;
          }
        }
      }
      if ((this.mode_preview) && (!this.mode_program)) {
        //preview mode, color it green
        document.body.style.backgroundColor = '#00FF00';
      }
      else if ((!this.mode_preview) && (this.mode_program)) {
        //program mode, color it red
        document.body.style.backgroundColor = '#FF0000';
      }
      else if ((this.mode_preview) && (this.mode_program)) {
        //both, color it yellow
        document.body.style.backgroundColor = '#FFCC00';
      }
      else {
        document.body.style.backgroundColor = '#000000';
      }
      
      if (this.mode_program) {
        let successBool = window.navigator.vibrate(400);
      }
      else if (this.mode_preview) {
        let successBool = (window.navigator as any).vibrate(100, 30, 100, 30, 100);
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
    return bus.type;
  }

  public selectDevice(id: any) {
    this.router.navigate(["/", "tally", id.target.value]);
  }
}

