import { Component } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { BusOption } from 'src/app/_models/BusOption';
import { Device } from 'src/app/_models/Device';
import { DeviceState } from 'src/app/_models/DeviceState';
import { ListenerClient } from 'src/app/_models/ListenerClient';
import { Source } from 'src/app/_models/Source';

@Component({
  selector: 'app-producer',
  templateUrl: './producer.component.html',
  styleUrls: ['./producer.component.scss']
})
export class ProducerComponent {
  private socket: Socket;
  public devices: Device[] = [];
  public deviceStates: DeviceState[] = [];
  public currentDeviceIdx?: number;
  public mode_preview?: boolean;
  public mode_program?: boolean;
  public listenerClients: ListenerClient[] = [];
  private sources: Source[] = [];
  private busOptions: BusOption[] = [];
  
  constructor() {
    this.socket = io();
    this.socket.on('connect', () => {
      //connected, let's get some data
      this.socket.emit('producer');
    });
    this.socket.on('sources', (sources: Source[]) => {
      this.sources = sources;
    });
    this.socket.on('devices', (devices: Device[]) => {
      this.devices = devices;
    });
    this.socket.on('bus_options', (busOptions: BusOption[]) => {
      this.busOptions = busOptions;
    });
    this.socket.on('listener_clients', (listenerClients: ListenerClient[]) => {
      for (const device of this.devices) {
        device.listenerCount = 0;
      }
      this.listenerClients = listenerClients.map((l: any) => {
        l.ipAddress = l.ipAddress.replace('::ffff:', '');
        l.device = this.devices.find((d) => d.id == l.deviceId);
        if (!l.inactive) l.device.listenerCount += 1;
        return l;
      }).sort((a: any, b: any) => (a.inactive === b.inactive)? 0 : a.inactive ? 1 : -1);
    });
    this.socket.on('device_states', (states: DeviceState[]) => {
      this.deviceStates = states;
      
      for (const device of this.devices) {
        let sources_pvw = [];
        let sources_pgm = [];
        device.modeProgram = false;
        device.modePreview = false;
        for (const state of this.deviceStates.filter((s) => s.deviceId == device.id)) {
          if (this.getBusById(state.busId)!.type === 'preview') {
            if (state.sources.length > 0) {
              device.modePreview = true;
              sources_pvw = state.sources;
            } else {
              device.modePreview = false;
            }
          } else if (this.getBusById(state.busId)!.type === 'program') {
            if (state.sources.length > 0) {
              device.modeProgram = true;
              sources_pgm = state.sources;
            } else {
              device.modeProgram = false;
            }
          }
        }
      }
    });
    this.socket.on('messaging', (type, socketid, message) => {
      // insertChat(type, socketid, message);
    });
  }

  public flashListener(listener: any) {
    this.socket.emit('flash', listener.id);
  }

  private getBusById(busId: string) {
    //gets the bus type (preview/program) by the bus id
    return this.busOptions.find(({id}) => id === busId);
  }

  private getBusTypeById(busId: string) {
    //gets the bus type (preview/program) by the bus id
    let bus = this.busOptions.find(({id}: {id: string}) => id === busId);
    return bus?.type;
  }
}
