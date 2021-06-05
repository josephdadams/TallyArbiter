import { Component, ElementRef, ViewChild } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Confirmable } from 'src/app/_decorators/confirmable.decorator';
import { CloudClient } from 'src/app/_models/CloudClient';
import { CloudDestination } from 'src/app/_models/CloudDestination';
import { Device } from 'src/app/_models/Device';
import { DeviceAction } from 'src/app/_models/DeviceAction';
import { DeviceSource } from 'src/app/_models/DeviceSource';
import { ListenerClient } from 'src/app/_models/ListenerClient';
import { LogItem } from 'src/app/_models/LogItem';
import { OutputType } from 'src/app/_models/OutputType';
import { Source } from 'src/app/_models/Source';
import { SourceType } from 'src/app/_models/SourceType';
import { TSLClient } from 'src/app/_models/TSLClient';
import { SocketService } from 'src/app/_services/socket.service';
import Swal from 'sweetalert2';

const globalSwalOptions = {
  confirmButtonColor: "#2a70c7",
};

type LogLevel = { title: string; id: string };

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent {
  @ViewChild('logsContainer') private logsContainer!: ElementRef;
  @ViewChild('tallyDataContainer') private tallyDataContainer!: ElementRef;
  
  public logLevels: LogLevel[] = [
    { title: "Error", id: "error" },
    { title: "Console", id: "console-action" },
    { title: "Info", id: "info" },
    { title: "Verbose", id: "info-quiet" },
  ];
  public currentLogLevel = "info";
  public visibleLogs: LogItem[] = [];

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
  
  // add / edit Device Actions
  public editingDeviceAction = false;
  public currentDeviceAction: DeviceAction = {} as DeviceAction;

  // add / edit TSL Client
  public editingTSLClient = false;
  public currentTSLClient: TSLClient = {} as TSLClient;

  // add / edit Cloud Destination
  public editingCloudDestination = false;
  public currentCloudDestination: CloudDestination = {} as CloudDestination;

  public newCloudKey = "";

  constructor(private modalService: NgbModal, public socketService: SocketService) {
    this.socketService.joinAdmins();
    this.socketService.closeModals.subscribe(() => this.modalService.dismissAll());
    this.socketService.scrollTallyDataSubject.subscribe(() => this.scrollToBottom(this.tallyDataContainer));
    this.socketService.newLogsSubject.subscribe(() => {
      this.filterLogs();
      this.scrollToBottom(this.logsContainer);
    });
  }

  private portInUse(portToCheck: number, sourceId: string) {
    for (const port of this.socketService.portsInUse) {
      if (port.port.toString() === portToCheck.toString()) {
        if (port.sourceId === sourceId) {
          //this source owns this port, it's ok
          return false;
        } else {
          //this source doesn't own this port
          return true;
        }
      }
    }
    //the port isn't in use, it's ok
    return false;
  }

  public setLogLevel(logLevel: string) {
    this.currentLogLevel = logLevel;
    this.filterLogs();
    this.scrollToBottom(this.logsContainer);
  }

  private filterLogs() {
    const index = this.logLevels.findIndex((l) => l.id == this.currentLogLevel);
    const allowedLogLevels = this.logLevels.filter((l, i) => i <= index).map((l) => l.id);
    this.visibleLogs = this.socketService.logs.filter((l) => allowedLogLevels.includes(l.type));
  }

  public ngOnInit() {
    this.setLogLevel(this.currentLogLevel);
  }

  public saveDeviceSource() {
    this.editingDeviceSource = false;
    const deviceSourceObj = {
      // is fine, the override is intentionally
      // @ts-ignore
      deviceId: this.currentDevice.id,
      ...this.currentDeviceSource,
      sourceId: this.socketService.sources[this.currentDeviceSource.sourceIdx!].id,
    } as DeviceSource;

    let arbiterObj = {
      action: deviceSourceObj.id !== undefined ? 'edit' : "add",
      type: "device_source",
      device_source: deviceSourceObj,
    };
    this.socketService.socket.emit('manage', arbiterObj);
  }

  public reassignListenerClient(client: ListenerClient, newDeviceId: string) {
      this.socketService.socket.emit('reassign', client.id, client.deviceId, newDeviceId);
  }

  public deleteListener(listenerClient: ListenerClient) {
	  this.socketService.socket.emit('listener_delete', listenerClient.id);
  }

  public saveCloudKey() {
    this.socketService.socket.emit('manage', {
      action: "add",
      type: "cloud_key",
      key: this.newCloudKey,
    });
    this.newCloudKey = "";
    this.modalService.dismissAll();
  }

  public removeCloudClient(client: CloudClient) {
    let arbiterObj = {
      action: 'remove',
      type: 'cloud_client',
      id: client.id,
    };
    this.socketService.socket.emit('manage', arbiterObj);
  }

  public addCloudKey(cloudKeyModal: any) {
    this.modalService.open(cloudKeyModal);
  }

  public saveDeviceAction() {
    this.editingDeviceAction = false;
    const deviceActionObj = {
      // is fine, the override is intentionally
      // @ts-ignore
      deviceId: this.currentDevice.id,
      ...this.currentDeviceAction,
      outputTypeId: this.socketService.outputTypes[this.currentDeviceAction.outputTypeIdx!].id,
    } as DeviceAction;

    let arbiterObj = {
      action: deviceActionObj.id !== undefined ? 'edit' : "add",
      type: "device_action",
      device_action: deviceActionObj,
    };
    this.socketService.socket.emit('manage', arbiterObj);
  }

  public updateDeviceSourceLink(bus: 'preview' | 'program', value: boolean) {
    this.socketService.socket.emit('device_sources_link', this.currentDevice.id, bus, value);
  }

  @Confirmable('If you delete this key, all connected cloud clients using this key will be disconnected. Are you sure you want to delete it?')
  public deleteCloudKey(key: string) {
    const arbiterObj = {
      action: 'delete',
      type: 'cloud_key',
      key,
    };
    this.socketService.socket.emit('manage', arbiterObj);
  }
  
  public disconnectCloudDestination(cloudDestination: CloudDestination) {
    this.socketService.socket.emit('cloud_destination_disconnect', cloudDestination.id);
  }
  
  public reconnectCloudDestination(cloudDestination: CloudDestination) {
    this.socketService.socket.emit('cloud_destination_reconnect', cloudDestination.id)
  }
  
  @Confirmable('Are you sure you want to delete this device?')
  public async deleteDevice(device: Device) {
    let listenerCount = this.socketService.listenerClients.filter((l) => l.deviceId == device.id).length;
    if (listenerCount > 0) {
      let result = await Swal.fire({
        title: 'Confirmation',
        text: "There are listeners connected to this device. Delete anyway?",
        showCancelButton: true,
        icon: 'question',
        focusCancel: true,
        ...globalSwalOptions,
    });
      if (!result) {
        return;
      }
    }
    let arbiterObj = {
      action: 'delete',
      type: 'device',
      deviceId: device.id,
    };
    this.socketService.socket.emit('manage', arbiterObj);
  }

  public editDeviceSource(deviceSource: DeviceSource) {
    this.currentDeviceSource = {
      ...deviceSource,
      sourceIdx: this.socketService.sources.findIndex((s) => s.id == deviceSource.sourceId),
    };
    this.editingDeviceSource = true;
  }

  public editDeviceAction(deviceAction: DeviceAction) {
    this.currentDeviceAction = {
      ...deviceAction,
      outputTypeIdx: this.socketService.outputTypes.findIndex((t) => t.id == deviceAction.outputTypeId),
    };
    this.editingDeviceAction = true;
  }

  public addDeviceAction() {
    this.editingDeviceAction = true;
    this.currentDeviceAction = {
      data: {},
    } as DeviceAction;
  }

  @Confirmable("Are you sure you want to delete this device source mapping?")
  public deleteDeviceSource(deviceSource: DeviceSource) {
    let arbiterObj = {
      action: 'delete',
      type: 'device_source',
      device_source: {
        id: deviceSource.id,
      },
    };
    this.socketService.socket.emit('manage', arbiterObj);
  }

  @Confirmable("Are you sure you want to delete this TSL Client?")
  public deleteTSLClient(tslClient: TSLClient) {
    let arbiterObj = {
      action: 'delete',
      type: 'tsl_client',
      tslClientId: tslClient.id,
    };
    this.socketService.socket.emit('manage', arbiterObj);
  }

  
  @Confirmable("Are you sure you want to delete this Cloud Destination?")
  public deleteCloudDestination(cloudDestination: CloudDestination) {
    let arbiterObj = {
      action: 'delete',
      type: 'cloud_destination',
      cloudId: cloudDestination.id,
    };
    this.socketService.socket.emit('manage', arbiterObj);
  }

  @Confirmable("Are you sure you want to delete this action?")
  public deleteDeviceAction(deviceAction: DeviceAction) {
    let arbiterObj = {
      action: 'delete',
      type: 'device_action',
      device_action: {
        id: deviceAction.id,
      },
    };
    this.socketService.socket.emit('manage', arbiterObj);
  }

  public getOptionFields(sourceType: SourceType) {
    return this.socketService.sourceTypeDataFields.find((s) => s.sourceTypeId == sourceType.id)?.fields || [];
  }

  public getOutputOptionFields(outputType: OutputType) {
    return this.socketService.outputTypeDataFields.find((t) => t.outputTypeId == outputType.id)?.fields || [];
  }

  public filterEnabledSourceTypes(sourceTypes: SourceType[]) {
    return sourceTypes.filter((s) => s.enabled);
  }

  public getSourceBusOptionsBySourceTypeId(sourceTypeId: string) {
    return this.socketService.sourceTypesBusOptions.filter((obj) => obj.sourceTypeId === sourceTypeId);
  }

  public toggleTestMode() {
    this.socketService.testModeOn = !this.socketService.testModeOn;
    this.socketService.socket.emit('testmode', this.socketService.testModeOn);
  }

  public getDeviceSourcesByDeviceId(deviceId: string) {
    return this.socketService.deviceSources.filter(obj => obj.deviceId === deviceId);
  }

  public getDeviceActionsByDeviceId(deviceId: string) {
    return this.socketService.deviceActions.filter(obj => obj.deviceId === deviceId);
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

  
  @Confirmable("Are you sure you want to delete this source?")
  public deleteSource(source: Source) {
    const arbiterObj = {
      action: 'delete',
      type: 'source',
      sourceId: source.id,
    };
    this.socketService.socket.emit('manage', arbiterObj);
  }

  public saveCurrentSource() {
    for (const field of this.getOptionFields(this.socketService.sourceTypes[this.currentSourceSelectedTypeIdx!])) {
      if (this.currentSource.data[field.fieldName] === null || this.currentSource.data[field.fieldName] === undefined || this.currentSource.data[field.fieldName].toString().trim().length === 0) {
        Swal.fire({
          icon: "error",
          text: "Not all fields filled out!",
          title: "Error",
          ...globalSwalOptions,
        });
        return;
      }
      if (field.fieldType == "port") {
        if (this.portInUse(this.currentSource.data[field.fieldName], this.currentSource.id)) {
          Swal.fire({
            icon: "error",
            text: "This port is already in use. Please pick another!",
            title: "Error",
            ...globalSwalOptions,
          });
          return;
        }
      }
    }
    const sourceObj = {
      ...this.currentSource,
      sourceTypeId: this.socketService.sourceTypes[this.currentSourceSelectedTypeIdx!].id,
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
    this.socketService.socket.emit('manage', arbiterObj);
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
    this.socketService.socket.emit('manage', arbiterObj);
  }

  public saveCurrentTSLClient() {
    const tslClientObj = {
      ...this.currentTSLClient,
    } as TSLClient;
    const arbiterObj = {
      action: this.editingTSLClient ? 'edit' : 'add',
      type: 'tsl_client',
      tslClient: tslClientObj,
    };
    this.socketService.socket.emit('manage', arbiterObj);
  }

  public saveCurrentCloudDestination() {
    const cloudDestinationObj = {
      ...this.currentCloudDestination,
    } as CloudDestination;
    const arbiterObj = {
      action: this.editingCloudDestination ? 'edit' : 'add',
      type: 'cloud_destination',
      cloudDestination: cloudDestinationObj,
    };
    this.socketService.socket.emit('manage', arbiterObj);
  }


  public getBusById(busId: string) {
    return this.socketService.busOptions.find(({id}) => id === busId);
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

  public addTSLClient(modal: any) {
    this.editingTSLClient = false;
    this.currentTSLClient = { } as TSLClient;
    this.modalService.open(modal);
  }

  public addCloudDestination(modal: any) {
    this.editingCloudDestination = false;
    this.currentCloudDestination = { } as CloudDestination;
    this.modalService.open(modal);
  }

  public getOutputTypeById(outputTypeId: string) {
    return this.socketService.outputTypes.find(({id}) => id === outputTypeId);
  }
  

  public editSource(source: Source, modal: any) {
    this.editingSource = true;
    this.currentSourceSelectedTypeIdx = this.socketService.sourceTypes.findIndex((t) => t.id == source.sourceTypeId);
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
  public editTSLClient(tslClient: TSLClient, modal: any) {
    this.editingTSLClient = true;
    this.currentTSLClient = {
      ...tslClient,
    } as TSLClient;
    this.modalService.open(modal);
  }
  public editCloudDestination(cloudDestination: CloudDestination, modal: any) {
    this.editingCloudDestination = true;
    this.currentCloudDestination = {
      ...cloudDestination,
    } as CloudDestination;
    this.modalService.open(modal);
  }

  public reconnect(source: Source): void {
	  this.socketService.socket.emit('reconnect_source', source.id);
  }

  public flash(listenerClient: ListenerClient) {    
	  this.socketService.socket.emit('flash', listenerClient.id);
  }

  private scrollToBottom(e: ElementRef) {
    setTimeout(() => {
      try {
        e.nativeElement.scrollTop = e.nativeElement.scrollHeight;
      } catch { }
    });
  }

}
