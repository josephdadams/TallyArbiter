import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { Router } from '@angular/router';
import { SocketService } from 'src/app/_services/socket.service';

@Component({
  selector: 'app-error-reports-list',
  templateUrl: './error-reports-list.component.html',
  styleUrls: ['./error-reports-list.component.scss']
})
export class ErrorReportsListComponent implements OnInit {
  constructor(
    private router: Router,
    public socketService: SocketService,
  ) {
    console.log(this.socketService.errorReports);
    
  }

  public selectErrorReport(id: any) {
    this.router.navigate(["/", "errors", id.target.value]);
  }

  ngOnInit(): void {
  }

}
