import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { SocketService } from 'src/app/_services/socket.service';
import { ErrorReport } from 'src/app/_models/ErrorReport';

@Component({
  selector: 'app-error-report',
  templateUrl: './error-report.component.html',
  styleUrls: ['./error-report.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class ErrorReportComponent implements OnInit {
  public currentReportId: string = "blank";
  public currentReport: ErrorReport = {} as ErrorReport;
  public loading = true;
  public validReport = false;
  public bugReportUrl = "";

  constructor(
    public route: ActivatedRoute,
    public socketService: SocketService,
  ) {
    this.route.params.subscribe((params) => {
      if (params.errorReportId) {
        this.currentReportId = params.errorReportId;
      }
    });
  }

  ngOnInit(): void {
    this.socketService.getErrorReportById(this.currentReportId)
      .then((errorReport) => {
        this.currentReport = errorReport as ErrorReport;
        this.loading = false;
        this.validReport = true;
        let bugTitle = "[Bug] "+this.currentReport.stacktrace.split("\n")[0];
        this.bugReportUrl = `https://github.com/josephdadams/TallyArbiter/issues/new?labels=bug&template=bug.yaml&title=${encodeURIComponent(bugTitle)}&version=${this.socketService.version}&config=${encodeURIComponent(JSON.stringify(this.currentReport.config, null, 2))}&logs=${encodeURIComponent(this.currentReport.logs)}&stacktrace=${encodeURIComponent(this.currentReport.stacktrace)}`;
        console.log("Error report found:");
        console.log(errorReport);
      })
      .catch((response) => {
        this.loading = false;
        console.log("Error report not found");
      });
  }

}
