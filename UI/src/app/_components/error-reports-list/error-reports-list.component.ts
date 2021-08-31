import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { Router } from '@angular/router';
import { SocketService } from 'src/app/_services/socket.service';
import { ErrorReportsListElement } from 'src/app/_models/ErrorReportsListElement';

@Component({
  selector: 'app-error-reports-list',
  templateUrl: './error-reports-list.component.html',
  styleUrls: ['./error-reports-list.component.scss']
})
export class ErrorReportsListComponent implements OnInit {
  public unreaded_error_reports: any = [];
  public errorReportsLoaded: boolean = false;

  constructor(
    private router: Router,
    public socketService: SocketService,
  ) {
    console.log(this.socketService.errorReports);
    this.socketService.socket.on('unreaded_error_reports', (list) => {
      console.log(list);
      list.forEach((report: ErrorReportsListElement) => {
        this.unreaded_error_reports.push(report.id);
      });
      this.errorReportsLoaded = true;
    });
    this.socketService.socket.emit('get_unreaded_error_reports');
  }

  public selectErrorReport(id: any) {
    this.router.navigate(["/", "errors", id.target.value]);
  }

  public markErrorReportsAsReaded() {
    this.socketService.socket.emit('mark_error_reports_as_read');
  }

  public deleteEveryErrorReport() {
    this.socketService.socket.emit('delete_every_error_report');
  }

  ngOnInit(): void {
  }

}
