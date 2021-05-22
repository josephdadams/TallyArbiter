import { Component } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { io, Socket } from 'socket.io-client';

@Component({
  selector: 'app-producer',
  templateUrl: './producer.component.html',
  styleUrls: ['./producer.component.scss']
})
export class ProducerComponent {
  private socket: Socket;
  public devices: any[] = [];
  public deviceStates: any;
  public currentDeviceIdx?: number;
  mode_preview?: boolean;
  mode_program?: boolean;
  sources: any;
  busOptions: any;
  listenerClients: any;
  
  constructor() {
    this.socket = io();
    this.socket.on('connect', () => {
      //connected, let's get some data
      this.socket.emit('producer');
    });
    this.socket.on('sources', (data) => {
      this.sources = data;
    });
    this.socket.on('devices', (deviceArray) => {
      //Returns a list of available Devices for the dropdown list
      this.devices = deviceArray;
    });
    this.socket.on('bus_options', (busOptionsArray) => {
      //Returns a list of available bus options (preview, program, etc.)
      this.busOptions = busOptionsArray;
    });
    this.socket.on('listener_clients', (data) => {
      for (const device of this.devices) {
        device.listenerCount = 0;
      }
      this.listenerClients = data.map((l: any) => {
        l.ipAddress = l.ipAddress.replace('::ffff:', '');
        l.device = this.devices.find((d) => d.id == l.deviceId);
        if (!l.inactive) l.device.listenerCount += 1;
        return l;
      });
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
    this.socket.on('messaging', (type, socketid, message) => {
      // insertChat(type, socketid, message);
    });
  }

  public flashListener(listener: any) {
    this.socket.emit('flash', listener.id);
  }

  private getBusTypeById(busId: string) {
    //gets the bus type (preview/program) by the bus id
    let bus = this.busOptions.find(({id}: {id: string}) => id === busId);
    return bus.type;
  }
}
