import { Component, ElementRef, ViewChild } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { io, Socket } from 'socket.io-client';
import { BusOption } from 'src/app/_models/BusOption';
import { Device } from 'src/app/_models/Device';
import { DeviceState } from 'src/app/_models/DeviceState';
import { ListenerClient } from 'src/app/_models/ListenerClient';
import { LogItem } from 'src/app/_models/LogItem';
import { Source } from 'src/app/_models/Source';
import { SourceType } from 'src/app/_models/SourceType';
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
  private socket: Socket;
  public sourceTypes: SourceType[] = [];
  public devices: Device[] = [];
  public listenerClients: ListenerClient[] = [];
  public sourceTypeDataFields: SourceTypeDataFields[] = [];
  public testModeOn = false;
  public deviceStates: DeviceState[] = [];
  public busOptions: BusOption[] = [];
  public tslclients_1secupdate?: boolean;

  // add Source
  public editingSource = false;
  public currentSourceSelectedTypeIdx?: number;
  public currentSource: Source = {} as Source;

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
    this.socket.on('devices', (devices: Device[]) => {
      this.devices = devices;
      this.setDeviceStates();
    });
    this.socket.on('initialdata', (sourceTypes: SourceType[], sourceTypesDataFields: SourceTypeDataFields[], sourceTypesBusOptions, outputTypes, outputTypesDataFields, busOptions: BusOption[], sourcesData: Source[], devicesData: Device[], deviceSources, deviceActions, deviceStates: DeviceState[], tslClients, cloudDestinations, cloudKeys, cloudClients) => {
      this.sourceTypes = sourceTypes;
      this.sourceTypeDataFields = sourceTypesDataFields;
      // this.source_types_busoptions = sourceTypesBusOptions;
      // this.output_types = outputTypes;
      // this.output_types_datafields = outputTypesDataFields;
      this.busOptions = busOptions;
      this.sources =  this.prepareSources(sourcesData);
      this.devices = devicesData;
      // this.device_sources = deviceSources;
      // this.device_actions = deviceActions;
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
        case 'device-source-deleted-successfully':
          this.modalService.dismissAll();
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

  public getOptionFields(sourceType: SourceType) {
    return this.sourceTypeDataFields.find((s) => s.sourceTypeId == sourceType.id)?.fields || [];
  }

  public filterEnabledSourceTypes(sourceTypes: SourceType[]) {
    return sourceTypes.filter((s) => s.enabled);
  }

  public toggleTestMode() {
    this.testModeOn = !this.testModeOn;
    this.socket.emit('testmode', this.testModeOn);
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
  private getBusById(busId: string) {
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

  
  private getSourceById(sourceId: string) {
    return this.sources.find(({id}) => id === sourceId);
  }

}
