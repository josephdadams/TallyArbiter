import { Component, OnInit, OnDestroy, AfterViewInit, Renderer2, ElementRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { SocketService } from 'src/app/_services/socket.service';
import { ErrorReport } from 'src/app/_models/ErrorReport';
import { NavbarVisibilityService } from 'src/app/_services/navbar-visibility.service';
import { LocationBackService } from 'src/app/_services/locationBack.service';

@Component({
  selector: 'app-error-report',
  templateUrl: './error-report.component.html',
  styleUrls: ['./error-report.component.scss']
})
export class ErrorReportComponent implements OnInit, OnDestroy, AfterViewInit {
  public currentReportId: string = "blank";
  public currentReport: ErrorReport = {} as ErrorReport;
  public loading = true;
  public validReport = false;
  public bugReportUrl = "";

  constructor(
    public route: ActivatedRoute,
    public socketService: SocketService,
    public navbarVisibilityService: NavbarVisibilityService,
    public locationBackService: LocationBackService,
    private renderer: Renderer2,
    private el: ElementRef
  ) {
    navbarVisibilityService.hideNavbar();
    this.route.params.subscribe((params) => {
      if (params.errorReportId) {
        this.currentReportId = params.errorReportId;
      }
    });
  }

  ngAfterViewInit() {
    this.renderer.setStyle(
      this.el.nativeElement.ownerDocument.body,
      'background',
      '#3973aa'
    );
  }

  generateBugReportUrl(bugTitle: string, version: string, config: object, logs: string, stacktrace: string, runningRecursive: boolean = false): string {
    
    //https://medium.com/@DylanAttal/truncate-a-string-in-javascript-41f33171d5a8
    function truncateString(str: string, num: number) {
      // If the length of str is less than or equal to num
      // just return str--don't truncate it.
      if (str.length <= num) {
        return str
      }
      // Return str truncated with '...' concatenated to the end of str.
      return str.slice(0, num) + '...'
    }

    let bugReportUrl: string = `https://github.com/josephdadams/TallyArbiter/issues/new?labels=bug&template=bug.yaml&title=${encodeURIComponent(bugTitle)}&version=${version}&config=${encodeURIComponent(JSON.stringify(config, null, 2))}&logs=${encodeURIComponent(logs)}&stacktrace=${encodeURIComponent(stacktrace)}`;
    if(bugReportUrl.length > 8190 && !runningRecursive) {
      bugTitle = truncateString(bugTitle, 60);
      let logs_split: string[] = logs.split('\n');
      if(logs_split.length > 10){
        logs_split.splice(0,logs_split.length-5);
        logs = logs_split.join('\n');
      }
      bugReportUrl = this.generateBugReportUrl(bugTitle, version, config, logs, stacktrace, true);
    }
    return bugReportUrl;
  }

  ngOnInit() {
    this.socketService.getErrorReportById(this.currentReportId)
      .then((errorReport) => {
        this.currentReport = errorReport as ErrorReport;
        this.loading = false;
        this.validReport = true;
        let bugTitle = "[Bug] "+this.currentReport.stacktrace.split("\n")[0];
        this.bugReportUrl = this.generateBugReportUrl(bugTitle, this.socketService.version as string, this.currentReport.config, this.currentReport.logs, this.currentReport.stacktrace);
        console.log("Error report found:");
        console.log(errorReport);
      })
      .catch((response) => {
        this.loading = false;
        console.log("Error report not found");
      });
  }

  ngOnDestroy() {
    this.renderer.removeStyle(
      this.el.nativeElement.ownerDocument.body,
      'background'
    );
    this.navbarVisibilityService.showNavbar();
  }

}
