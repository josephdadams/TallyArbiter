import { Component } from '@angular/core';
import { SocketService } from 'src/app/_services/socket.service';

@Component({
  selector: 'app-producer',
  templateUrl: './producer.component.html',
  styleUrls: ['./producer.component.scss']
})
export class ProducerComponent {
  public dataLoaded: boolean = false;
  public listenerClientsLoaded = false;

  constructor(public socketService: SocketService) {
    this.socketService.joinProducers();
    this.socketService.dataLoaded.then(() => {
      this.dataLoaded = true;
    });
    this.socketService.listenerClientsLoaded.then(() => {
      this.listenerClientsLoaded = true;
    });
  }  
}
