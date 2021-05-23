import { Component, ElementRef, ViewChild } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { io, Socket } from 'socket.io-client';
import { BusOption } from 'src/app/_models/BusOption';
import { Device } from 'src/app/_models/Device';
import { DeviceAction } from 'src/app/_models/DeviceAction';
import { DeviceSource } from 'src/app/_models/DeviceSource';
import { DeviceState } from 'src/app/_models/DeviceState';
import { ListenerClient } from 'src/app/_models/ListenerClient';
import { LogItem } from 'src/app/_models/LogItem';
import { OutputType } from 'src/app/_models/OutputType';
import { OutputTypeDataFields } from 'src/app/_models/OutputTypeDataFields';
import { Source } from 'src/app/_models/Source';
import { SourceTallyData } from 'src/app/_models/SourceTallyData';
import { SourceType } from 'src/app/_models/SourceType';
import { SourceTypeBusOptions } from 'src/app/_models/SourceTypeBusOptions';
import { SourceTypeDataFields } from 'src/app/_models/SourceTypeDataFields';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent {
  @ViewChild('logsContainer') private logsContainer!: ElementRef;
  @ViewChild('tallyDataContainer') private tallyDataContainer!: ElementRef;
  public version?: string;
  public logs: LogItem[] = [];
  public sources: Source[] = [];
  public tallyData: LogItem[] = [];
  public socket: Socket;
  public sourceTypes: SourceType[] = [];
  public devices: Device[] = [];
  public listenerClients: ListenerClient[] = [];
  public sourceTypeDataFields: SourceTypeDataFields[] = [];
  public testModeOn = false;
  public deviceStates: DeviceState[] = [];
  public busOptions: BusOption[] = [];
  public tslclients_1secupdate?: boolean;
  public deviceSources: DeviceSource[] = [];
  public sourceTallyData: Record<string, SourceTallyData[]> = {};
  public deviceActions: DeviceAction[] = [];
  public outputTypes: OutputType[] = [];
  public outputTypeDataFields: OutputTypeDataFields[] = [];
  
  // add / edit Source
  public editingSource = false;
  public currentSourceSelectedTypeIdx?: number;
  public currentSource: Source = {} as Source;
  
  // add / edit Device
  public editingDevice = false;
  public currentDevice: Device = {} as Device;
  
  // add / edit Device Source
  public editingDeviceSource = false;
  public currentDeviceSource: DeviceSource = {} as DeviceSource;
  public sourceTypesBusOptions: SourceTypeBusOptions[] = [];
  
  // add / edit Device Actions
  public editingDeviceAction = false;
  public currentDeviceAction: DeviceAction = {} as DeviceAction;

  constructor(private modalService: NgbModal) {
    this.socket = io();
    this.socket.on('connect', () => {
      this.socket.emit('version');
      this.socket.emit('settings');
    });
    this.socket.on("version", (version: string) => {
      this.version = version;
    });
    this.socket.on("logs", (logs: LogItem[]) => {
      this.logs = logs;
    });
    this.socket.on("log_item", (log: LogItem) => {
      this.logs.push(log);
      this.scrollToBottom(this.logsContainer);
    });
    this.socket.on("source_tallydata", (sourceId: string, data: SourceTallyData[]) => {
      this.sourceTallyData[sourceId] = data;
    });
    this.socket.on('tally_data', (sourceId, tallyObj) => {
      let tallyPreview = (tallyObj.tally1 === 1 ? 'True' : 'False');
      let tallyProgram = (tallyObj.tally2 === 1 ? 'True' : 'False');
      this.tallyData.push({
        datetime: Date.now().toString(),
        log: `Source: ${this.getSourceById(sourceId)?.name}  Address: ${tallyObj.address}  Label: ${tallyObj.label}  PVW: ${tallyPreview}  PGM: ${tallyProgram}`,
        type: 'info',
      });
      this.scrollToBottom(this.tallyDataContainer);
    });
    this.socket.on('sources', (sources: Source[]) => {
      this.sources = this.prepareSources(sources);
    });
    this.socket.on('device_states', (deviceStates: DeviceState[]) => {
      this.deviceStates = deviceStates;
      this.setDeviceStates();
    });
    this.socket.on('device_sources', (deviceSources: DeviceSource[]) => {
      this.deviceSources = deviceSources;
    });
    this.socket.on('device_actions', (deviceActions: DeviceAction[]) => {
      this.deviceActions = deviceActions;
    });
    this.socket.on('devices', (devices: Device[]) => {
      this.devices = devices;
      this.setDeviceStates();
    });
    this.socket.on('initialdata', (sourceTypes: SourceType[], sourceTypesDataFields: SourceTypeDataFields[], sourceTypesBusOptions: SourceTypeBusOptions[], outputTypes: OutputType[], outputTypesDataFields: OutputTypeDataFields[], busOptions: BusOption[], sourcesData: Source[], devicesData: Device[], deviceSources: DeviceSource[], deviceActions: DeviceAction[], deviceStates: DeviceState[], tslClients, cloudDestinations, cloudKeys, cloudClients) => {
      this.sourceTypes = sourceTypes;
      this.sourceTypeDataFields = sourceTypesDataFields;
      this.sourceTypesBusOptions = sourceTypesBusOptions;
      this.outputTypes = outputTypes;
      this.outputTypeDataFields = outputTypesDataFields;
      this.busOptions = busOptions;
      this.sources =  this.prepareSources(sourcesData);
      this.devices = devicesData;
      this.deviceSources = deviceSources;
      this.deviceActions = deviceActions;
      this.deviceStates = deviceStates;
      // this.tsl_clients = tslClients;
      // this.cloud_destinations = cloudDestinations;
      // this.cloud_keys = cloudKeys;
      // this.cloud_clients = cloudClients;
      this.setDeviceStates();
    });
    this.socket.on('listener_clients', (listenerClients: ListenerClient[]) => {
      this.listenerClients = listenerClients.map((l) => {
        l.ipAddress = l.ipAddress.replace("::ffff:", "");
        return l;
      });
    });

    this.socket.on('manage_response', (response) => {
      switch (response.result) {
        case 'source-added-successfully':
        case 'source-edited-successfully':
        case 'source-deleted-successfully':
          this.modalService.dismissAll();
          this.socket.emit('sources');
          this.socket.emit('devices');
          break;
        case 'device-added-successfully':
        case 'device-edited-successfully':
        case 'device-deleted-successfully':
          this.modalService.dismissAll();
          this.socket.emit('devices');
          this.socket.emit('device_sources');
          this.socket.emit('device_actions');
          this.socket.emit('device_states');
          this.socket.emit('listener_clients');
          break;
        case 'device-source-added-successfully':
        case 'device-source-edited-successfully':
          this.socket.emit('device_sources');
          this.modalService.dismissAll();
          break;
        case 'device-source-deleted-successfully':
          this.socket.emit('device_sources');
          break;
        case 'device-action-added-successfully':
        case 'device-action-edited-successfully':
        case 'device-action-deleted-successfully':
          this.modalService.dismissAll();
          this.socket.emit('devices');
          this.socket.emit('device_actions');
          break;
        case 'tsl-client-added-successfully':
        case 'tsl-client-edited-successfully':
        case 'tsl-client-deleted-successfully':
          this.modalService.dismissAll();
          this.socket.emit('tsl_clients');
          break;
        case 'cloud-destination-added-successfully':
        case 'cloud-destination-edited-successfully':
        case 'cloud-destination-deleted-successfully':
          this.modalService.dismissAll();
          this.socket.emit('cloud_destinations');
          break;
        case 'cloud-key-added-successfully':
        case 'cloud-key-deleted-successfully':
          this.modalService.dismissAll();
          this.socket.emit('cloud_keys');
          break;
        case 'cloud-client-removed-successfully':
          this.modalService.dismissAll();
          this.socket.emit('cloud_clients');
          break;
        case 'error':
          alert('Unexpected Error Occurred: ' + response.error);
          break;
        default:
          alert(response.result);
          break;
      }
    });
    this.socket.on('testmode', (value) => {
      this.testModeOn = value;
    });
    this.socket.on('tslclients_1secupdate', (value) => {
      this.tslclients_1secupdate = value;
    });
  }

  public saveDeviceSource() {
    this.editingDeviceSource = false;
    const deviceSourceObj = {
      // is fine, the override is intentionally
      // @ts-ignore
      deviceId: this.currentDevice.id,
      ...this.currentDeviceSource,
      sourceId: this.sources[this.currentDeviceSource.sourceIdx!].id,
    } as DeviceSource;

    let arbiterObj = {
      action: deviceSourceObj.id !== undefined ? 'edit' : "add",
      type: "device_source",
      device_source: deviceSourceObj,
    };
    console.log(deviceSourceObj)
    this.socket.emit('manage', arbiterObj);
  }

  public saveDeviceAction() {
    this.editingDeviceAction = false;
    const deviceActionObj = {
      // is fine, the override is intentionally
      // @ts-ignore
      deviceId: this.currentDevice.id,
      ...this.currentDeviceAction,
      outputTypeId: this.outputTypes[this.currentDeviceAction.outputTypeIdx!].id,
    } as DeviceAction;

    let arbiterObj = {
      action: deviceActionObj.id !== undefined ? 'edit' : "add",
      type: "device_action",
      device_action: deviceActionObj,
    };
    console.log(deviceActionObj)
    this.socket.emit('manage', arbiterObj);
  }

  public updateDeviceSourceLink(bus: 'preview' | 'program', value: boolean) {
    this.socket.emit('device_sources_link', this.currentDevice.id, bus, value);
  }

  public deleteDevice(device: Device) {
    let result = confirm('Are you sure you want to delete this device?');
    if (!result) {
      return;
    }
    let listenerCount = this.listenerClients.filter((l) => l.deviceId == device.id).length;
    if (listenerCount > 0) {
      let result = confirm('There are listeners connected to this device. Delete anyway?');
      if (!result) {
        return;
      }
    }
    let arbiterObj = {
      action: 'delete',
      type: 'device',
      deviceId: device.id,
    };
    this.socket.emit('manage', arbiterObj);
  }

  public editDeviceSource(deviceSource: DeviceSource) {
    this.currentDeviceSource = {
      ...deviceSource,
      sourceIdx: this.sources.findIndex((s) => s.id == deviceSource.sourceId),
    };
    this.editingDeviceSource = true;
  }

  public editDeviceAction(deviceAction: DeviceAction) {
    this.currentDeviceAction = {
      ...deviceAction,
      outputTypeIdx: this.outputTypes.findIndex((t) => t.id == deviceAction.outputTypeId),
    };
    this.editingDeviceAction = true;
  }

  public addDeviceAction() {
    this.editingDeviceAction = true;
    this.currentDeviceAction = {
      data: {},
    } as DeviceAction;
  }

  public deleteDeviceSource(deviceSource: DeviceSource) {
    let result = confirm('Are you sure you want to delete this device source mapping?');
    if (!result) {
      return;
    }
    let arbiterObj = {
      action: 'delete',
      type: 'device_source',
      device_source: {
        id: deviceSource.id,
      },
    };
    this.socket.emit('manage', arbiterObj);
  }

  public deleteDeviceAction(deviceAction: DeviceAction) {
    let result = confirm('Are you sure you want to delete this action?');
    if (!result) {
      return;
    }
    let arbiterObj = {
      action: 'delete',
      type: 'device_action',
      device_action: {
        id: deviceAction.id,
      },
    };
    this.socket.emit('manage', arbiterObj);
  }

  public getOptionFields(sourceType: SourceType) {
    return this.sourceTypeDataFields.find((s) => s.sourceTypeId == sourceType.id)?.fields || [];
  }

  public getOutputOptionFields(outputType: OutputType) {
    return this.outputTypeDataFields.find((t) => t.outputTypeId == outputType.id)?.fields || [];
  }

  public filterEnabledSourceTypes(sourceTypes: SourceType[]) {
    return sourceTypes.filter((s) => s.enabled);
  }

  public getSourceBusOptionsBySourceTypeId(sourceTypeId: string) {
    return this.sourceTypesBusOptions.filter((obj) => obj.sourceTypeId === sourceTypeId);
  }

  public toggleTestMode() {
    this.testModeOn = !this.testModeOn;
    this.socket.emit('testmode', this.testModeOn);
  }

  public getDeviceSourcesByDeviceId(deviceId: string) {
    return this.deviceSources.filter(obj => obj.deviceId === deviceId);
  }

  public getDeviceActionsByDeviceId(deviceId: string) {
    return this.deviceActions.filter(obj => obj.deviceId === deviceId);
  }

  public editDeviceSources(device: Device, deviceSourcesModal: any) {
    this.currentDevice = device;
    this.editingDeviceSource = false;
    this.modalService.open(deviceSourcesModal, {size: "lg"});
  }

  public editDeviceActions(device: Device, deviceActionsModal: any) {
    this.currentDevice = device;
    this.editingDeviceAction = false;
    this.modalService.open(deviceActionsModal, {size: "lg"});
  }

  public deleteSource(source: Source) {
    const result = confirm('Are you sure you want to delete this source?');
    if (!result) {
      return;
    }
    const arbiterObj = {
      action: 'delete',
      type: 'source',
      sourceId: source.id,
    };
    this.socket.emit('manage', arbiterObj);
  }

  public saveCurrentSource() {
    const sourceObj = {
      ...this.currentSource,
      sourceTypeId: this.sourceTypes[this.currentSourceSelectedTypeIdx!].id,
    } as any;
    if (!this.editingSource) {
      sourceObj.reconnect = true;
      sourceObj.enabled = true;
    }
    const arbiterObj = {
      action: this.editingSource ? 'edit' : 'add',
      type: 'source',
      source: sourceObj,
    };
    this.socket.emit('manage', arbiterObj);
  }

  public saveCurrentDevice() {
    const deviceObj = {
      ...this.currentDevice,
    } as Device;
    if (!this.editingDevice) {
      deviceObj.enabled = true;
    }
    const arbiterObj = {
      action: this.editingDevice ? 'edit' : 'add',
      type: 'device',
      device: deviceObj,
    };
    this.socket.emit('manage', arbiterObj);
  }

  private setDeviceStates() {
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
  }

  public getBusById(busId: string) {
    return this.busOptions.find(({id}) => id === busId);
  }

  private prepareSources(sources: Source[]): Source[] {
    return sources.map((s) => {
      s.sourceTypeName = this.getSourceTypeById(s.sourceTypeId)?.label;
      return s;
    });
  }

  public addSource(modal: any) {
    this.editingSource = false;
    this.currentSourceSelectedTypeIdx = undefined;
    this.currentSource = {
      data: {},
    } as Source;
    this.modalService.open(modal);
  }

  public addDevice(modal: any) {
    this.editingDevice = false;
    this.currentDevice = { } as Device;
    this.modalService.open(modal);
  }

  public getOutputTypeById(outputTypeId: string) {
    return this.outputTypes.find(({id}) => id === outputTypeId);
  }
  

  public editSource(source: Source, modal: any) {
    this.editingSource = true;
    this.currentSourceSelectedTypeIdx = this.sourceTypes.findIndex((t) => t.id == source.sourceTypeId);
    this.currentSource = {
      ...source,
      data: {
        ...source.data
      },
    } as Source;
    this.modalService.open(modal);
  }
  public editDevice(device: Device, modal: any) {
    this.editingDevice = true;
    this.currentDevice = {
      ...device,
    } as Device;
    this.modalService.open(modal);
  }

  public reconnect(source: Source): void {
	  this.socket.emit('reconnect_source', source.id);
  }

  private getSourceTypeById(sourceTypeId: string) {
    return this.sourceTypes.find(({id}: any) => id === sourceTypeId);
  }

  public flash(listenerClient: ListenerClient) {    
	  this.socket.emit('flash', listenerClient.id);
  }

  private scrollToBottom(e: ElementRef) {
    setTimeout(() => {
      try {
        e.nativeElement.scrollTop = e.nativeElement.scrollHeight;
      } catch { }
    });
  }

  
  public getSourceById(sourceId: string) {
    return this.sources.find(({id}) => id === sourceId);
  }

}
