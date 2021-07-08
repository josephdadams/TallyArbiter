export interface SourceTypeDataFields {
    sourceTypeId: string;
    fields: {
        fieldLabel: string;
        fieldName: string;
        fieldType: "text" | "port" | "number" | "dropdown" | "info" | "multiselect";
        options?: {
            id: string;
            label: string;
        }[];
        text?: string;
    }[];
}