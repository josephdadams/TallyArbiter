import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { LogItem } from 'src/app/_models/LogItem';
import { Source } from 'src/app/_models/Source';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent implements OnInit {
  @ViewChild('logsContainer') private logsContainer!: ElementRef;
  @ViewChild('tallyDataContainer') private tallyDataContainer!: ElementRef;
  public version?: string;
  public logs: LogItem[] = [];
  public sources: Source[] = [];
  public tallyData: LogItem[] = [];
  private socket: Socket;
  constructor() {
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
      this.sources = sources;
	  });
  }

  ngOnInit(): void {

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
