export interface LogItem {
    datetime: string;
    log: string;
    type: "info" | "info_quiet" | "error" | "console_action";
}