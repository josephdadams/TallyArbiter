import { Component } from '@angular/core';
import { TourService } from '@ngx-tour/ng-bootstrap';
import { SocketService } from 'src/app/_services/socket.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent {
  public localNetInterfaceUrl = "http://localhost:4455/#/tally";
  public netInterfaceUrl = this.localNetInterfaceUrl;
  constructor(public socketService: SocketService, private tourService: TourService) { }
  
  public ngOnInit(): void {
    this.tourService.initialize([
      {
        anchorId: 'home.start',
        title: 'Quickstart-Tour',
        content: 'This tour will give you an overview of how to use TallyArbiter. Skip the tour by pressing the x button. You can always restart it from the About page.',
        enableBackdrop: true,
      },
      {
        anchorId: 'home.webclients',
        title: 'Tally Clients',
        content: 'You can connect many different clients which function as your Tally Lights. To use any smartphone, laptop or PC as the Web Tally, scan the QR Code or open one of the URLs listed below.',
        enableBackdrop: true,
      },
      {
        anchorId: 'home.docs',
        title: 'Documentation',
        content: 'ToDo',
        enableBackdrop: true,
      },
      {
        anchorId: 'home.producer',
        title: 'Producer',
        content: 'ToDo',
        enableBackdrop: true,
      },
      {
        anchorId: 'home.settings',
        title: 'Settings',
        content: 'ToDo',
        enableBackdrop: true,
      },
    ]);
    this.tourService.start();
  }
}
